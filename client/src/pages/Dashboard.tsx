import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Settings, Info, Bell, Upload, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import RiskMap from "@/components/RiskMap";
import RiskLegend from "@/components/RiskLegend";
import TimeSlider from "@/components/TimeSlider";
import SummaryCard from "@/components/SummaryCard";
import RiskChart from "@/components/RiskChart";
import AlertPanel from "@/components/AlertPanel";
import CommunityForm from "@/components/CommunityForm";
import CommunityFeed from "@/components/CommunityFeed";
import RiskScoreModal from "@/components/RiskScoreModal";
import SettingsPanel from "@/components/SettingsPanel";
import { AlertTriangle, Thermometer, Wind, Users } from "lucide-react";
import { subscribeToPushNotifications, unsubscribeFromPushNotifications, sendTestNotification } from "@/lib/pushNotifications";
import type { NeighborhoodsGeoJSON, Alert, InsertCommunitySubmission } from "@shared/schema";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayIndex, setDayIndex] = useState(0);
  const [colorblindMode, setColorblindMode] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: neighborhoods, isLoading: neighborhoodsLoading } = useQuery<NeighborhoodsGeoJSON>({
    queryKey: ['/api/neighborhoods', dayIndex],
    queryFn: async () => {
      const response = await fetch(`/api/neighborhoods?dayIndex=${dayIndex}`);
      if (!response.ok) throw new Error('Failed to fetch neighborhoods');
      return response.json();
    },
    refetchInterval: 900000,
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
    queryFn: async () => {
      const response = await fetch('/api/alerts');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const dismissAlertMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({ title: "Alert dismissed" });
    },
  });

  const submitCommunityMutation = useMutation({
    mutationFn: (data: InsertCommunitySubmission) =>
      apiRequest('POST', '/api/community/submissions', data),
    onSuccess: () => {
      toast({ title: "Submission received", description: "Thank you for your report." });
    },
  });

  const uploadGeoJSONMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('geojson', file);
      const response = await fetch('/api/neighborhoods/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/neighborhoods'] });
      toast({ title: "GeoJSON uploaded", description: "Neighborhoods updated successfully." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload failed", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  useEffect(() => {
    if (notifications) {
      subscribeToPushNotifications().then(success => {
        if (!success) {
          setNotifications(false);
          toast({ title: "Push notifications unavailable", variant: "destructive" });
        }
      });
    } else {
      unsubscribeFromPushNotifications();
    }
  }, [notifications, toast]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    // Don't recalculate dayIndex here - it's already set by onDayIndexChange
    // This prevents conflicts when the slider updates both values
  };

  const handleNeighborhoodClick = (name: string) => {
    setSelectedNeighborhood(name);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadGeoJSONMutation.mutate(file);
    }
  };

  const handleTestAlert = async () => {
    const success = await sendTestNotification();
    if (success) {
      toast({ title: "Test notification sent" });
    } else {
      toast({ title: "Failed to send test notification", variant: "destructive" });
    }
  };

  const getChartData = () => {
    if (!selectedNeighborhood || !neighborhoods) {
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        hsi: [0, 0, 0, 0, 0, 0, 0],
        csi: [0, 0, 0, 0, 0, 0, 0],
        aqri: [0, 0, 0, 0, 0, 0, 0],
      };
    }

    const feature = neighborhoods.features.find(f => f.properties.name === selectedNeighborhood);
    if (!feature?.properties.riskData) {
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        hsi: [0, 0, 0, 0, 0, 0, 0],
        csi: [0, 0, 0, 0, 0, 0, 0],
        aqri: [0, 0, 0, 0, 0, 0, 0],
      };
    }

    const labels = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    });

    const { hsi, csi, aqri } = feature.properties.riskData;
    const baseHSI = [hsi, hsi * 1.1, hsi * 1.05, hsi * 0.95, hsi * 0.9, hsi * 0.85, hsi * 0.8];
    const baseCSI = [csi, csi * 0.9, csi * 0.85, csi * 0.9, csi * 1.1, csi * 1.2, csi * 1.3];
    const baseAQRI = [aqri, aqri * 1.05, aqri * 1.1, aqri * 1.15, aqri * 1.2, aqri * 1.1, aqri * 1.05];

    return {
      labels,
      hsi: baseHSI.map(v => Math.round(Math.min(100, Math.max(0, v)))),
      csi: baseCSI.map(v => Math.round(Math.min(100, Math.max(0, v)))),
      aqri: baseAQRI.map(v => Math.round(Math.min(100, Math.max(0, v)))),
    };
  };

  const getSummaryStats = () => {
    if (!neighborhoods?.features) {
      return {
        highestRisk: { name: 'Loading...', score: 0 },
        avgTemp: 0,
        aqi: 0,
        atRisk: 0,
      };
    }

    let highestRisk = { name: 'N/A', score: 0 };
    let totalTemp = 0;
    let totalAQI = 0;
    let atRiskPop = 0;
    let count = 0;

    for (const feature of neighborhoods.features) {
      const { riskData, seniorPercent, population } = feature.properties;
      if (!riskData) continue;

      if (riskData.riskScore > highestRisk.score) {
        highestRisk = { name: feature.properties.name, score: riskData.riskScore };
      }

      totalTemp += riskData.raw.weather.temperature;
      if (riskData.raw.airQuality.pm25) {
        totalAQI += riskData.raw.airQuality.pm25;
      }

      if (riskData.riskScore > 60) {
        // Prefer server-provided atRiskPopulationHigh (count when risk is high)
        if (feature.properties?.atRiskPopulationHigh != null) {
          atRiskPop += Number(feature.properties.atRiskPopulationHigh);
        } else if (feature.properties?.atRiskPopulation != null) {
          // Fallback to the general at-risk estimate if the high-risk count isn't present
          atRiskPop += Number(feature.properties.atRiskPopulation);
        } else if (population) {
          const vulnerablePercent = feature.properties.vulnerabilityScore ?? seniorPercent ?? 0;
          atRiskPop += Math.round(population * (vulnerablePercent / 100));
        }
      }

      count++;
    }

    // If no neighborhoods were flagged high-risk (atRiskPop === 0) fall back to summing
    // the general atRiskPopulation across all neighborhoods so the metric is informative.
    if (atRiskPop === 0) {
      for (const feature of neighborhoods.features) {
        const pop = feature.properties?.atRiskPopulation;
        if (pop != null) atRiskPop += Number(pop);
      }
    }

    return {
      highestRisk,
      avgTemp: count > 0 ? Math.round(totalTemp / count) : 0,
      aqi: count > 0 ? Math.round(totalAQI / count) : 0,
      atRisk: atRiskPop,
    };
  };

  const stats = getSummaryStats();

  if (neighborhoodsLoading || !neighborhoods) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-lg">Loading climate data...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">ClimateCare</h1>
            <p className="text-sm text-muted-foreground">Real-time Climate Health Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setModalOpen(true)}
            data-testid="button-info"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleTestAlert}
            data-testid="button-test-notification"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            data-testid="button-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-4">
          <div className="flex-1 relative">
            <RiskMap 
              neighborhoods={neighborhoods}
              colorblindMode={colorblindMode}
              selectedDate={selectedDate}
              onNeighborhoodClick={handleNeighborhoodClick}
            />
            <div className="absolute bottom-4 left-4 z-10">
              <RiskLegend colorblindMode={colorblindMode} />
            </div>
          </div>
          <TimeSlider 
            onDateChange={handleDateChange} 
            onDayIndexChange={setDayIndex}
            dayIndex={dayIndex}
          />
        </div>

  <div className="w-full md:w-[450px] border-t md:border-t-0 md:border-l overflow-y-auto">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="alerts" data-testid="tab-alerts">
                Alerts {alerts.length > 0 && `(${alerts.length})`}
              </TabsTrigger>
              <TabsTrigger value="community" data-testid="tab-community">Community</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Summary</h2>
                <label htmlFor="geojson-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload GeoJSON
                    </span>
                  </Button>
                  <input
                    id="geojson-upload"
                    type="file"
                    accept=".geojson,.json"
                    className="hidden"
                    onChange={handleFileUpload}
                    data-testid="input-geojson-upload"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <SummaryCard 
                  title="Highest Risk Area"
                  value={stats.highestRisk.name}
                  subtitle={`Risk Score: ${stats.highestRisk.score}`}
                  icon={AlertTriangle}
                />
                <SummaryCard 
                  title="Average Temperature"
                  value={`${stats.avgTemp}°C`}
                  icon={Thermometer}
                />
                <SummaryCard 
                  title="Air Quality (PM2.5)"
                  value={stats.aqi > 0 ? stats.aqi.toString() : "N/A"}
                  subtitle={stats.aqi > 50 ? "Moderate" : stats.aqi > 0 ? "Good" : "No data"}
                  icon={Wind}
                />
                <SummaryCard 
                  title="At-Risk Population"
                  value={stats.atRisk.toLocaleString()}
                  subtitle="Seniors in high-risk areas"
                  icon={Users}
                />
              </div>

              <RiskChart 
                data={getChartData()} 
                title={selectedNeighborhood ? `${selectedNeighborhood} - 7-Day Forecast` : "7-Day Risk Forecast"} 
              />
            </TabsContent>

            <TabsContent value="alerts" className="p-4">
              <AlertPanel 
                alerts={alerts}
                onDismiss={(id) => dismissAlertMutation.mutate(id)}
              />
            </TabsContent>

            <TabsContent value="community" className="p-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CommunityForm onSubmit={(data) => submitCommunityMutation.mutate(data)} />
                <CommunityFeed />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <RiskScoreModal open={modalOpen} onOpenChange={setModalOpen} />
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        colorblindMode={colorblindMode}
        onColorblindModeChange={setColorblindMode}
        notifications={notifications}
        onNotificationsChange={setNotifications}
      />
    </div>
  );
}
