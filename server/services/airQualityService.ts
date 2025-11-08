import type { AirQualityData } from "@shared/schema";
import { weatherCache } from "./weatherService";

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

export async function fetchAirQualityData(
  lat: number,
  lon: number,
  radius: number = 50000
): Promise<AirQualityData> {
  const cacheKey = `airquality_${lat}_${lon}`;
  const cached = weatherCache.get<AirQualityData>(cacheKey);
  
  if (cached) {
    console.log(`[AirQuality Cache] Hit for ${cacheKey}`);
    return cached;
  }

  console.log(`[AirQuality API] Fetching for lat=${lat}, lon=${lon}`);
  
  const params = new URLSearchParams({
    limit: '100',
    page: '1',
    offset: '0',
    sort: 'desc',
    coordinates: `${lat},${lon}`,
    radius: radius.toString(),
    order_by: 'lastUpdated',
  });

  const url = `https://api.openaq.org/v2/locations?${params}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.warn(`[AirQuality API] Error ${response.status}, using fallback`);
      return getFallbackAirQuality();
    }
    
    const data: OpenAQResponse = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.warn('[AirQuality API] No stations found, using fallback');
      return getFallbackAirQuality();
    }

    let nearestStation = data.results[0];
    let minDistance = calculateDistance(
      lat,
      lon,
      nearestStation.coordinates.latitude,
      nearestStation.coordinates.longitude
    );

    for (const station of data.results) {
      const distance = calculateDistance(
        lat,
        lon,
        station.coordinates.latitude,
        station.coordinates.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = station;
      }
    }

    const params2 = new URLSearchParams({
      limit: '100',
      page: '1',
      offset: '0',
      sort: 'desc',
      location_id: nearestStation.id.toString(),
      order_by: 'datetime',
    });

    const measurementsUrl = `https://api.openaq.org/v2/measurements?${params2}`;
    const measurementsResponse = await fetch(measurementsUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });

    let pm25: number | null = null;
    let pm10: number | null = null;
    let no2: number | null = null;

    if (measurementsResponse.ok) {
      const measurementsData: { results: OpenAQMeasurement[] } = await measurementsResponse.json();
      
      for (const measurement of measurementsData.results) {
        if (measurement.parameter === 'pm25' && pm25 === null) {
          pm25 = measurement.value;
        } else if (measurement.parameter === 'pm10' && pm10 === null) {
          pm10 = measurement.value;
        } else if (measurement.parameter === 'no2' && no2 === null) {
          no2 = measurement.value;
        }
      }
    }

    const result: AirQualityData = {
      pm25,
      pm10,
      no2,
      station: nearestStation.name,
      distance: minDistance,
    };

    weatherCache.set(cacheKey, result);
    return result;
    
  } catch (error) {
    console.error('[AirQuality API] Error:', error);
    return getFallbackAirQuality();
  }
}

function getFallbackAirQuality(): AirQualityData {
  return {
    pm25: null,
    pm10: null,
    no2: null,
    station: null,
    distance: null,
  };
}
