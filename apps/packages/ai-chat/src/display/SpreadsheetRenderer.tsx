import type { DisplaySpreadsheet } from "@agentic-backbone/ai-sdk";
import { ScrollArea, ScrollBar } from "../ui/scroll-area.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table.js";
import { cn } from "../lib/utils.js";

function formatCell(
  value: string | number | null,
  colIndex: number,
  moneyColumns: number[] = [],
  percentColumns: number[] = [],
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (moneyColumns.includes(colIndex)) {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    if (percentColumns.includes(colIndex)) {
      return new Intl.NumberFormat("pt-BR", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      }).format(value / 100);
    }
    return new Intl.NumberFormat("pt-BR").format(value);
  }
  return String(value);
}

export function SpreadsheetRenderer({ title, headers, rows, format }: DisplaySpreadsheet) {
  const moneyColumns = format?.moneyColumns ?? [];
  const percentColumns = format?.percentColumns ?? [];

  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}

      <ScrollArea className="w-full">
        <Table aria-readonly="true">
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground font-normal text-center w-10" aria-label="Linha" />
              {headers.map((h, i) => (
                <TableHead key={i} className="font-semibold">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row, ri) => (
              <TableRow key={ri}>
                <TableCell className="text-center text-xs text-muted-foreground select-none">
                  {ri + 1}
                </TableCell>
                {row.map((cell, ci) => {
                  const isMoney = moneyColumns.includes(ci);
                  const isPercent = percentColumns.includes(ci);
                  const isNumber = typeof cell === "number";
                  return (
                    <TableCell
                      key={ci}
                      className={cn(
                        (isMoney || isPercent || isNumber) && "text-right font-mono text-sm"
                      )}
                    >
                      {formatCell(cell, ci, moneyColumns, percentColumns)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
