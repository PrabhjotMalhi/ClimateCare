import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchWeatherData, processWeatherForRisk } from "./services/weatherService";
import { fetchAirQualityData } from "./services/airQualityService";
import { calculateCompleteRisk, defaultRiskConfig } from "./services/riskEngine";
import { insertCommunitySubmissionSchema, type NeighborhoodsGeoJSON } from "@shared/schema";
import { webPushService } from "./services/webPushService";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

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

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/neighborhoods", async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString();
      const dayIndex = req.query.dayIndex ? parseInt(req.query.dayIndex as string) : 0;

      // If grid=true is provided, generate a regular grid over the GTA bounding box
      // This allows rendering a uniform set of risk zones covering the whole area
      const useGrid = req.query.grid === 'true';
      const cellSize = req.query.cellSize ? parseFloat(req.query.cellSize as string) : 0.02; // degrees

      if (useGrid) {
        // Bounding box roughly covering the Greater Toronto Area
        const west = -79.7;
        const east = -79.0;
        const south = 43.55;
        const north = 43.92;

        const features = [] as any[];
        let id = 0;
        for (let lon = west; lon < east; lon += cellSize) {
          for (let lat = south; lat < north; lat += cellSize) {
            const lon2 = Math.min(lon + cellSize, east);
            const lat2 = Math.min(lat + cellSize, north);
            const polygon = [
              [
                [lon, lat],
                [lon2, lat],
                [lon2, lat2],
                [lon, lat2],
                [lon, lat]
              ]
            ];

            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: polygon },
              properties: {
                name: `GTA Cell ${id}`,
                population: 0,
                seniorPercent: 15,
                vulnerabilityScore: 0,
              }
            });
            id++;
          }
        }

        // Enrich grid features in batches to avoid overwhelming external APIs
        const batchSize = 8;
        const enrichedFeatures: any[] = [];
        for (let i = 0; i < features.length; i += batchSize) {
          const batch = features.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(async (feature) => {
            try {
              const coords = feature.geometry.coordinates as number[][][];
              const [lonC, latC] = getCentroid(coords);
              const [weatherData, airQuality] = await Promise.all([
                fetchWeatherData(latC, lonC, 7),
                fetchAirQualityData(latC, lonC, 50000, dayIndex)
              ]);
              const weather = processWeatherForRisk(weatherData, dayIndex);
              const riskData = calculateCompleteRisk(weather, airQuality, 0, 0, date, defaultRiskConfig);
              return { ...feature, properties: { ...feature.properties, riskData } };
            } catch (error) {
              console.error('Error calculating risk for grid cell:', error);
              return { ...feature, properties: { ...feature.properties, riskData: undefined } };
            }
          }));
          enrichedFeatures.push(...batchResults);
        }

        const geojson = { type: 'FeatureCollection', features: enrichedFeatures } as any;
        return res.json(geojson);
      }

      // Default behavior: return stored neighborhoods enriched with risk
      const neighborhoods = await storage.getNeighborhoods();
      
      // Process neighborhoods in parallel batches to avoid blocking
      const batchSize = 10;
      const features = neighborhoods.features;
      const enrichedFeatures = [];

      for (let i = 0; i < features.length; i += batchSize) {
        const batch = features.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (feature) => {
            try {
              if (feature.geometry.type !== "Polygon") {
                return { ...feature, properties: { ...feature.properties, riskData: undefined } };
              }

              const [lon, lat] = getCentroid(feature.geometry.coordinates);
              
              // Fetch weather and air quality in parallel
              const [weatherData, airQuality] = await Promise.all([
                fetchWeatherData(lat, lon, 7),
                fetchAirQualityData(lat, lon, 50000, dayIndex)
              ]);
              
              const weather = processWeatherForRisk(weatherData, dayIndex);
              
              const riskData = calculateCompleteRisk(
                weather,
                airQuality,
                0,
                0,
                date,
                defaultRiskConfig
              );

              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  riskData,
                },
              };
            } catch (error) {
              console.error(`Error calculating risk for ${feature.properties.name}:`, error);
              return { ...feature, properties: { ...feature.properties, riskData: undefined } };
            }
          })
        );
        enrichedFeatures.push(...batchResults);
      }

      const enrichedNeighborhoods: NeighborhoodsGeoJSON = {
        ...neighborhoods,
        features: enrichedFeatures,
      };

      res.json(enrichedNeighborhoods);
    } catch (error) {
      console.error("Error fetching neighborhoods:", error);
      res.status(500).json({ error: "Failed to fetch neighborhoods" });
    }
  });

  app.get("/api/risk", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const date = (req.query.date as string) || new Date().toISOString();
      const dayIndex = req.query.dayIndex ? parseInt(req.query.dayIndex as string) : 0;

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "Invalid latitude or longitude" });
      }

      const weatherData = await fetchWeatherData(lat, lon, 7);
      const weather = processWeatherForRisk(weatherData, dayIndex);
      const airQuality = await fetchAirQualityData(lat, lon);

      const riskData = calculateCompleteRisk(
        weather,
        airQuality,
        0,
        0,
        date,
        defaultRiskConfig
      );

      res.json(riskData);
    } catch (error) {
      console.error("Error calculating risk:", error);
      res.status(500).json({ error: "Failed to calculate risk" });
    }
  });

  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      await storage.removeAlert(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing alert:", error);
      res.status(500).json({ error: "Failed to remove alert" });
    }
  });

  app.post("/api/alerts/test", async (req, res) => {
    try {
      const alert = await storage.addAlert({
        type: "heat",
        severity: "high",
        neighborhoods: ["Downtown", "Riverside"],
        message: "Test alert: High temperature warning for testing purposes.",
      });
      res.json(alert);
    } catch (error) {
      console.error("Error creating test alert:", error);
      res.status(500).json({ error: "Failed to create test alert" });
    }
  });

  app.get("/api/community/submissions", async (req, res) => {
    try {
      const submissions = await storage.getCommunitySubmissions();
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching community submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  app.post("/api/community/submissions", async (req, res) => {
    try {
      const validatedData = insertCommunitySubmissionSchema.parse(req.body);
      const submission = await storage.addCommunitySubmission(validatedData);
      res.json(submission);
    } catch (error) {
      console.error("Error creating community submission:", error);
      res.status(400).json({ error: "Invalid submission data" });
    }
  });

  app.post("/api/neighborhoods/upload", upload.single("geojson"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const geojsonData = JSON.parse(req.file.buffer.toString("utf-8"));
      
      if (geojsonData.type !== "FeatureCollection" || !Array.isArray(geojsonData.features)) {
        return res.status(400).json({ error: "Invalid GeoJSON format" });
      }

      await storage.setNeighborhoods(geojsonData);
      res.json({ success: true, message: "Neighborhoods updated successfully" });
    } catch (error) {
      console.error("Error uploading GeoJSON:", error);
      res.status(500).json({ error: "Failed to upload GeoJSON" });
    }
  });

  app.get("/api/push/publickey", (req, res) => {
    res.json({ publicKey: webPushService.getPublicKey() });
  });

  app.post("/api/push/subscribe", (req, res) => {
    try {
      webPushService.addSubscription(req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  app.post("/api/push/unsubscribe", (req, res) => {
    try {
      webPushService.removeSubscription(req.body.endpoint);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  app.post("/api/push/send-test", async (req, res) => {
    try {
      const count = await webPushService.sendNotification(
        "ClimateCare AI Test Alert",
        "This is a test notification from ClimateCare AI.",
        { test: true }
      );
      res.json({ success: true, sent: count });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ error: "Failed to send test notification" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
