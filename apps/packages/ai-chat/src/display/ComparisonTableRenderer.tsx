import { useState } from "react";
import type { DisplayComparison } from "@agentic-backbone/ai-sdk";
import { CheckCircle } from "lucide-react";
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
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}

      <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold text-center">Atributo</TableHead>
              {items.map((item, i) => (
                <TableHead
                  key={i}
                  className={cn(
                    "font-semibold text-center",
                    i === highlightIdx && "bg-muted"
                  )}
                >
                  <button
                    className="flex flex-col items-center gap-0.5 w-full cursor-pointer hover:opacity-80"
                    onClick={() => setBestIdx(i === bestIdx ? null : i)}
                    title="Marcar como melhor"
                  >
                    {i === highlightIdx && (
                      <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="font-semibold">{item.title}</span>
                    {item.price && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {formatMoney(item.price.value, item.price.currency)}
                      </span>
                    )}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {attributes && attributes.length > 0 ? (
              attributes.map((attr, ri) => (
                <TableRow key={ri}>
                  <TableCell className="font-medium">{attr.label}</TableCell>
                  {items.map((item, ci) => {
                    const val = (item as Record<string, unknown>)[attr.key];
                    return (
                      <TableCell
                        key={ci}
                        className={cn(
                          "text-center",
                          ci === highlightIdx && "bg-muted/50"
                        )}
                      >
                        {val === true ? "✓" : val === false ? "✗" : val != null ? String(val) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <>
                {items.some((i) => i.rating) && (
                  <TableRow>
                    <TableCell className="font-medium">Avaliação</TableCell>
                    {items.map((item, ci) => (
                      <TableCell
                        key={ci}
                        className={cn(
                          "text-center",
                          ci === highlightIdx && "bg-muted/50"
                        )}
                      >
                        {item.rating ? `${item.rating.score}/5 (${item.rating.count})` : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
                {items.some((i) => i.description) && (
                  <TableRow>
                    <TableCell className="font-medium">Descrição</TableCell>
                    {items.map((item, ci) => (
                      <TableCell
                        key={ci}
                        className={cn(
                          "text-center",
                          ci === highlightIdx && "bg-muted/50"
                        )}
                      >
                        {item.description ?? "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
