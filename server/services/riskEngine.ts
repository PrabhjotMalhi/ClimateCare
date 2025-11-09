import type { WeatherData, AirQualityData, RiskIndices, RiskData, RiskConfig } from "@shared/schema";

export const defaultRiskConfig: RiskConfig = {
  weights: {
    heat: 0.4,
    cold: 0.3,
    air: 0.3,
  },
  thresholds: {
    hsi: 70,
    csi: 60,
    aqri: 65,
  },
};

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

export function calculateHeatStressIndex(
  weather: WeatherData,
  tempAnomaly: number = 0
): number {
  const tempScore = normalize(weather.temperature, 0, 45);
  
  const humidityScore = normalize(weather.humidity, 0, 100);
  
  const anomalyScore = normalize(tempAnomaly, -3, 3);

  const hsi = (
    tempScore * 0.5 +
    humidityScore * 0.3 +
    anomalyScore * 0.2
  );

  return Math.round(hsi);
}

export function calculateColdStressIndex(
  weather: WeatherData,
  snowCoverScore: number = 0
): number {
  const minTempScore = normalize(Math.abs(weather.windChill - 20), 0, 40);
  
  const windChillScore = normalize(Math.abs(weather.windChill), 0, 20);
  
  const snowScore = snowCoverScore;

  const csi = (
    minTempScore * 0.6 +
    windChillScore * 0.3 +
    snowScore * 0.1
  );

  return Math.round(csi);
}

export function calculateAirQualityRiskIndex(
  airQuality: AirQualityData
): number {
  if (!airQuality.pm25 && !airQuality.pm10 && !airQuality.no2) {
    return 0;
  }

  const pm25Score = airQuality.pm25 !== null
    ? normalize(airQuality.pm25, 0, 250)
    : 0;
  
  const pm10Score = airQuality.pm10 !== null
    ? normalize(airQuality.pm10, 0, 350)
    : 0;
  
  const no2Score = airQuality.no2 !== null
    ? normalize(airQuality.no2, 0, 200)
    : 0;

  const hasData = [
    airQuality.pm25 !== null,
    airQuality.pm10 !== null,
    airQuality.no2 !== null,
  ];
  const dataCount = hasData.filter(Boolean).length;

  if (dataCount === 0) return 0;

  const weights = {
    pm25: airQuality.pm25 !== null ? 0.5 : 0,
    pm10: airQuality.pm10 !== null ? 0.3 : 0,
    no2: airQuality.no2 !== null ? 0.2 : 0,
  };

  const totalWeight = weights.pm25 + weights.pm10 + weights.no2;
  const normalizedWeights = {
    pm25: weights.pm25 / totalWeight,
    pm10: weights.pm10 / totalWeight,
    no2: weights.no2 / totalWeight,
  };

  const aqri = (
    pm25Score * normalizedWeights.pm25 +
    pm10Score * normalizedWeights.pm10 +
    no2Score * normalizedWeights.no2
  );

  return Math.round(aqri);
}

export function calculateRiskScore(
  indices: RiskIndices,
  config: RiskConfig = defaultRiskConfig
): number {
  // Get the maximum between heat and cold stress indices
  const tempStress = Math.max(indices.hsi, indices.csi);
  
  // Final score is 85% from dominant temperature stress and 15% from air quality
  const riskScore = (tempStress * 0.85) + (indices.aqri * 0.15);

  return Math.round(riskScore);
}

export function calculateDataConfidence(
  weather: WeatherData,
  airQuality: AirQualityData
): number {
  let confidence = 100;

  if (!airQuality.pm25 && !airQuality.pm10 && !airQuality.no2) {
    confidence -= 30;
  } else {
    if (!airQuality.pm25) confidence -= 10;
    if (!airQuality.pm10) confidence -= 10;
    if (!airQuality.no2) confidence -= 10;
  }

  if (airQuality.distance && airQuality.distance > 25) {
    confidence -= 15;
  } else if (airQuality.distance && airQuality.distance > 50) {
    confidence -= 25;
  }

  return Math.max(0, confidence);
}

export function calculateCompleteRisk(
  weather: WeatherData,
  airQuality: AirQualityData,
  tempAnomaly: number = 0,
  snowCoverScore: number = 0,
  date: string = new Date().toISOString(),
  config: RiskConfig = defaultRiskConfig
): RiskData {
  const hsi = calculateHeatStressIndex(weather, tempAnomaly);
  const csi = calculateColdStressIndex(weather, snowCoverScore);
  const aqri = calculateAirQualityRiskIndex(airQuality);

  const indices: RiskIndices = { hsi, csi, aqri, riskScore: 0 };
  const riskScore = calculateRiskScore(indices, config);
  
  const confidence = calculateDataConfidence(weather, airQuality);

  return {
    hsi,
    csi,
    aqri,
    riskScore,
    raw: {
      weather,
      airQuality,
    },
    confidence,
    date,
  };
}
