import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch, useNavigate, useLocation } from "@tanstack/react-router";
import { jobsQuery, useKillJob, useClearJob } from "@/api/jobs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useSSE } from "@/hooks/use-sse";
import {
  Terminal,
  Skull,
  Trash2,
  Cpu,
  MemoryStick,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobSummary, JobStatus } from "@/api/types";

// --- Helpers ---

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  const secs = Math.floor(ms / 1_000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)}MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)}GB`;
}

function liveDuration(startedAt: number): string {
  return formatDuration(Date.now() - startedAt);
}

// --- Stats Cards ---

const statCards: { label: string; key: string; icon: typeof Activity; style: string }[] = [
  { label: "Total", key: "total", icon: Terminal, style: "text-foreground" },
  { label: "Running", key: "running", icon: Activity, style: "text-blue-600 dark:text-blue-400" },
  { label: "Completed", key: "completed", icon: CheckCircle2, style: "text-emerald-600 dark:text-emerald-400" },
  { label: "Failed", key: "failed", icon: XCircle, style: "text-red-600 dark:text-red-400" },
];

// --- Page ---

export function JobsPage() {
  const qc = useQueryClient();
  const { data: jobs = [] } = useQuery(jobsQuery);
  const killJob = useKillJob();
  const clearJob = useClearJob();

  // SSE — invalidate on job status changes for instant updates
  useSSE({
    url: "/system/events",
    onEvent: (event) => {
      if (event === "job:status") {
        qc.invalidateQueries({ queryKey: ["jobs"] });
      }
    },
  });

  // URL-driven filters
  const search = useSearch({ strict: false }) as { status?: string; agent?: string };
  const navigate = useNavigate();
  const statusFilter = (search.status ?? "all") as string;
  const agentFilter = (search.agent ?? "all") as string;

  // Derived
  const agents = useMemo(() => [...new Set(jobs.map((j) => j.agentId))].sort(), [jobs]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: jobs.length, running: 0, completed: 0, failed: 0 };
    for (const j of jobs) {
      if (j.status === "running") c.running++;
      else if (j.status === "completed") c.completed++;
      else c.failed++; // failed + timeout
    }
    return c;
  }, [jobs]);

  const filtered = useMemo(() => {
    let list = jobs;
    if (statusFilter !== "all") {
      list = list.filter((j) =>
        statusFilter === "failed" ? j.status === "failed" || j.status === "timeout" : j.status === statusFilter
      );
    }
    if (agentFilter !== "all") {
      list = list.filter((j) => j.agentId === agentFilter);
    }
    // running first, then by startedAt desc
    return [...list].sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return b.startedAt - a.startedAt;
    });
  }, [jobs, statusFilter, agentFilter]);

  // Kill confirmation state
  const [killTarget, setKillTarget] = useState<JobSummary | null>(null);

  const location = useLocation();
  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(location.search);
    if (value === "all") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    navigate({ to: `/jobs${qs ? `?${qs}` : ""}` });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description={`${jobs.length} process${jobs.length !== 1 ? "es" : ""} supervised`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.key}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn("h-5 w-5", s.style)} />
              <div>
                <p className="text-2xl font-bold">{counts[s.key] ?? 0}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "running", "completed", "failed", "timeout"] as const).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("status", s)}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
        {agents.length > 1 && (
          <select
            className="ml-auto h-8 rounded-md border bg-background px-2 text-sm"
            value={agentFilter}
            onChange={(e) => setFilter("agent", e.target.value)}
          >
            <option value="all">All agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      {/* Job List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Terminal}
          title="No jobs"
          description="No supervised processes match the current filters."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onKill={() => setKillTarget(job)}
              onClear={() => clearJob.mutate(job.id)}
              isClearing={clearJob.isPending}
            />
          ))}
        </div>
      )}

      {/* Kill Confirm Dialog */}
      <ConfirmDialog
        open={!!killTarget}
        onOpenChange={(open) => { if (!open) setKillTarget(null); }}
        title="Kill Process"
        description={
          killTarget
            ? `This will send SIGKILL to PID ${killTarget.pid} running "${killTarget.command}". The process will be terminated immediately and cannot be recovered.`
            : ""
        }
        variant="destructive"
        typedConfirm="kill"
        confirmText="Kill Process"
        onConfirm={() => {
          if (killTarget) killJob.mutate(killTarget.id);
          setKillTarget(null);
        }}
      />
    </div>
  );
}

// --- Job Card ---

function JobCard({
  job,
  onKill,
  onClear,
  isClearing,
}: {
  job: JobSummary;
  onKill: () => void;
  onClear: () => void;
  isClearing: boolean;
}) {
  const isRunning = job.status === "running";
  const duration = job.durationMs
    ? formatDuration(job.durationMs)
    : isRunning
      ? liveDuration(job.startedAt)
      : undefined;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <code className="text-sm font-mono block truncate">{job.command}</code>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={job.status} />
              <Badge variant="outline">{job.agentId}</Badge>
              <span>PID {job.pid}</span>
              {duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {duration}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="shrink-0">
            {isRunning ? (
              <Button variant="destructive" size="sm" onClick={onKill}>
                <Skull className="h-3.5 w-3.5 mr-1" />
                Kill
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onClear} disabled={isClearing}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Resource stats (running only) */}
        {isRunning && job.resourceStats && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5" />
              {job.resourceStats.cpu.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1">
              <MemoryStick className="h-3.5 w-3.5" />
              {formatBytes(job.resourceStats.memory)}
            </span>
          </div>
        )}

        {/* Output tail */}
        {job.tail && (
          <OutputCollapsible tail={job.tail} truncated={job.truncated} />
        )}
      </CardContent>
    </Card>
  );
}

// --- Output Collapsible ---

function OutputCollapsible({ tail, truncated }: { tail: string; truncated: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        Output{truncated && " (truncated)"}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">
          {tail}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
