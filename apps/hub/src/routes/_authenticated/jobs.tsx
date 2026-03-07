import { useState, useMemo } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cpu, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { jobsQueryOptions, type JobSummary } from "@/api/jobs";
import { agentsQueryOptions } from "@/api/agents";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type StatusFilter = "all" | "running" | "completed" | "failed";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: JobsPage,
});

const statusColors: Record<JobSummary["status"], string> = {
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  completed: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
  killed: "bg-muted text-muted-foreground border-border",
  timeout: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
};

const statusLabels: Record<JobSummary["status"], string> = {
  running: "Rodando",
  completed: "Concluido",
  failed: "Falhou",
  killed: "Cancelado",
  timeout: "Timeout",
};

function formatDuration(job: JobSummary): string {
  const ms = job.durationMs ?? (Date.now() - job.startedAt);
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins}min atras`;
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours}h atras`;
  }
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMemory(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function JobsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: jobs, isLoading } = useQuery(jobsQueryOptions());
  const { data: agents } = useQuery(agentsQueryOptions());

  const agentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (agents ?? []).forEach((a) => {
      map[a.id] = a.slug;
    });
    return map;
  }, [agents]);

  const uniqueAgentIds = useMemo(() => {
    const ids = new Set((jobs ?? []).map((j) => j.agentId));
    return Array.from(ids).sort();
  }, [jobs]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((j) => {
      const matchesSearch =
        j.command.toLowerCase().includes(search.toLowerCase()) ||
        j.agentId.toLowerCase().includes(search.toLowerCase());
      const matchesAgent =
        agentFilter === "all" || j.agentId === agentFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "running" && j.status === "running") ||
        (statusFilter === "completed" && j.status === "completed") ||
        (statusFilter === "failed" && (j.status === "failed" || j.status === "killed" || j.status === "timeout"));
      return matchesSearch && matchesAgent && matchesStatus;
    });
  }, [jobs, search, agentFilter, statusFilter]);

  const statusButtons: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "running", label: "Rodando" },
    { value: "completed", label: "Concluidos" },
    { value: "failed", label: "Falhos" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Processos de longa duracao dos agentes"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar job..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "all")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agentes</SelectItem>
              {uniqueAgentIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {agentNameMap[id] ?? id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          {statusButtons.map((fb) => (
            <button
              key={fb.value}
              onClick={() => setStatusFilter(fb.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === fb.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {fb.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Cpu />}
          title={
            jobs?.length
              ? "Nenhum job encontrado"
              : "Nenhum job"
          }
          description={
            jobs?.length
              ? "Tente ajustar sua busca ou filtro."
              : "Jobs criados pelos agentes aparecerao aqui."
          }
        />
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="hidden rounded-lg border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Comando</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Duracao</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Memoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/jobs/$id", params: { id: job.id } })}
                  >
                    <TableCell>
                      <Badge variant="outline" className={statusColors[job.status]}>
                        {statusLabels[job.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{agentNameMap[job.agentId] ?? job.agentId}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <Tooltip>
                        <TooltipTrigger render={<span className="block truncate" />}>
                          {job.command}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">
                          <p className="break-all font-mono text-xs">{job.command}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger render={<span />}>
                          {formatRelativeTime(job.startedAt)}
                        </TooltipTrigger>
                        <TooltipContent>
                          {new Date(job.startedAt).toLocaleString("pt-BR")}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.status === "running" ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          {formatDuration(job)}
                        </span>
                      ) : (
                        formatDuration(job)
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.resourceStats ? `${Math.round(job.resourceStats.cpu)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.resourceStats ? formatMemory(job.resourceStats.memory) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: Cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {filtered.map((job) => (
              <button
                key={job.id}
                onClick={() => {}}
                className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={statusColors[job.status]}>
                    {statusLabels[job.status]}
                  </Badge>
                  <Badge variant="outline">{agentNameMap[job.agentId] ?? job.agentId}</Badge>
                </div>
                <p className="mt-2 truncate font-mono text-sm">{job.command}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(job.startedAt)}</span>
                  <span>{formatDuration(job)}</span>
                  {job.resourceStats && (
                    <>
                      <span>CPU {Math.round(job.resourceStats.cpu)}%</span>
                      <span>{formatMemory(job.resourceStats.memory)}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <Outlet />
    </div>
  );
}
