import { useState } from "react";
import type { DisplayComparison } from "@agentic-backbone/ai-sdk";
import { CheckCircle } from "lucide-react";

function formatMoney(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function ComparisonTableRenderer({ title, items, attributes }: DisplayComparison) {
  const [bestIdx, setBestIdx] = useState<number | null>(null);

  // Auto-detect best value by lowest price if no manual selection
  const lowestPriceIdx = items.reduce<number | null>((acc, item, i) => {
    if (!item.price) return acc;
    if (acc === null) return i;
    const best = items[acc]?.price;
    return best && item.price.value < best.value ? i : acc;
  }, null);

  const highlightIdx = bestIdx ?? lowestPriceIdx;

  return (
    <div className="ai-chat-display ai-chat-display-comparison">
      {title && <h3 className="ai-chat-display-comparison-title">{title}</h3>}

      <div className="ai-chat-display-comparison-scroll">
        <table className="ai-chat-display-comparison-table">
          <thead>
            <tr>
              <th className="ai-chat-display-comparison-th ai-chat-display-comparison-th--attr">
                Atributo
              </th>
              {items.map((item, i) => (
                <th
                  key={i}
                  className={`ai-chat-display-comparison-th ai-chat-display-comparison-th--product${i === highlightIdx ? " ai-chat-display-comparison-th--best" : ""}`}
                >
                  <button
                    className="ai-chat-display-comparison-product-header"
                    onClick={() => setBestIdx(i === bestIdx ? null : i)}
                    title="Marcar como melhor"
                  >
                    {i === highlightIdx && (
                      <CheckCircle size={14} className="ai-chat-display-comparison-best-icon" />
                    )}
                    {item.title}
                    {item.price && (
                      <span className="ai-chat-display-comparison-price">
                        {formatMoney(item.price.value, item.price.currency)}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {attributes && attributes.length > 0 ? (
              attributes.map((attr, ri) => (
                <tr key={ri} className="ai-chat-display-comparison-row">
                  <td className="ai-chat-display-comparison-td ai-chat-display-comparison-td--attr">
                    {attr.label}
                  </td>
                  {items.map((item, ci) => {
                    const val = (item as Record<string, unknown>)[attr.key];
                    return (
                      <td
                        key={ci}
                        className={`ai-chat-display-comparison-td${ci === highlightIdx ? " ai-chat-display-comparison-td--best" : ""}`}
                      >
                        {val === true ? "✓" : val === false ? "✗" : val != null ? String(val) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <>
                {items.some((i) => i.rating) && (
                  <tr className="ai-chat-display-comparison-row">
                    <td className="ai-chat-display-comparison-td ai-chat-display-comparison-td--attr">
                      Avaliação
                    </td>
                    {items.map((item, ci) => (
                      <td
                        key={ci}
                        className={`ai-chat-display-comparison-td${ci === highlightIdx ? " ai-chat-display-comparison-td--best" : ""}`}
                      >
                        {item.rating ? `${item.rating.score}/5 (${item.rating.count})` : "—"}
                      </td>
                    ))}
                  </tr>
                )}
                {items.some((i) => i.description) && (
                  <tr className="ai-chat-display-comparison-row">
                    <td className="ai-chat-display-comparison-td ai-chat-display-comparison-td--attr">
                      Descrição
                    </td>
                    {items.map((item, ci) => (
                      <td
                        key={ci}
                        className={`ai-chat-display-comparison-td${ci === highlightIdx ? " ai-chat-display-comparison-td--best" : ""}`}
                      >
                        {item.description ?? "—"}
                      </td>
                    ))}
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
