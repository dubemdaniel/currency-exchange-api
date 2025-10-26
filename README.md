# Country Currency & Exchange API

A RESTful API that fetches country data from external sources, manages currency exchange rates, and provides comprehensive CRUD operations with image generation capabilities.

## Features

- 🌍 Fetch and cache country data from REST Countries API
- 💱 Real-time currency exchange rates from Open Exchange Rates
- 📊 Automatic GDP estimation based on population and exchange rates
- 🖼️ Dynamic summary image generation
- 🔍 Advanced filtering and sorting capabilities
- 💾 MySQL database persistence
- ⚡ Optimized with connection pooling

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MySQL
- **HTTP Client**: Axios
- **Image Generation**: node-canvas
- **Environment**: dotenv

## Prerequisites

Before running this application, ensure you have:

- Node.js (v18 or higher)
- MySQL Server (v8.0 or higher)
- npm or yarn package manager

## Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd country-currency-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Create a MySQL database:

```sql
CREATE DATABASE countries_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The application will automatically create the required tables on first run.

### 4. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=countries_db
```

### 5. Start the Server

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Endpoints

### 1. Refresh Country Data

**POST** `/countries/refresh`

Fetches fresh data from external APIs and updates the database.

**Response**:
```json
{
  "message": "Countries refreshed successfully",
  "total_countries": 250,
  "last_refreshed_at": "2025-10-26T12:00:00.000Z"
}
```

### 2. Get All Countries

**GET** `/countries`

Query Parameters:
- `region` - Filter by region (e.g., `Africa`, `Europe`)
- `currency` - Filter by currency code (e.g., `NGN`, `USD`)
- `sort` - Sort by GDP (`gdp_desc` or `gdp_asc`)

**Example**: `GET /countries?region=Africa&sort=gdp_desc`

**Response**:
```json
[
  {
    "id": 1,
    "name": "Nigeria",
    "capital": "Abuja",
    "region": "Africa",
    "population": 206139589,
    "currency_code": "NGN",
    "exchange_rate": 1600.23,
    "estimated_gdp": 25767448125.2,
    "flag_url": "https://flagcdn.com/ng.svg",
    "last_refreshed_at": "2025-10-26T12:00:00.000Z"
  }
]
```

### 3. Get Single Country

**GET** `/countries/:name`

**Example**: `GET /countries/Nigeria`

**Response**: Single country object (same structure as above)

### 4. Delete Country

**DELETE** `/countries/:name`

**Example**: `DELETE /countries/Nigeria`

**Response**:
```json
{
  "message": "Country deleted successfully"
}
```

### 5. Get Status

**GET** `/status`

**Response**:
```json
{
  "total_countries": 250,
  "last_refreshed_at": "2025-10-26T12:00:00.000Z"
}
```

### 6. Get Summary Image

**GET** `/countries/image`

Returns the generated PNG image with country statistics.

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": {
    "currency_code": "is required"
  }
}
```

### 404 Not Found
```json
{
  "error": "Country not found"
}
```

### 503 Service Unavailable
```json
{
  "error": "External data source unavailable",
  "details": "Could not fetch data from restcountries.com"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Project Structure

```
country-currency-api/
├── server.js           # Main application file
├── package.json        # Dependencies and scripts
├── .env               # Environment variables (create this)
├── .env.example       # Environment template
├── .gitignore         # Git ignore rules
├── README.md          # Documentation
└── cache/             # Generated images (auto-created)
    └── summary.png    # Summary image
```

## Dependencies

- **express**: Web framework
- **mysql2**: MySQL client with Promise support
- **axios**: HTTP client for external APIs
- **canvas**: Image generation library
- **dotenv**: Environment variable management

## Development

### Running Tests

Test the API using curl or Postman:

```bash
# Refresh data
curl -X POST http://localhost:3000/countries/refresh

# Get all countries
curl http://localhost:3000/countries

# Get African countries sorted by GDP
curl "http://localhost:3000/countries?region=Africa&sort=gdp_desc"

# Get specific country
curl http://localhost:3000/countries/Nigeria

# Check status
curl http://localhost:3000/status

# Download summary image
curl http://localhost:3000/countries/image -o summary.png
```

## Deployment

### Recommended Platforms

- **Railway**: Easy deployment with automatic MySQL provisioning
- **Heroku**: Classic PaaS with ClearDB MySQL addon
- **AWS**: EC2 + RDS for production workloads
- **DigitalOcean**: App Platform with managed databases

### Deployment Checklist

1. Set all environment variables in your hosting platform
2. Ensure MySQL database is accessible
3. Configure proper security groups/firewall rules
4. Set `NODE_ENV=production`
5. Test all endpoints after deployment
6. Monitor logs for errors

### Example: Railway Deployment

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and initialize
railway login
railway init

# Add MySQL plugin
railway add

# Set environment variables
railway variables set DB_HOST=<mysql-host>
railway variables set DB_USER=<mysql-user>
railway variables set DB_PASSWORD=<mysql-password>
railway variables set DB_NAME=countries_db

# Deploy
railway up
```

## Troubleshooting

### Database Connection Issues

- Verify MySQL is running: `mysql -u root -p`
- Check credentials in `.env`
- Ensure database exists: `SHOW DATABASES;`

### Canvas Installation Issues

Canvas requires system dependencies:

**Ubuntu/Debian**:
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

**macOS**:
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

### External API Timeouts

- Check internet connectivity
- Verify API URLs are accessible
- Consider increasing timeout in axios calls

## License

MIT License - feel free to use this project for learning or commercial purposes.

## Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ for HNG12 Backend Stage 2**