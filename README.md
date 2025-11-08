# ClimateCare AI - Climate Health Monitoring Platform

A production-ready climate health risk monitoring platform that provides real-time risk assessment by combining live weather data, air quality measurements, and demographic vulnerability analysis.

## Features

### Core Functionality
- **Interactive Risk Map**: MapLibre GL-powered map displaying neighborhoods color-coded by Climate Health Risk Score
- **Real-Time Data Integration**: Live weather forecasts from Open-Meteo API and air quality data from OpenAQ
- **Multi-Index Risk Scoring**: Comprehensive risk assessment combining three indices:
  - Heat Stress Index (HSI): Temperature, humidity, and heat anomalies
  - Cold Stress Index (CSI): Wind chill, minimum temperatures
  - Air Quality Risk Index (AQRI): PM2.5, PM10, and NO₂ measurements
- **7-Day Forecast**: Time slider to view projected risk scores across the week
- **Automated Alert System**: Daily risk calculations with configurable thresholds and automatic alert generation
- **Web Push Notifications**: Browser-based push notifications for high-risk alerts
- **Community Portal**: Resident submission system for climate-related concerns
- **GeoJSON Upload**: Dynamic neighborhood boundary replacement via file upload
- **Accessibility**: Colorblind-safe palette option and responsive design

### Technical Highlights
- Free, live data sources (no API keys required)
- TTL-based API response caching (15-minute default)
- Nearest station matching for air quality data
- Graceful fallbacks when data is unavailable
- Data confidence scoring per neighborhood
- Persistent storage for alerts and submissions (flat files)
- Service worker for offline notification support

## Project Structure

```
├── client/                   # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   └── lib/             # Utilities and API client
│   └── public/
│       └── service-worker.js # Web Push service worker
├── server/                   # Express backend
│   ├── data/                # Demo data and persistent storage
│   │   ├── neighborhoods.geojson
│   │   ├── vulnerability.csv
│   │   ├── alerts.json      # Auto-generated
│   │   ├── submissions.json # Auto-generated
│   │   ├── vapid-keys.json  # Auto-generated
│   │   └── push-subscriptions.json # Auto-generated
│   ├── services/            # Business logic
│   │   ├── weatherService.ts    # Open-Meteo integration
│   │   ├── airQualityService.ts # OpenAQ integration
│   │   ├── riskEngine.ts        # Risk calculation algorithms
│   │   ├── scheduler.ts         # Daily risk calculations
│   │   └── webPushService.ts    # Push notifications
│   ├── routes.ts            # API endpoints
│   ├── storage.ts           # Data persistence layer
│   └── index.ts             # Server entry point
└── shared/                   # Shared TypeScript types
    └── schema.ts
```

## Running the Application

### Prerequisites
- Node.js 20+
- No external API keys required!

### Quick Start

```bash
# Install dependencies (already done in Replit)
npm install

# Start the application
npm run dev
```

The application will be available at `http://localhost:5000` (or the Replit webview URL).

The server will automatically:
1. Generate VAPID keys for Web Push (saved to `server/data/vapid-keys.json`)
2. Load demo neighborhood data from `server/data/neighborhoods.geojson`
3. Run an initial risk calculation for all neighborhoods
4. Schedule daily risk calculations for 6:00 AM

## API Endpoints

### Neighborhoods & Risk Data
- `GET /api/neighborhoods?dayIndex=0` - Get all neighborhoods with current risk scores
- `GET /api/risk?lat=43.65&lon=-79.38&dayIndex=0` - Get risk data for a specific location

### Alerts
- `GET /api/alerts` - Get all active alerts
- `DELETE /api/alerts/:id` - Dismiss an alert
- `POST /api/alerts/test` - Create a test alert

### Community Portal
- `GET /api/community/submissions` - Get all community submissions
- `POST /api/community/submissions` - Submit a new community report
  ```json
  {
    "location": "Downtown, 123 Main St",
    "message": "Extreme heat observed in the area"
  }
  ```

### GeoJSON Upload
- `POST /api/neighborhoods/upload` - Upload custom neighborhood boundaries (multipart/form-data with `geojson` file)

### Web Push Notifications
- `GET /api/push/publickey` - Get VAPID public key
- `POST /api/push/subscribe` - Subscribe to push notifications
- `POST /api/push/unsubscribe` - Unsubscribe from notifications
- `POST /api/push/send-test` - Send test notification to all subscribers

## Live Data Sources

### Weather Data: Open-Meteo API
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Data**: Temperature, humidity, wind speed, precipitation, UV index
- **Coverage**: Global
- **Update Frequency**: Hourly
- **Cache TTL**: 15 minutes

### Air Quality: OpenAQ API
- **Endpoint**: `https://api.openaq.org/v2/locations`
- **Data**: PM2.5, PM10, NO₂ concentrations
- **Coverage**: Varies by region (uses nearest station matching)
- **Fallback**: Gracefully handles missing data
- **Cache TTL**: 15 minutes

### Map Tiles: OpenStreetMap
- **Tiles**: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- **No authentication required**

## Risk Calculation Model

### Heat Stress Index (HSI)
```
HSI = normalize(
  max_temp_score × 0.5 +
  humidity_score × 0.3 +
  temp_anomaly_zscore × 0.2
)
```

### Cold Stress Index (CSI)
```
CSI = normalize(
  min_temp_score × 0.6 +
  wind_chill_score × 0.3 +
  snow_cover_score × 0.1
)
```

