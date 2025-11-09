import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface RiskScoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RiskScoreModal({ open, onOpenChange }: RiskScoreModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="modal-risk-score">
        <DialogHeader>
          <DialogTitle className="text-2xl">How Climate Health Risk is Calculated</DialogTitle>
          <DialogDescription>
            Understanding the three components of our risk scoring system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-red-500">HSI</Badge>
              <h3 className="text-lg font-semibold">Heat Stress Index</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Combines maximum daily temperature, humidity levels, and recent temperature anomalies to assess heat-related health risks.
            </p>
            <div className="bg-muted p-4 rounded-md font-mono text-xs">
              <div>HSI = normalize(</div>
              <div className="ml-4">max_temp_score × 0.5 +</div>
              <div className="ml-4">humidity_score × 0.3 +</div>
              <div className="ml-4">temp_anomaly_zscore × 0.2</div>
              <div>)</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500">CSI</Badge>
              <h3 className="text-lg font-semibold">Cold Stress Index</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Evaluates minimum temperatures, wind chill effects, and snow cover persistence to assess cold-related health risks.
            </p>
            <div className="bg-muted p-4 rounded-md font-mono text-xs">
              <div>CSI = normalize(</div>
              <div className="ml-4">min_temp_score × 0.6 +</div>
              <div className="ml-4">wind_chill_score × 0.3 +</div>
              <div className="ml-4">snow_cover_score × 0.1</div>
              <div>)</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-500">AQRI</Badge>
              <h3 className="text-lg font-semibold">Air Quality Risk Index (Weight: 15%)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on PM2.5, PM10, and NO₂ concentrations from nearest monitoring stations.
            </p>
            <div className="bg-muted p-4 rounded-md font-mono text-xs">
              <div>AQRI = normalize(</div>
              <div className="ml-4">pm25_score × 0.5 +</div>
              <div className="ml-4">pm10_score × 0.3 +</div>
              <div className="ml-4">no2_score × 0.2</div>
              <div>)</div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-lg font-semibold">Final Climate Health Risk Score</h3>
            <div className="bg-primary/10 p-4 rounded-md font-mono text-sm">
              <div className="font-bold">Risk Score = max(HSI, CSI) × 0.85 + AQRI × 0.15</div>
            </div>
            <p className="text-sm text-muted-foreground">
              All scores are normalized to a 0-100 scale. The system uses the maximum of heat or cold stress 
              indices to avoid underestimating temperature-related risks. Higher scores indicate greater health risks.
              Air quality has a lower weight to prevent overshadowing severe temperature conditions.
            </p>
          </div>

          <div className="bg-muted p-4 rounded-md space-y-2">
            <h4 className="font-semibold text-sm">Data Confidence</h4>
            <p className="text-xs text-muted-foreground">
              Each neighborhood includes a confidence score (0-100%) indicating data completeness.
              Missing air quality or satellite data reduces confidence but doesn't prevent scoring.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
