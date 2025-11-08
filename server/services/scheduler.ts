import cron from "node-cron";
import { storage } from "../storage";
import { fetchWeatherData, processWeatherForRisk } from "./weatherService";
import { fetchAirQualityData } from "./airQualityService";
import { calculateCompleteRisk, defaultRiskConfig } from "./riskEngine";
import type { Alert } from "@shared/schema";

interface RiskThresholds {
  hsi: number;
  csi: number;
  aqri: number;
}

const thresholds: RiskThresholds = {
  hsi: 70,
  csi: 60,
  aqri: 65,
};

function getCentroid(coordinates: number[][][]): [number, number] {
  let sumLat = 0;
  let sumLon = 0;
  let count = 0;

  for (const ring of coordinates) {
    for (const coord of ring) {
      sumLon += coord[0];
      sumLat += coord[1];
      count++;
    }
  }

  return [sumLon / count, sumLat / count];
}

export async function calculateDailyRisks(): Promise<void> {
  console.log('[Scheduler] Running daily risk calculation...');
  
  try {
    const neighborhoods = await storage.getNeighborhoods();
    const highRiskNeighborhoods: { [key: string]: string[] } = {
      heat: [],
      cold: [],
      air_quality: [],
    };

    for (const feature of neighborhoods.features) {
      if (feature.geometry.type !== "Polygon") continue;

      const [lon, lat] = getCentroid(feature.geometry.coordinates);
      const name = feature.properties.name;

      try {
        const weatherData = await fetchWeatherData(lat, lon, 7);
        const weather = processWeatherForRisk(weatherData, 0);
        const airQuality = await fetchAirQualityData(lat, lon);

        const riskData = calculateCompleteRisk(
          weather,
          airQuality,
          0,
          0,
          new Date().toISOString(),
          defaultRiskConfig
        );

        if (riskData.hsi >= thresholds.hsi) {
          highRiskNeighborhoods.heat.push(name);
        }
        if (riskData.csi >= thresholds.csi) {
          highRiskNeighborhoods.cold.push(name);
        }
        if (riskData.aqri >= thresholds.aqri) {
          highRiskNeighborhoods.air_quality.push(name);
        }

        console.log(`[Scheduler] ${name}: HSI=${riskData.hsi}, CSI=${riskData.csi}, AQRI=${riskData.aqri}, Risk=${riskData.riskScore}`);
      } catch (error) {
        console.error(`[Scheduler] Error processing ${name}:`, error);
      }
    }

    if (highRiskNeighborhoods.heat.length > 0) {
      const severity = highRiskNeighborhoods.heat.length >= 3 ? "extreme" : "high";
      await storage.addAlert({
        type: "heat",
        severity,
        neighborhoods: highRiskNeighborhoods.heat,
        message: `High heat stress detected in ${highRiskNeighborhoods.heat.length} neighborhood(s). Heat Stress Index above ${thresholds.hsi}.`,
      });
      console.log(`[Scheduler] Created heat stress alert for ${highRiskNeighborhoods.heat.join(', ')}`);
    }

    if (highRiskNeighborhoods.cold.length > 0) {
      const severity = highRiskNeighborhoods.cold.length >= 3 ? "extreme" : "high";
      await storage.addAlert({
        type: "cold",
        severity,
        neighborhoods: highRiskNeighborhoods.cold,
        message: `High cold stress detected in ${highRiskNeighborhoods.cold.length} neighborhood(s). Cold Stress Index above ${thresholds.csi}.`,
      });
      console.log(`[Scheduler] Created cold stress alert for ${highRiskNeighborhoods.cold.join(', ')}`);
    }

    if (highRiskNeighborhoods.air_quality.length > 0) {
      const severity = highRiskNeighborhoods.air_quality.length >= 3 ? "extreme" : "high";
      await storage.addAlert({
        type: "air_quality",
        severity,
        neighborhoods: highRiskNeighborhoods.air_quality,
        message: `Poor air quality detected in ${highRiskNeighborhoods.air_quality.length} neighborhood(s). Air Quality Risk Index above ${thresholds.aqri}.`,
      });
      console.log(`[Scheduler] Created air quality alert for ${highRiskNeighborhoods.air_quality.join(', ')}`);
    }

    console.log('[Scheduler] Daily risk calculation completed');
  } catch (error) {
    console.error('[Scheduler] Error in daily risk calculation:', error);
  }
}

export function startScheduler(): void {
  cron.schedule('0 6 * * *', calculateDailyRisks);
  console.log('[Scheduler] Daily risk calculation scheduled for 6:00 AM');

  console.log('[Scheduler] Running initial risk calculation...');
  calculateDailyRisks();
}
