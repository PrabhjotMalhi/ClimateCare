import { z } from "zod";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export const insertUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export interface User {
  id: string;
  username: string;
  password: string;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  windChill: number;
  precipitation: number;
}

export interface AirQualityData {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  station: string | null;
  distance: number | null;
}

export interface RiskIndices {
  hsi: number;
  csi: number;
  aqri: number;
  riskScore: number;
}

export interface RiskData extends RiskIndices {
  raw: {
    weather: WeatherData;
    airQuality: AirQualityData;
  };
  confidence: number;
  date: string;
}

export interface NeighborhoodProperties {
  name: string;
  population: number;
  seniorPercent: number;
  vulnerabilityScore: number;
  riskData?: RiskData;
  // Optional server-provided estimate of the number of people at risk in this neighborhood
  atRiskPopulation?: number;
  // Optional server-provided count of at-risk people when the calculated risk is high
  atRiskPopulationHigh?: number;
}

export type NeighborhoodFeature = Feature<Geometry, NeighborhoodProperties>;
export type NeighborhoodsGeoJSON = FeatureCollection<Geometry, NeighborhoodProperties>;

export interface CommunitySubmission {
  id: string;
  location: string;
  message: string;
  timestamp: string;
}

export const insertCommunitySubmissionSchema = z.object({
  location: z.string().min(1, "Location is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export type InsertCommunitySubmission = z.infer<typeof insertCommunitySubmissionSchema>;

export interface Alert {
  id: string;
  type: "heat" | "cold" | "air_quality";
  severity: "low" | "moderate" | "high" | "extreme";
  neighborhoods: string[];
  message: string;
  timestamp: string;
}

export interface RiskConfig {
  weights: {
    heat: number;
    cold: number;
    air: number;
  };
  thresholds: {
    hsi: number;
    csi: number;
    aqri: number;
  };
}
