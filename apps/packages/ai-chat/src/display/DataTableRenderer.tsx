import { useState } from "react";
import type { DisplayTable } from "@agentic-backbone/ai-sdk";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortDir = "asc" | "desc";

function formatMoney(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

function renderCellValue(value: unknown, type: string): React.ReactNode {
  if (value == null) return "—";
  switch (type) {
    case "money":
      return typeof value === "number"
        ? formatMoney(value)
        : typeof value === "object" && value !== null && "value" in value
        ? formatMoney((value as { value: number; currency?: string }).value, (value as { currency?: string }).currency)
        : String(value);
    case "image":
      return typeof value === "string" ? (
        <img src={value} alt="" className="ai-chat-display-table-cell-image" />
      ) : null;
    case "link":
      return typeof value === "string" ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="ai-chat-display-table-cell-link">
          {value}
        </a>
      ) : null;
    case "badge":
      return <span className="ai-chat-display-table-cell-badge">{String(value)}</span>;
    default:
      return String(value);
  }
}

function compareValues(a: unknown, b: unknown, type: string): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (type === "money") {
    const av = typeof a === "number" ? a : typeof a === "object" && a !== null && "value" in a ? (a as { value: number }).value : 0;
    const bv = typeof b === "number" ? b : typeof b === "object" && b !== null && "value" in b ? (b as { value: number }).value : 0;
    return av - bv;
  }
  if (type === "number") {
    return (Number(a) || 0) - (Number(b) || 0);
  }
  return String(a).localeCompare(String(b), "pt-BR");
}

export function DataTableRenderer({ title, columns, rows, sortable }: DisplayTable) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        const col = columns.find((c) => c.key === sortKey);
        const dir = sortDir === "asc" ? 1 : -1;
        return compareValues(a[sortKey], b[sortKey], col?.type ?? "text") * dir;
      })
    : rows;

  return (
    <div className="ai-chat-display ai-chat-display-table">
      {title && <h3 className="ai-chat-display-table-title">{title}</h3>}

      <div className="ai-chat-display-table-scroll">
        <table className="ai-chat-display-table-el">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`ai-chat-display-table-th ai-chat-display-table-th--${col.align}${sortable ? " ai-chat-display-table-th--sortable" : ""}`}
                  onClick={() => handleSort(col.key)}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <span className="ai-chat-display-table-th-inner">
                    {col.label}
                    {sortable && (
                      <span className="ai-chat-display-table-sort-icon">
                        {sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )
                        ) : (
                          <ArrowUpDown size={12} />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row, ri) => (
              <tr key={ri} className="ai-chat-display-table-row">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`ai-chat-display-table-td ai-chat-display-table-td--${col.align}`}
                  >
                    {renderCellValue(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
