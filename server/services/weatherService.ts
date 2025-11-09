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
    // Try NASA POWER as a fallback
    try {
      console.log('[Weather API] Falling back to NASA POWER API');
      const nasaData = await fetchWeatherDataFromNASA(lat, lon, days);
      weatherCache.set(cacheKey, nasaData);
      return nasaData;
    } catch (nasaError) {
      console.error('[Weather API] NASA POWER fallback failed:', nasaError);
      throw error; // rethrow original Open-Meteo error
    }
  }
}

/**
 * Fetch weather-like data from NASA POWER API and map to OpenMeteoResponse shape.
 * Note: NASA POWER returns daily values; we approximate hourly arrays by repeating
 * daily values for each hour so downstream code that expects hourly arrays can work.
 *
 * Under-specification note: NASA POWER parameter names may vary; this implementation
 * uses commonly available parameters and falls back to reasonable defaults when missing.
 */
export async function fetchWeatherDataFromNASA(
  lat: number,
  lon: number,
  days: number = 7
): Promise<OpenMeteoResponse> {
  // Build date range for NASA POWER (YYYYMMDD)
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(0, days - 1));

  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start: formatYMD(start),
    end: formatYMD(end),
    // Request a small set of commonly useful parameters
    parameters: 'T2M,T2M_MAX,T2M_MIN,WS2M,PRECTOT,ALLSKY_SFC_UV_INDEX',
    community: 'AG',
    format: 'JSON',
  });

  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?${params}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`NASA POWER API error: ${resp.status}`);
  }

  const json = await resp.json();

  // Navigate the JSON structure. NASA POWER returns an object with properties:
  // properties: { parameter: { PARAM_NAME: { 'YYYYMMDD': value } }, .. }
  const parameterObj = json?.properties?.parameter || json?.parameters || {};

  // Build arrays for daily values
  const time: string[] = [];
  const tmax: number[] = [];
  const tmin: number[] = [];
  const uv: number[] = [];
  const pr: number[] = [];
  const wsDaily: number[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    time.push(iso);

    const key = formatYMD(d);

    const t2mMax = parameterObj?.T2M_MAX?.[key] ?? parameterObj?.T2M?.[key] ?? null;
    const t2mMin = parameterObj?.T2M_MIN?.[key] ?? parameterObj?.T2M?.[key] ?? null;
    const uvIndex = parameterObj?.ALLSKY_SFC_UV_INDEX?.[key] ?? null;
    const precip = parameterObj?.PRECTOT?.[key] ?? 0;
    const wind = parameterObj?.WS2M?.[key] ?? 0;

    tmax.push(t2mMax !== null ? Number(t2mMax) : 25);
    tmin.push(t2mMin !== null ? Number(t2mMin) : 15);
    uv.push(uvIndex !== null ? Number(uvIndex) : 5);
    pr.push(Number(precip));
    wsDaily.push(Number(wind));
  }

  // Approximate hourly arrays by repeating daily values for each of 24 hours
  const hourlyTime: string[] = [];
  const temperature_2m: number[] = [];
  const relative_humidity_2m: number[] = [];
  const wind_speed_10m: number[] = [];
  const precipitationHourly: number[] = [];

  for (let day = 0; day < days; day++) {
    for (let h = 0; h < 24; h++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + day);
      dt.setHours(h, 0, 0, 0);
      hourlyTime.push(dt.toISOString());

      // Use average of tmax/tmin as approximate hourly temperature
      const tAvg = (tmax[day] + tmin[day]) / 2;
      temperature_2m.push(Math.round(tAvg * 10) / 10);

      // NASA POWER does not always provide humidity; use a reasonable default of 50%
      relative_humidity_2m.push(50);

      // Use daily wind repeated as hourly
      wind_speed_10m.push(wsDaily[day]);

      // Distribute daily precipitation evenly across hours as an approximation
      precipitationHourly.push(Number((pr[day] / 24).toFixed(3)));
    }
  }

  const mapped: OpenMeteoResponse = {
    latitude: lat,
    longitude: lon,
    daily: {
      time,
      temperature_2m_max: tmax,
      temperature_2m_min: tmin,
      uv_index_max: uv,
      precipitation_sum: pr,
    },
    hourly: {
      time: hourlyTime,
      temperature_2m: temperature_2m,
      relative_humidity_2m: relative_humidity_2m,
      wind_speed_10m: wind_speed_10m,
      precipitation: precipitationHourly,
    },
  };

  return mapped;
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
