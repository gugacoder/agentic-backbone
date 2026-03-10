import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType =
  | "ok"
  | "ok-token"
  | "sent"
  | "skipped"
  | "failed"
  | "active"
  | "blocked"
  | "pending"
  | "completed"
  | "running"
  | "connected"
  | "disconnected"
  | "disabled"
  | "timeout";

const statusStyles: Record<StatusType, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "ok-token": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  skipped: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  blocked: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  pending: "bg-muted text-muted-foreground",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  connected: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  disconnected: "bg-red-500/15 text-red-700 dark:text-red-400",
  disabled: "bg-muted text-muted-foreground",
  timeout: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status as StatusType] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={cn("font-medium", style, className)}>
      {status}
    </Badge>
  );
}
