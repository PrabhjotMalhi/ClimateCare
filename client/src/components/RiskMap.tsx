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
            "interpolate",
            ["linear"],
            ["get", "riskScore", ["get", "riskData"]],
            0, colorblindMode ? "#0571b0" : "#22c55e",
            25, colorblindMode ? "#92c5de" : "#84cc16",
            50, colorblindMode ? "#f7f7f7" : "#eab308",
            75, colorblindMode ? "#f4a582" : "#f97316",
            100, colorblindMode ? "#ca0020" : "#dc2626"
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
          const props = e.features[0].properties || {};
          const name = props.name as string | undefined;
          if (name && onNeighborhoodClick) {
            onNeighborhoodClick(name);
          }

          // Extract riskData safely. Map libraries sometimes stringify nested objects
          // when serializing feature properties, so handle both object and string cases.
          let riskScoreDisplay: string | number = 'N/A';
          try {
            const raw = props.riskData as any;
            let parsed = raw;
            if (typeof raw === 'string') {
              parsed = JSON.parse(raw);
            }

            if (parsed && parsed.riskScore !== undefined && parsed.riskScore !== null) {
              // Keep numeric values as-is so 0 displays correctly
              riskScoreDisplay = parsed.riskScore;
            }
          } catch (err) {
            // ignore parse errors and keep 'N/A'
          }

          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="p-2">
                <h3 class="font-bold">${name ?? ''}</h3>
                <p class="text-sm">Risk Score: ${riskScoreDisplay}</p>
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
      // At lower zoom levels, show fewer neighborhoods to improve performance
      const filteredNeighborhoods = {
        ...neighborhoods,
        features: neighborhoods.features.filter((feature, index) => {
          // Show all neighborhoods at zoom >= 12
          if (zoom >= 12) return true;
          // At lower zoom levels, show every Nth neighborhood based on zoom
          // This creates a deterministic pattern that changes with zoom
          if (zoom >= 10) return index % 2 === 0; // Show every other at zoom 10-11
          if (zoom >= 8) return index % 3 === 0; // Show every 3rd at zoom 8-9
          return index % 5 === 0; // Show every 5th at zoom < 8
        })
      };
      
      (map.current.getSource("neighborhoods") as maplibregl.GeoJSONSource).setData(filteredNeighborhoods);
      
      if (map.current.getPaintProperty("neighborhoods-fill", "fill-color")) {
        map.current.setPaintProperty("neighborhoods-fill", "fill-color", [
          "interpolate",
          ["linear"],
          ["get", "riskScore", ["get", "riskData"]],
          0, colorblindMode ? "#0571b0" : "#22c55e",
          25, colorblindMode ? "#92c5de" : "#84cc16",
          50, colorblindMode ? "#f7f7f7" : "#eab308",
          75, colorblindMode ? "#f4a582" : "#f97316",
          100, colorblindMode ? "#ca0020" : "#dc2626"
        ]);
      }
      // Recalculate bounds to fit the newly provided neighborhoods (use filtered list to avoid very large bounds inflation)
      try {
        const bounds = new maplibregl.LngLatBounds();
        filteredNeighborhoods.features.forEach((feature) => {
          if (feature.geometry?.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach((coord: number[]) => bounds.extend(coord as [number, number]));
          }
        });

        // Only fit if bounds are valid
        if (!bounds.isEmpty()) {
          map.current.fitBounds(bounds, { padding: 50 });
        }
      } catch (err) {
        // ignore bounds errors
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
      <div ref={mapContainer} className="w-full h-full rounded-md" />
      
      <div className="absolute top-4 right-4 flex flex-col gap-2">
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
