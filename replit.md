# ClimateCare AI - Climate Health Monitoring Platform

## Overview

ClimateCare AI is a production-ready climate health risk monitoring platform that provides real-time risk assessment by combining live weather data, air quality measurements, and demographic vulnerability analysis. The platform displays neighborhoods on an interactive map, color-coded by Climate Health Risk Score, with support for 7-day forecasts, automated alerts, web push notifications, and community reporting.

The application uses free, live data sources (Open-Meteo for weather, OpenAQ for air quality) with no API keys required. It implements a sophisticated multi-index risk scoring system (Heat Stress Index, Cold Stress Index, Air Quality Risk Index) and provides accessibility features including colorblind-safe palettes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript in a single-page application architecture

**Build System**: Vite for development and production builds with HMR support

**State Management**: 
- React Query (@tanstack/react-query) for server state management with automatic caching and refetching
- Local React hooks (useState, useEffect) for UI state
- Query client configured with infinite stale time and disabled auto-refetching

**Routing**: Wouter for lightweight client-side routing (single Dashboard route + 404 fallback)

**UI Component Library**: Radix UI primitives with custom shadcn/ui components following Material Design 3 principles
- Custom design system with Tailwind CSS using CSS variables for theming
- Typography: Inter font family for UI, JetBrains Mono for monospace data
- Spacing system based on Tailwind units (2, 4, 6, 8)
- Colorblind-safe palette option using blue-red gradient instead of green-red

**Map Visualization**: MapLibre GL JS with OpenStreetMap tiles
- GeoJSON neighborhood layer with dynamic styling based on risk scores
- Interactive popups displaying detailed metrics per neighborhood
- Zoom controls and neighborhood click handlers

**Data Visualization**: Chart.js for 7-day risk forecast line charts

**Form Handling**: React Hook Form with Zod validation schemas

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js

**API Design Pattern**: RESTful endpoints with JSON responses
- `/api/neighborhoods` - GeoJSON with enriched risk data (supports dayIndex query param)
- `/api/alerts` - Active alerts management (GET, POST, DELETE)
- `/api/community` - Community submissions (GET, POST)
- `/api/upload` - GeoJSON neighborhood boundary upload
- `/api/push/*` - Web push notification endpoints

**Business Logic Services**:
- `weatherService.ts` - Open-Meteo API integration with TTL-based caching (15 min default)
- `airQualityService.ts` - OpenAQ API integration with nearest station matching
- `riskEngine.ts` - Multi-index risk calculation (HSI, CSI, AQRI) with configurable weights
- `scheduler.ts` - Daily cron job for automated risk calculations and alert generation
- `webPushService.ts` - VAPID-based web push notification management

**Caching Strategy**: In-memory TTL cache for weather and air quality API responses to minimize external API calls

**Data Processing**:
- Centroid calculation for neighborhood polygons
- Nearest station matching for air quality data using Haversine distance
- Risk score normalization (0-100 scale)
- Confidence scoring based on data availability

### Data Storage

**Primary Storage**: Flat file JSON storage (no database required initially, but Drizzle ORM configured for future PostgreSQL migration)

**File Structure**:
- `server/data/neighborhoods.geojson` - Neighborhood boundary definitions
- `server/data/vulnerability.csv` - Demographic vulnerability data
- `server/data/alerts.json` - Auto-generated alert records
- `server/data/submissions.json` - Community submission records
- `server/data/vapid-keys.json` - Auto-generated VAPID keys for push notifications
- `server/data/push-subscriptions.json` - Push notification subscription records

**Storage Interface**: `IStorage` interface with `MemStorage` implementation providing:
- User management (prepared for future auth)
- Neighborhood data management with GeoJSON upload support
- Alert lifecycle management
- Community submission persistence
- Automatic JSON file persistence on writes

**Future Migration Path**: Drizzle ORM configuration present for PostgreSQL migration via Neon serverless driver
- Schema defined in `shared/schema.ts`
- Migration scripts directory configured
- Environment variable `DATABASE_URL` prepared

### External Dependencies

**Weather Data**: Open-Meteo API (free, no authentication required)
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Provides: hourly/daily temperature, humidity, wind speed, precipitation, UV index
- 7-day forecast support

**Air Quality Data**: OpenAQ API (free, no authentication required)
- Provides: PM2.5, PM10, NO₂ measurements from nearest monitoring stations
- Station metadata with coordinates for distance calculation
- Graceful fallback when data unavailable

**Map Tiles**: OpenStreetMap raster tiles
- Free, attribution-required tiles via `https://tile.openstreetmap.org/{z}/{x}/{y}.png`

**Push Notifications**: Web Push protocol with VAPID authentication
- Browser Push API with service worker (`client/public/service-worker.js`)
- Auto-generated VAPID key pairs stored locally
- Subscription management via `web-push` npm package

**UI Libraries**:
- Radix UI (@radix-ui/*) - Accessible headless component primitives
- Chart.js - Data visualization
- MapLibre GL - Map rendering
- Tailwind CSS - Utility-first styling
- React Hook Form + Zod - Form validation

**Utility Libraries**:
- date-fns - Date manipulation and formatting
- multer - File upload handling (GeoJSON uploads)
- node-cron - Scheduled task execution
- nanoid - Unique ID generation

### Risk Calculation Model

**Multi-Index Scoring System**:

1. **Heat Stress Index (HSI)** - Weight: 40%
   - Temperature normalization (0-45°C range)
   - Humidity impact (0-100% range)
   - Temperature anomaly z-score
   - Formula: `tempScore × 0.5 + humidityScore × 0.3 + anomalyScore × 0.2`

2. **Cold Stress Index (CSI)** - Weight: 30%
   - Minimum temperature impact
   - Wind chill calculations
   - Snow cover persistence (prepared for satellite data integration)
   - Formula: `minTempScore × 0.5 + windChillScore × 0.3 + snowScore × 0.2`

3. **Air Quality Risk Index (AQRI)** - Weight: 30%
   - PM2.5 levels (0-500 μg/m³ range)
   - PM10 levels
   - NO₂ concentration
   - Formula: `pm25Score × 0.5 + pm10Score × 0.3 + no2Score × 0.2`

**Composite Risk Score**: Weighted average of three indices with configurable thresholds for alert generation

**Data Confidence Scoring**: Tracks availability of weather vs air quality data to provide transparency on calculation reliability

### Deployment Configuration

**Development Mode**: Vite dev server with HMR, Express backend proxying
- Custom middleware for request logging
- Replit-specific plugins for debugging and banners

**Production Build**:
- Frontend: Vite static build to `dist/public`
- Backend: esbuild bundle to `dist/index.js` with ESM format
- Single-command start: `npm start`

**Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection (optional, for future migration)
- `NODE_ENV` - Environment detection (development/production)

**Path Aliases**: TypeScript path mapping for clean imports
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`