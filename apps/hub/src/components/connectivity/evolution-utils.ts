import type { EvolutionInstance } from "@/api/evolution";

export const stateConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Online", className: "bg-chart-2/15 text-chart-2" },
  connecting: { label: "Conectando", className: "bg-chart-4/15 text-chart-4" },
  close: { label: "Offline", className: "bg-destructive/15 text-destructive" },
};

export const stateOrder: Record<string, number> = { close: 0, connecting: 1, open: 2 };

export function timeAgo(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `ha ${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3600_000) return `ha ${Math.floor(diff / 60_000)}min`;
  if (diff < 86400_000) return `ha ${Math.floor(diff / 3600_000)}h`;
  return `ha ${Math.floor(diff / 86400_000)}d`;
}

export function sortByCriticality(instances: EvolutionInstance[]): EvolutionInstance[] {
  return [...instances].sort((a, b) => {
    const orderDiff = (stateOrder[a.state] ?? 2) - (stateOrder[b.state] ?? 2);
    if (orderDiff !== 0) return orderDiff;
    return (a.since ?? Date.now()) - (b.since ?? Date.now());
  });
}
