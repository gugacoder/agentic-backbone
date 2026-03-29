import type { DisplayMetric } from "@agentic-backbone/ai-sdk";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Card } from "../ui/card.js";

const TREND_CONFIG = {
  up: { Icon: ArrowUp, colorClass: "text-primary" },
  down: { Icon: ArrowDown, colorClass: "text-destructive" },
  neutral: { Icon: ArrowRight, colorClass: "text-muted-foreground" },
} as const;

export function MetricCardRenderer({ label, value, unit, trend }: DisplayMetric) {
  const trendConfig = trend ? TREND_CONFIG[trend.direction] : null;

  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {trend && trendConfig && (
        <div className={`flex items-center gap-1 mt-1 text-sm ${trendConfig.colorClass}`}>
          <trendConfig.Icon size={14} aria-hidden="true" />
          <span>{trend.value}</span>
        </div>
      )}
    </Card>
  );
}
