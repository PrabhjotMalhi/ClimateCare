import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Layers } from "lucide-react";
import type { NeighborhoodsGeoJSON } from "@shared/schema";

interface RiskMapProps {
  neighborhoods: NeighborhoodsGeoJSON;
  colorblindMode?: boolean;
  selectedDate?: Date;
  onNeighborhoodClick?: (name: string) => void;
}

export default function RiskMap({ 
  neighborhoods, 
  colorblindMode = false,
  onNeighborhoodClick 
}: RiskMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [zoom, setZoom] = useState(12);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const bounds = new maplibregl.LngLatBounds();
    neighborhoods.features.forEach((feature) => {
      if (feature.geometry.type === "Polygon") {
        feature.geometry.coordinates[0].forEach((coord) => {
          bounds.extend(coord as [number, number]);
        });
      }
    });

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap Contributors",
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: bounds.getCenter().toArray() as [number, number],
      zoom: 12,
    });

    map.current.fitBounds(bounds, { padding: 50 });

    map.current.on("load", () => {
      if (!map.current) return;

      map.current.addSource("neighborhoods", {
        type: "geojson",
        data: neighborhoods,
      });

      map.current.addLayer({
        id: "neighborhoods-fill",
        type: "fill",
        source: "neighborhoods",
        paint: {
          "fill-color": [
            "case",
            ["has", "riskScore", ["get", "riskData"]],
            [
              "interpolate",
              ["linear"],
              ["get", "riskScore", ["get", "riskData"]],
              0, colorblindMode ? "#0571b0" : "#22c55e",
              25, colorblindMode ? "#92c5de" : "#84cc16",
              50, colorblindMode ? "#f7f7f7" : "#eab308",
              75, colorblindMode ? "#f4a582" : "#f97316",
              100, colorblindMode ? "#ca0020" : "#dc2626"
            ],
            // Default color if no risk data
            "#cccccc"
          ],
          "fill-opacity": 0.6,
        },
      });

      map.current.addLayer({
        id: "neighborhoods-outline",
        type: "line",
        source: "neighborhoods",
        paint: {
          "line-color": "#000000",
          "line-width": 2,
        },
      });

      map.current.on("click", "neighborhoods-fill", (e) => {
        if (e.features && e.features[0]) {
          const properties = e.features[0].properties;
          const name = properties?.name || 'Unknown';
          
          if (onNeighborhoodClick) {
            onNeighborhoodClick(name);
          }
          
          // Parse riskData if it's a string
          let riskData;
          try {
            riskData = properties?.riskData ? 
              (typeof properties.riskData === 'string' ? JSON.parse(properties.riskData) : properties.riskData) 
              : null;
          } catch (e) {
            riskData = null;
          }
          
          const riskScore = riskData?.riskScore ?? 'N/A';
          const hsi = riskData?.hsi ?? 'N/A';
          const csi = riskData?.csi ?? 'N/A';
          const aqri = riskData?.aqri ?? 'N/A';
          const confidence = riskData?.confidence ?? 'N/A';
          const temp = riskData?.raw?.weather?.temperature ?? 'N/A';
          const pm25 = riskData?.raw?.airQuality?.pm25 ?? 'N/A';
          
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="p-3 min-w-[200px]">
                <h3 class="font-bold text-base mb-2">${name}</h3>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Risk Score:</span>
                    <span class="font-semibold">${riskScore}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Temperature:</span>
                    <span>${temp !== 'N/A' ? temp + '°C' : 'N/A'}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">PM2.5:</span>
                    <span>${pm25 !== 'N/A' ? pm25 + ' µg/m³' : 'N/A'}</span>
                  </div>
                  <hr class="my-2">
                  <div class="flex justify-between text-xs">
                    <span class="text-gray-500">HSI:</span>
                    <span>${hsi}</span>
                  </div>
                  <div class="flex justify-between text-xs">
                    <span class="text-gray-500">CSI:</span>
                    <span>${csi}</span>
                  </div>
                  <div class="flex justify-between text-xs">
                    <span class="text-gray-500">AQRI:</span>
                    <span>${aqri}</span>
                  </div>
                  <div class="flex justify-between text-xs">
                    <span class="text-gray-500">Confidence:</span>
                    <span>${confidence !== 'N/A' ? confidence + '%' : 'N/A'}</span>
                  </div>
                </div>
              </div>
            `)
            .addTo(map.current!);
        }
      });

      map.current.on("mouseenter", "neighborhoods-fill", () => {
        if (map.current) map.current.getCanvas().style.cursor = "pointer";
      });

      map.current.on("mouseleave", "neighborhoods-fill", () => {
        if (map.current) map.current.getCanvas().style.cursor = "";
      });
    });

    map.current.on("zoom", () => {
      if (map.current) setZoom(Math.round(map.current.getZoom()));
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (map.current && map.current.getSource("neighborhoods")) {
      // Filter neighborhoods based on zoom level
      const filteredNeighborhoods = {
        ...neighborhoods,
        features: neighborhoods.features.filter((feature, index) => {
          if (zoom >= 12) return true;
          if (zoom >= 10) return index % 2 === 0;
          if (zoom >= 8) return index % 3 === 0;
          return index % 5 === 0;
        })
      };
      
      (map.current.getSource("neighborhoods") as maplibregl.GeoJSONSource).setData(filteredNeighborhoods);
      
      if (map.current.getPaintProperty("neighborhoods-fill", "fill-color")) {
        map.current.setPaintProperty("neighborhoods-fill", "fill-color", [
          "case",
          ["has", "riskScore", ["get", "riskData"]],
          [
            "interpolate",
            ["linear"],
            ["get", "riskScore", ["get", "riskData"]],
            0, colorblindMode ? "#0571b0" : "#22c55e",
            25, colorblindMode ? "#92c5de" : "#84cc16",
            50, colorblindMode ? "#f7f7f7" : "#eab308",
            75, colorblindMode ? "#f4a582" : "#f97316",
            100, colorblindMode ? "#ca0020" : "#dc2626"
          ],
          "#cccccc"
        ]);
      }
    }
  }, [neighborhoods, colorblindMode, zoom]);

  const handleZoomIn = () => {
    map.current?.zoomIn();
  };

  const handleZoomOut = () => {
    map.current?.zoomOut();
  };

  return (
    <div className="relative w-full h-full" data-testid="container-risk-map">
      <div ref={mapContainer} className="w-full h-[300px] md:h-full rounded-md" />
      
      <div className="absolute top-4 right-4 flex flex-row md:flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomIn}
          data-testid="button-zoom-in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomOut}
          data-testid="button-zoom-out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          data-testid="button-layers"
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      <Card className="absolute bottom-4 left-4 p-2 bg-background/95 backdrop-blur">
        <p className="text-xs font-mono">Zoom: {zoom}</p>
      </Card>
    </div>
  );
}