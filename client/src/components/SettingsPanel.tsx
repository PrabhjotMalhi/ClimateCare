import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colorblindMode: boolean;
  onColorblindModeChange: (value: boolean) => void;
  notifications: boolean;
  onNotificationsChange: (value: boolean) => void;
}

export default function SettingsPanel({
  open,
  onOpenChange,
  colorblindMode,
  onColorblindModeChange,
  notifications,
  onNotificationsChange,
}: SettingsPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="sheet-settings">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Customize your ClimateCare experience
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Accessibility</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="colorblind-mode">Colorblind-Safe Palette</Label>
                <p className="text-sm text-muted-foreground">
                  Use blue-red gradient for risk visualization
                </p>
              </div>
              <Switch
                id="colorblind-mode"
                checked={colorblindMode}
                onCheckedChange={onColorblindModeChange}
                data-testid="switch-colorblind-mode"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold">Notifications</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Web Push Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive browser notifications for high-risk alerts
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={onNotificationsChange}
                data-testid="switch-notifications"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold">Data Sources</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Weather</span>
                <span className="font-mono">Open-Meteo API</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Air Quality</span>
                <span className="font-mono">OpenAQ API</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Map Tiles</span>
                <span className="font-mono">OpenStreetMap</span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
