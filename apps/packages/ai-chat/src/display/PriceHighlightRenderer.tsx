import type { DisplayPrice } from "@agentic-backbone/ai-sdk";
import { ExternalLink } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";

function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

export function PriceHighlightRenderer({ value, label, context, source, badge }: DisplayPrice) {
  return (
    <Card className="p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatPrice(value.value, value.currency)}
        </span>
        {badge && (
          <Badge variant="destructive">
            {badge.label}
          </Badge>
        )}
      </div>
      {context && <p className="text-sm text-muted-foreground">{context}</p>}
      {source && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          {source.favicon && (
            <img src={source.favicon} alt="" width={14} height={14} aria-hidden="true" />
          )}
          <span>{source.name}</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </Card>
  );
}
