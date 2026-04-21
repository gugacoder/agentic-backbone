import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { searchAgentMemory } from "@/api/agents";
import type { MemorySearchResult } from "@/api/agents";

interface KbSearchProps {
  agentId: string;
  onSelect: (path: string) => void;
}

export function KbSearch({ agentId, onSelect }: KbSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemorySearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchAgentMemory(agentId, trimmed, 10);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, agentId]);

  function pick(path: string) {
    onSelect(path);
    setQuery("");
    setResults(null);
  }

  const hasResults = results !== null;

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar na KB (semântico)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {query ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
            onClick={() => {
              setQuery("");
              setResults(null);
            }}
            aria-label="Limpar"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {hasResults || loading ? (
        <div
          className={cn(
            "absolute z-40 mt-2 w-full max-h-[60vh] overflow-y-auto",
            "rounded-md border bg-popover shadow-lg",
          )}
        >
          {loading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : results && results.length > 0 ? (
            <ul className="divide-y">
              {results.map((r, i) => (
                <li key={`${r.path}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pick(r.path)}
                    className="w-full text-left p-3 hover:bg-accent/50 space-y-1"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] truncate">
                        {r.path}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {r.source === "vector" ? "vetor" : "texto"}
                      </Badge>
                      <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                        {Math.round(r.score * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {r.snippet}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Nenhum resultado
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
