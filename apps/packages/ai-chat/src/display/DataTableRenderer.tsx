import { useState } from "react";
import type { DisplayTable } from "@agentic-backbone/ai-sdk";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table.js";
import { ScrollArea, ScrollBar } from "../ui/scroll-area.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";

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
        <img src={value} alt="" className="rounded-sm max-h-12 object-cover" />
      ) : null;
    case "link":
      return typeof value === "string" ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
          {value}
        </a>
      ) : null;
    case "badge":
      return <Badge variant="secondary">{String(value)}</Badge>;
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
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}

      <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                >
                  {sortable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 font-semibold"
                      onClick={() => handleSort(col.key)}
                      aria-sort={
                        sortKey === col.key
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowDown className="ml-1 h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      )}
                    </Button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedRows.map((row, ri) => (
              <TableRow key={ri}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                  >
                    {renderCellValue(row[col.key], col.type)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
