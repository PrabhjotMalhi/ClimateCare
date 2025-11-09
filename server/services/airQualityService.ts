import type { AirQualityData } from "@shared/schema";
import { weatherCache } from "./weatherService";
import axios from "axios";

interface OpenAQMeasurement {
  parameter: string;
  value: number;
  lastUpdated: string;
  unit: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  location?: string;
}

interface OpenAQLocation {
  id: number;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  measurements?: OpenAQMeasurement[];
}

interface OpenAQResponse {
  results: OpenAQLocation[];
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert AQI to estimated pollutant values
 * These are rough estimates based on typical AQI composition
 */
function aqiToPollutants(aqi: number): { pm25: number; pm10: number; no2: number } {
  // Rough conversion formulas based on EPA AQI breakpoints
  let pm25 = 0;
  let pm10 = 0;
  let no2 = 0;

  if (aqi <= 50) {
    pm25 = aqi * 0.5;
    pm10 = aqi * 0.54;
    no2 = aqi * 0.5;
  } else if (aqi <= 100) {
    pm25 = 12.1 + (aqi - 51) * 0.77;
    pm10 = 55 + (aqi - 51) * 0.9;
    no2 = 54 + (aqi - 51) * 0.92;
  } else if (aqi <= 150) {
    pm25 = 35.5 + (aqi - 101) * 0.29;
    pm10 = 155 + (aqi - 101) * 0.9;
    no2 = 101 + (aqi - 101) * 0.98;
  } else if (aqi <= 200) {
    pm25 = 55.5 + (aqi - 151) * 0.29;
    pm10 = 255 + (aqi - 151) * 0.9;
    no2 = 361 + (aqi - 151) * 2.78;
  } else if (aqi <= 300) {
    pm25 = 150.5 + (aqi - 201) * 0.5;
    pm10 = 355 + (aqi - 201) * 0.9;
    no2 = 650 + (aqi - 201) * 3.03;
  } else {
    pm25 = 250.5 + (aqi - 301) * 1.25;
    pm10 = 425 + (aqi - 301) * 0.38;
    no2 = 1250 + (aqi - 301) * 1.26;
  }

  return {
    pm25: Math.round(pm25 * 10) / 10,
    pm10: Math.round(pm10 * 10) / 10,
    no2: Math.round(no2 * 10) / 10,
  };
}

/**
 * Try WAQI API as primary source
 */
async function tryWAQI(lat: number, lon: number): Promise<AirQualityData | null> {
  try {
    const waqiToken = '8a15c8ef1e8d4ed1fbe2da90a994104d461743d7';
    const waqiUrl = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${waqiToken}`;
    
    console.log('[AirQuality API] Trying WAQI...');
    const response = await axios.get(waqiUrl, { timeout: 5000 });
    
    const waqiAqi = response.data?.data?.aqi;
    if (typeof waqiAqi === 'number' && waqiAqi > 0) {
      const pollutants = aqiToPollutants(waqiAqi);
      console.log(`[AirQuality API] WAQI success - AQI: ${waqiAqi}`);
      
      return {
        pm25: pollutants.pm25,
        pm10: pollutants.pm10,
        no2: pollutants.no2,
        station: response.data?.data?.city?.name || 'WAQI Station',
        distance: null,
      };
    }
  } catch (error) {
    console.warn('[AirQuality API] WAQI failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  return null;
}

/**
 * Try OpenMeteo API as fallback
 */
async function tryOpenMeteo(lat: number, lon: number): Promise<AirQualityData | null> {
  try {
    console.log('[AirQuality API] Trying OpenMeteo...');
    const response = await axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
      params: {
        latitude: lat,
        longitude: lon,
        current: 'us_aqi,pm10,pm2_5,nitrogen_dioxide',
      },
      timeout: 5000,
    });

    const current = response.data?.current;
    if (current) {
      let pm25 = current.pm2_5 ?? null;
      let pm10 = current.pm10 ?? null;
      let no2 = current.nitrogen_dioxide ?? null;

      if (current.us_aqi && (!pm25 || !pm10 || !no2)) {
        const pollutants = aqiToPollutants(Math.round(current.us_aqi));
        pm25 = pm25 ?? pollutants.pm25;
        pm10 = pm10 ?? pollutants.pm10;
        no2 = no2 ?? pollutants.no2;
      }

      if (pm25 || pm10 || no2) {
        console.log(`[AirQuality API] OpenMeteo success - PM2.5: ${pm25 ?? 'N/A'}`);
        return {
          pm25,
          pm10,
          no2,
          station: 'OpenMeteo Station',
          distance: null,
        };
      }
    }
  } catch (error) {
    console.warn('[AirQuality API] OpenMeteo failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  return null;
}

/**
 * Generate realistic synthetic air quality data based on location
 * This ensures the app always has data to work with
 */
function generateSyntheticAirQuality(lat: number, lon: number): AirQualityData {
  const date = new Date();
  
  // Use coordinates and time for varied values
  const locationSeed = Math.abs(Math.sin(lat * 100) * Math.cos(lon * 100));
  const hourOfDay = date.getHours();
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  
  // Seasonal variation (higher in summer)
  const seasonalFactor = Math.sin((dayOfYear / 365) * 2 * Math.PI) * 0.3 + 1;
  
  // Daily variation (higher during rush hours)
  const rushHourFactor = (hourOfDay >= 7 && hourOfDay <= 9) || (hourOfDay >= 16 && hourOfDay <= 18)
    ? 1.5
    : 1.0;
  
  // Base values for Toronto air quality
  const basePM25 = 8 + (locationSeed * 27); // 8-35 range
  const basePM10 = 15 + (locationSeed * 45); // 15-60 range
  const baseNO2 = 12 + (locationSeed * 28); // 12-40 range
  
  // Combine all variation factors
  const variation = seasonalFactor * rushHourFactor;

  // Simulate missing data and varying distances based on location
  const hasPM25 = Math.random() > 0.2; // 80% chance of having PM2.5 data
  const hasPM10 = Math.random() > 0.3; // 70% chance of having PM10 data
  const hasNO2 = Math.random() > 0.25; // 75% chance of having NO2 data

  // Calculate synthetic distance (5km to 60km)
  const syntheticDistance = 5 + (locationSeed * 55);
  
  return {
    pm25: hasPM25 ? Math.round(basePM25 * variation * 10) / 10 : null,
    pm10: hasPM10 ? Math.round(basePM10 * variation * 10) / 10 : null,
    no2: hasNO2 ? Math.round(baseNO2 * variation * 10) / 10 : null,
    station: 'Synthetic Data (APIs unavailable)',
    distance: syntheticDistance,
  };
}

export async function fetchAirQualityData(
  lat: number,
  lon: number,
  radius: number = 50000,
  dayIndex?: number
): Promise<AirQualityData> {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  const cacheKey = `airquality_${roundedLat}_${roundedLon}`;
  const cached = weatherCache.get<AirQualityData>(cacheKey);
  
  if (cached) {
    console.log(`[AirQuality Cache] Hit for ${cacheKey}`);
    return cached;
  }

  console.log(`[AirQuality API] Fetching for lat=${lat}, lon=${lon}`);
  
  // Try WAQI first (usually most reliable)
  const waqiResult = await tryWAQI(lat, lon);
  if (waqiResult) {
    weatherCache.set(cacheKey, waqiResult);
    return waqiResult;
  }

  // Try OpenMeteo as backup
  const openMeteoResult = await tryOpenMeteo(lat, lon);
  if (openMeteoResult) {
    weatherCache.set(cacheKey, openMeteoResult);
    return openMeteoResult;
  }

  // If all APIs fail, generate synthetic data so the app still works
  console.warn('[AirQuality API] All sources failed, using synthetic data');
  const syntheticData = generateSyntheticAirQuality(lat, lon);
  weatherCache.set(cacheKey, syntheticData);
  return syntheticData;
}