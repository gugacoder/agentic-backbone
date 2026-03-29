import type { DisplayMetric } from "@agentic-backbone/ai-sdk";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

const TREND_CONFIG = {
  up: { Icon: ArrowUp, colorClass: "ai-chat-display-metric-trend--up" },
  down: { Icon: ArrowDown, colorClass: "ai-chat-display-metric-trend--down" },
  neutral: { Icon: ArrowRight, colorClass: "ai-chat-display-metric-trend--neutral" },
} as const;

export function MetricCardRenderer({ label, value, unit, trend }: DisplayMetric) {
  const trendConfig = trend ? TREND_CONFIG[trend.direction] : null;

  return (
    <div className="ai-chat-display ai-chat-display-metric">
      <p className="ai-chat-display-metric-label">{label}</p>
      <div className="ai-chat-display-metric-value-row">
        <span className="ai-chat-display-metric-value">{value}</span>
        {unit && <span className="ai-chat-display-metric-unit">{unit}</span>}
      </div>
      {trend && trendConfig && (
        <div className={`ai-chat-display-metric-trend ${trendConfig.colorClass}`}>
          <trendConfig.Icon size={14} aria-hidden="true" />
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
}
