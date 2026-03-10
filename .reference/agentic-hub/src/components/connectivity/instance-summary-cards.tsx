import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import type { EvolutionInstance } from "@/api/evolution";

interface InstanceSummaryCardsProps {
  instances: EvolutionInstance[];
}

export function InstanceSummaryCards({ instances }: InstanceSummaryCardsProps) {
  const online = instances.filter((i) => i.state === "open").length;
  const connecting = instances.filter((i) => i.state === "connecting").length;
  const offline = instances.filter((i) => i.state === "close").length;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <Card className="bg-chart-2/10 border-chart-2/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Online</CardTitle>
          <Wifi className="h-4 w-4 text-chart-2" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-chart-2">{online}</div>
        </CardContent>
      </Card>
      <Card className="bg-chart-4/10 border-chart-4/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conectando</CardTitle>
          <RefreshCw className="h-4 w-4 text-chart-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-chart-4">{connecting}</div>
        </CardContent>
      </Card>
      <Card className="bg-destructive/10 border-destructive/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Offline</CardTitle>
          <WifiOff className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{offline}</div>
        </CardContent>
      </Card>
    </div>
  );
}
