import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Alert, RiskData } from "@shared/schema";
import { analyzeRiskData } from "@/services/openRouterService";
import { useEffect, useState } from "react";

interface AlertPanelProps {
  alerts?: Alert[];
  onDismiss?: (id: string) => void;
  riskData?: RiskData;
  neighborhoodName?: string;
}

const DEFAULT_ALERTS: Alert[] = [
  {
    id: 'default-1',
    type: 'heat',
    severity: 'high',
    neighborhoods: ['Downtown', 'Midtown'],
    message: 'Heat wave expected: Temperatures to reach 35°C. Stay hydrated and avoid prolonged sun exposure.',
    timestamp: new Date().toISOString()
  },
  {
    id: 'default-2',
    type: 'air_quality',
    severity: 'moderate',
    neighborhoods: ['Industrial District', 'Waterfront'],
    message: 'Moderate air quality concerns: PM2.5 levels elevated. Sensitive groups should limit outdoor activities.',
    timestamp: new Date().toISOString()
  },
  {
    id: 'default-3',
    type: 'cold',
    severity: 'extreme',
    neighborhoods: ['Highland Park', 'Northern District'],
    message: 'Extreme cold warning: Wind chill -25°C. Risk of frostbite. Limit outdoor exposure.',
    timestamp: new Date().toISOString()
  }
];

export default function AlertPanel({ alerts = DEFAULT_ALERTS, onDismiss, riskData, neighborhoodName }: AlertPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAlert, setAiAlert] = useState<Alert | null>(null);

  useEffect(() => {
    const performAnalysis = async () => {
      if (!riskData || !neighborhoodName) return;
      
      setIsAnalyzing(true);
      try {
        const analysis = await analyzeRiskData(riskData, neighborhoodName);
        setAiAlert({
          id: 'ai-analysis',
          type: analysis.type,
          severity: analysis.severity,
          neighborhoods: [neighborhoodName],
          message: analysis.message,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error getting AI analysis:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    performAnalysis();
  }, [riskData, neighborhoodName]);
  const getSeverityColor = (severity: Alert["severity"]) => {
    switch (severity) {
      case "extreme": return "destructive";
      case "high": return "default";
      case "moderate": return "secondary";
      case "low": return "outline";
    }
  };

  const getTypeIcon = (type: Alert["type"]) => {
    return type === "heat" ? "🔥" : type === "cold" ? "❄️" : "💨";
  };

  return (
    <Card className="p-6" data-testid="card-alert-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Active Alerts</h3>
        </div>
        <Badge variant="secondary" data-testid="badge-alert-count">
          {alerts.length}
        </Badge>
      </div>

      <ScrollArea className="h-96">
        {isAnalyzing && (
          <div className="flex items-center justify-center py-4 border-b">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">
              Analyzing current conditions...
            </span>
          </div>
        )}
        <div className="space-y-3">
          {aiAlert && (
            <div
              key={aiAlert.id}
              className="p-4 border-2 border-primary rounded-md space-y-2 hover-elevate bg-primary/5"
              data-testid="ai-alert-item"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getTypeIcon(aiAlert.type)}</span>
                  <Badge variant={getSeverityColor(aiAlert.severity)}>
                    AI ANALYSIS
                  </Badge>
                </div>
              </div>
              <p className="text-sm font-medium">{aiAlert.message}</p>
              <div className="flex flex-wrap gap-1">
                {aiAlert.neighborhoods.map((neighborhood, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {neighborhood}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {format(new Date(aiAlert.timestamp), "MMM d, h:mm a")}
              </p>
            </div>
          )}
          {alerts.length === 0 && !aiAlert ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No active alerts
            </p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 border rounded-md space-y-2 hover-elevate"
                data-testid={`alert-item-${alert.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getTypeIcon(alert.type)}</span>
                    <Badge variant={getSeverityColor(alert.severity)}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  {onDismiss && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDismiss(alert.id)}
                      data-testid={`button-dismiss-${alert.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <p className="text-sm font-medium">{alert.message}</p>
                
                <div className="flex flex-wrap gap-1">
                  {alert.neighborhoods.map((neighborhood, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {neighborhood}
                    </Badge>
                  ))}
                </div>
                
                <p className="text-xs text-muted-foreground font-mono">
                  {format(new Date(alert.timestamp), "MMM d, h:mm a")}
                </p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
