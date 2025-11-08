import type { WeatherData } from "@shared/schema";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class WeatherCache {
  private cache = new Map<string, CacheEntry<any>>();
  private ttl: number;

  constructor(ttlMinutes: number = 15) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const weatherCache = new WeatherCache(15);

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    wind_speed_10m: number[];
    precipitation: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    uv_index_max: number[];
    precipitation_sum: number[];
  };
}

export async function fetchWeatherData(
  lat: number,
  lon: number,
  days: number = 7
): Promise<OpenMeteoResponse> {
  const cacheKey = `weather_${lat}_${lon}_${days}`;
  const cached = weatherCache.get<OpenMeteoResponse>(cacheKey);
  
  if (cached) {
    console.log(`[Weather Cache] Hit for ${cacheKey}`);
    return cached;
  }

  console.log(`[Weather API] Fetching for lat=${lat}, lon=${lon}, days=${days}`);
  
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum',
    forecast_days: days.toString(),
    timezone: 'auto',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }
    
    const data: OpenMeteoResponse = await response.json();
    weatherCache.set(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error('[Weather API] Error:', error);
    throw error;
  }
}

export function processWeatherForRisk(
  data: OpenMeteoResponse,
  dayIndex: number = 0
): WeatherData {
  const daily = data.daily;
  const hourly = data.hourly;
  
  if (!daily || !hourly) {
    throw new Error('Invalid weather data structure');
  }

  const maxTemp = daily.temperature_2m_max[dayIndex] || 25;
  const minTemp = daily.temperature_2m_min[dayIndex] || 15;
  const uvIndex = daily.uv_index_max[dayIndex] || 5;
  
  const currentHourIndex = Math.min(dayIndex * 24, hourly.time.length - 1);
  const humidity = hourly.relative_humidity_2m[currentHourIndex] || 50;
  const windSpeed = hourly.wind_speed_10m[currentHourIndex] || 10;
  const precipitation = daily.precipitation_sum[dayIndex] || 0;

  const windChill = minTemp - (windSpeed * 0.5);

  return {
    temperature: maxTemp,
    humidity,
    windSpeed,
    uvIndex,
    windChill,
    precipitation,
  };
}

export function calculateTemperatureAnomaly(
  currentTemp: number,
  recentTemps: number[]
): number {
  if (recentTemps.length < 3) return 0;
  
  const mean = recentTemps.reduce((a, b) => a + b, 0) / recentTemps.length;
  const variance = recentTemps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / recentTemps.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  return (currentTemp - mean) / stdDev;
}