### Air Quality Risk Index (AQRI)
```
AQRI = normalize(
  pm25_score × 0.5 +
  pm10_score × 0.3 +
  no2_score × 0.2
)
```

### Final Climate Health Risk Score
```
Risk Score = HSI × 0.4 + CSI × 0.3 + AQRI × 0.3
```

All scores are normalized to 0-100 scale.

### Configurable Parameters

Risk weights and thresholds can be adjusted in `server/services/riskEngine.ts`:

```typescript
export const defaultRiskConfig: RiskConfig = {
  weights: {
    heat: 0.4,  // 40% weight for heat stress
    cold: 0.3,  // 30% weight for cold stress
    air: 0.3,   // 30% weight for air quality
  },
  thresholds: {
    hsi: 70,   // Alert threshold for heat stress
    csi: 60,   // Alert threshold for cold stress
    aqri: 65,  // Alert threshold for air quality
  },
};
```

## Customizing Neighborhoods

### Method 1: Replace Demo Data
Edit `server/data/neighborhoods.geojson` with your own GeoJSON FeatureCollection. Each feature should have:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lon, lat], ...]]
  },
  "properties": {
    "name": "Neighborhood Name",
    "population": 15000,
    "seniorPercent": 18,
    "vulnerabilityScore": 75
  }
}
```

### Method 2: Upload via UI
Use the "Upload GeoJSON" button in the dashboard sidebar to dynamically replace neighborhoods.

### Vulnerability Data
Edit `server/data/vulnerability.csv` to include demographic data:

```csv
neighborhood,population,seniorPercent,vulnerabilityScore,medianIncome,healthcareFacilities
Downtown,15000,18,75,52000,3
```

## Environment Variables

All environment variables are optional. The application works out-of-the-box with sensible defaults.

### Optional Email/SMS Configuration

To enable email alerts (optional):
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=password
SMTP_FROM=alerts@climatecare.ai
```

To enable SMS alerts via Twilio (optional):
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Note**: Without these credentials, the application defaults to console logging and Web Push notifications, which work immediately without configuration.

## Data Persistence

The application uses flat file storage for simplicity and Replit compatibility:

- **Alerts**: `server/data/alerts.json`
- **Community Submissions**: `server/data/submissions.json`
- **Push Subscriptions**: `server/data/push-subscriptions.json`
- **VAPID Keys**: `server/data/vapid-keys.json` (auto-generated on first run)
- **Neighborhoods**: `server/data/neighborhoods.geojson`

All files are created automatically if they don't exist.

## Scheduled Tasks

The application runs daily risk calculations at 6:00 AM (configurable in `server/services/scheduler.ts`):

```typescript
cron.schedule('0 6 * * *', calculateDailyRisks);
```

The scheduler:
1. Fetches current weather and air quality data for all neighborhoods
2. Calculates risk indices
3. Compares against thresholds
4. Generates alerts for high-risk areas
5. Stores results for the day

## Development

### Adding New Risk Factors

1. Update the data fetching in `server/services/weatherService.ts` or create a new service
2. Modify risk calculation functions in `server/services/riskEngine.ts`
3. Update the `RiskData` type in `shared/schema.ts`
4. Adjust UI components to display new metrics

### Extending the API

Add new routes in `server/routes.ts`:

```typescript
app.get("/api/custom-endpoint", async (req, res) => {
  // Your implementation
});
```

### Testing Risk Calculations

Use the `/api/risk` endpoint to test risk calculations for specific coordinates:

```bash
curl "http://localhost:5000/api/risk?lat=43.65&lon=-79.38&dayIndex=0"
```

## Deployment

The application is designed for Replit but can be deployed anywhere Node.js runs:

1. Ensure all dependencies are installed
2. Set `NODE_ENV=production`
3. Run `npm run build` (if using a build step)
4. Start with `npm start`

The server binds to `0.0.0.0:5000` by default (configurable via `PORT` environment variable).

## Architecture Notes

### Why In-Memory Caching?
- Reduces API load and improves response times
- 15-minute TTL balances freshness with performance
- Simple implementation suitable for a prototype

### Why Flat File Storage?
- No database setup required
- Easy to inspect and modify
- Suitable for moderate data volumes
- Works seamlessly in Replit environment

### Why MapLibre GL?
- Free and open-source alternative to Mapbox
- No API keys or tokens required
- Excellent performance with GeoJSON layers
- Active community and good documentation

## Limitations & Future Enhancements

### Current Limitations
- Air quality data coverage varies by region (OpenAQ station availability)
- Simple centroid-based risk calculation (could use multi-point sampling)
- No historical trend analysis
- In-memory caching resets on server restart

### Potential Enhancements
- PostgreSQL database for persistent storage and historical data
- NASA POWER API integration for solar radiation data
- MODIS/Sentinel satellite data for surface temperature
- User accounts with saved neighborhoods and preferences
- Advanced spatial aggregation (multiple sample points per polygon)
- Export functionality (CSV/PDF reports)
- Mobile-responsive design improvements
- Real-time WebSocket updates

## License

This is a prototype application for demonstration purposes.

## Support

For issues or questions, check:
- Server logs: Check the Replit console
- Browser console: Press F12 in your browser
- API responses: Use the Network tab in browser DevTools

## Credits

- Weather Data: [Open-Meteo](https://open-meteo.com/)
- Air Quality Data: [OpenAQ](https://openaq.org/)
- Map Tiles: [OpenStreetMap](https://www.openstreetmap.org/)
- Mapping Library: [MapLibre GL JS](https://maplibre.org/)
- UI Components: [shadcn/ui](https://ui.shadcn.com/)
