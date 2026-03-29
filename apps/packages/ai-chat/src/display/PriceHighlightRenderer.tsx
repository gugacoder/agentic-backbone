import type { DisplayPrice } from "@agentic-backbone/ai-sdk";
import { ExternalLink } from "lucide-react";

function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

export function PriceHighlightRenderer({ value, label, context, source, badge }: DisplayPrice) {
  return (
    <div className="ai-chat-display ai-chat-display-price">
      <p className="ai-chat-display-price-label">{label}</p>
      <p className="ai-chat-display-price-value">
        {formatPrice(value.value, value.currency)}
      </p>
      {badge && (
        <span className={`ai-chat-display-price-badge ai-chat-display-price-badge--${badge.variant}`}>
          {badge.label}
        </span>
      )}
      {context && <p className="ai-chat-display-price-context">{context}</p>}
      {source && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ai-chat-display-price-source"
        >
          {source.favicon && (
            <img src={source.favicon} alt="" width={14} height={14} aria-hidden="true" />
          )}
          <span>{source.name}</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
