import "dotenv/config";
import express, { Request, Response } from "express";
import mysql from "mysql2/promise";
import axios from "axios";
import { createCanvas } from "canvas";
import fs from "fs/promises";
import path from "path";

const app = express();
app.use(express.json());

// Types
interface Country {
  name: string;
  capital?: string;
  region?: string;
  population: number;
  flag?: string;
  currencies?: Array<{ code: string; name: string; symbol: string }>;
}

interface ExchangeRatesResponse {
  rates: { [key: string]: number };
}

interface CountryRecord {
  id?: number;
  name: string;
  capital: string | null;
  region: string | null;
  population: number;
  currency_code: string | null;
  exchange_rate: number | null;
  estimated_gdp: number | null;
  flag_url: string | null;
  last_refreshed_at?: Date;
}

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "countries_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize database
async function initializeDatabase(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS countries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        capital VARCHAR(255),
        region VARCHAR(255),
        population BIGINT NOT NULL,
        currency_code VARCHAR(10),
        exchange_rate DECIMAL(20, 6),
        estimated_gdp DECIMAL(25, 2),
        flag_url TEXT,
        last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_region (region),
        INDEX idx_currency (currency_code),
        INDEX idx_gdp (estimated_gdp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_status (
        id INT PRIMARY KEY DEFAULT 1,
        last_refreshed_at TIMESTAMP,
        CHECK (id = 1)
      )
    `);

    await connection.query(`
      INSERT IGNORE INTO app_status (id, last_refreshed_at) VALUES (1, NULL)
    `);

    console.log("Database initialized successfully");
  } finally {
    connection.release();
  }
}

// Generate summary image
async function generateSummaryImage(
  totalCountries: number,
  topCountries: Array<{ name: string; estimated_gdp: number | null }>,
  timestamp: Date
): Promise<void> {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#eee";
  ctx.font = "bold 36px Arial";
  ctx.fillText("Country Data Summary", 50, 70);

  // Total countries
  ctx.font = "24px Arial";
  ctx.fillText(`Total Countries: ${totalCountries}`, 50, 130);

  // Timestamp
  ctx.font = "18px Arial";
  ctx.fillStyle = "#aaa";
  ctx.fillText(
    `Last Refreshed: ${new Date(timestamp).toLocaleString()}`,
    50,
    170
  );

  // Top 5 countries
  ctx.fillStyle = "#eee";
  ctx.font = "bold 28px Arial";
  ctx.fillText("Top 5 Countries by GDP", 50, 230);

  ctx.font = "20px Arial";
  let yPos = 280;
  topCountries.forEach((country, index) => {
    const gdp = country.estimated_gdp
      ? `$${Number(country.estimated_gdp).toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}`
      : "N/A";
    ctx.fillText(`${index + 1}. ${country.name}: ${gdp}`, 70, yPos);
    yPos += 50;
  });

  // Save image
  const cacheDir = path.join(__dirname, "..", "cache");
  await fs.mkdir(cacheDir, { recursive: true });
  const buffer = canvas.toBuffer("image/png");
  await fs.writeFile(path.join(cacheDir, "summary.png"), buffer);
}

// POST /countries/refresh
app.post(
  "/countries/refresh",
  async (req: Request, res: Response): Promise<void> => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Fetch countries
      let countriesData: Country[];
      try {
        const countriesResponse = await axios.get<Country[]>(
          "https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies",
          { timeout: 30000 }
        );
        countriesData = countriesResponse.data;
      } catch (error) {
        res.status(503).json({
          error: "External data source unavailable",
          details: "Could not fetch data from restcountries.com",
        });
        return;
      }

      // Fetch exchange rates
      let exchangeRates: { [key: string]: number };
      try {
        const ratesResponse = await axios.get<ExchangeRatesResponse>(
          "https://open.er-api.com/v6/latest/USD",
          { timeout: 30000 }
        );
        exchangeRates = ratesResponse.data.rates;
      } catch (error) {
        await connection.rollback();
        res.status(503).json({
          error: "External data source unavailable",
          details: "Could not fetch data from open.er-api.com",
        });
        return;
      }

      // Process and store countries
      for (const country of countriesData) {
        const name = country.name;
        const capital = country.capital || null;
        const region = country.region || null;
        const population = country.population || 0;
        const flagUrl = country.flag || null;

        let currencyCode: string | null = null;
        let exchangeRate: number | null = null;
        let estimatedGdp: number | null = 0;

        // Handle currency
        if (country.currencies && country.currencies.length > 0) {
          currencyCode = country.currencies[0]!.code;

          const rate = exchangeRates[currencyCode]; // number | undefined
          if (rate !== undefined) {
            exchangeRate = rate; // number
            const randomMultiplier = Math.random() * (2000 - 1000) + 1000;
            estimatedGdp = (population * randomMultiplier) / exchangeRate;
          } else {
            exchangeRate = null;
            estimatedGdp = null;
          }
        }

        // Upsert country
        await connection.query(
          `
        INSERT INTO countries 
        (name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url, last_refreshed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          capital = VALUES(capital),
          region = VALUES(region),
          population = VALUES(population),
          currency_code = VALUES(currency_code),
          exchange_rate = VALUES(exchange_rate),
          estimated_gdp = VALUES(estimated_gdp),
          flag_url = VALUES(flag_url),
          last_refreshed_at = NOW()
      `,
          [
            name,
            capital,
            region,
            population,
            currencyCode,
            exchangeRate,
            estimatedGdp,
            flagUrl,
          ]
        );
      }

      // Update global timestamp
      await connection.query(`
      UPDATE app_status SET last_refreshed_at = NOW() WHERE id = 1
    `);

      await connection.commit();

      // Get data for image generation
      const [statusRows] = await connection.query<any[]>(
        "SELECT last_refreshed_at FROM app_status WHERE id = 1"
      );
      const [countRows] = await connection.query<any[]>(
        "SELECT COUNT(*) as total FROM countries"
      );
      const [topCountries] = await connection.query<any[]>(`
      SELECT name, estimated_gdp 
      FROM countries 
      WHERE estimated_gdp IS NOT NULL 
      ORDER BY estimated_gdp DESC 
      LIMIT 5
    `);

      const totalCountries = countRows[0].total;
      const timestamp = statusRows[0].last_refreshed_at;

      // Generate summary image
      await generateSummaryImage(totalCountries, topCountries, timestamp);

      res.json({
        message: "Countries refreshed successfully",
        total_countries: totalCountries,
        last_refreshed_at: timestamp,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Refresh error:", error);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      connection.release();
    }
  }
);

// GET /countries
app.get("/countries", async (req: Request, res: Response): Promise<void> => {
  try {
    const { region, currency, sort } = req.query;

    let query = "SELECT * FROM countries WHERE 1=1";
    const params: any[] = [];

    if (region) {
      query += " AND region = ?";
      params.push(region);
    }

    if (currency) {
      query += " AND currency_code = ?";
      params.push(currency);
    }

    if (sort === "gdp_desc") {
      query += " ORDER BY estimated_gdp DESC";
    } else if (sort === "gdp_asc") {
      query += " ORDER BY estimated_gdp ASC";
    }

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Get countries error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /countries/:name
app.get(
  "/countries/:name",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const [rows] = await pool.query<any[]>(
        "SELECT * FROM countries WHERE LOWER(name) = LOWER(?)",
        [req.params.name]
      );

      if (rows.length === 0) {
        res.status(404).json({ error: "Country not found" });
        return;
      }

      res.json(rows[0]);
    } catch (error) {
      console.error("Get country error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// DELETE /countries/:name
app.delete(
  "/countries/:name",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const [result] = await pool.query<any>(
        "DELETE FROM countries WHERE LOWER(name) = LOWER(?)",
        [req.params.name]
      );

      if (result.affectedRows === 0) {
        res.status(404).json({ error: "Country not found" });
        return;
      }

      res.json({ message: "Country deleted successfully" });
    } catch (error) {
      console.error("Delete country error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /status
app.get("/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const [countRows] = await pool.query<any[]>(
      "SELECT COUNT(*) as total FROM countries"
    );
    const [statusRows] = await pool.query<any[]>(
      "SELECT last_refreshed_at FROM app_status WHERE id = 1"
    );

    res.json({
      total_countries: countRows[0].total,
      last_refreshed_at: statusRows[0].last_refreshed_at,
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /countries/image
app.get(
  "/countries/image",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const imagePath = path.join(__dirname, "..", "cache", "summary.png");
      await fs.access(imagePath);
      res.sendFile(imagePath);
    } catch (error) {
      res.status(404).json({ error: "Summary image not found" });
    }
  }
);

// Health check
app.get("/", (req: Request, res: Response): void => {
  res.json({ message: "Country Currency & Exchange API", status: "running" });
});

const PORT = process.env.PORT || 3000;

// Start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
