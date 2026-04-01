import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Play, Search, Plus, Pencil, ArrowLeft } from "lucide-react";
import cronstrue from "cronstrue/i18n";
import { CronExpressionParser } from "cron-parser";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CronJobForm } from "@/components/cron/cron-job-form";
import { CronJobDetail } from "@/components/cron/cron-job-detail";
import {
  cronJobsQueryOptions,
  runCronJobManually,
  type CronJob,
} from "@/api/cron";
import { agentsQueryOptions } from "@/api/agents";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";

export const Route = createFileRoute("/_authenticated/cron")({
  staticData: { title: "Agenda", description: "Tarefas agendadas dos agentes" },
  component: CronPage,
});

function describeCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { locale: "pt_BR", use24HourTimeFormat: true });
  } catch {
    return expr;
  }
}

function describeSchedule(job: CronJob): string {
  const { schedule } = job.def;
  if (schedule.kind === "cron" && schedule.expr) {
    return describeCron(schedule.expr);
  }
  if (schedule.kind === "every" && schedule.everyMs) {
    const secs = schedule.everyMs / 1000;
    if (secs < 60) return `A cada ${secs} segundos`;
    const mins = secs / 60;
    if (mins < 60) return `A cada ${mins} minutos`;
    const hours = mins / 60;
    return `A cada ${hours} horas`;
  }
  if (schedule.kind === "at" && schedule.at) {
    return `Em ${schedule.at}`;
  }
  return "—";
}

function computeNextRun(job: CronJob): Date | null {
  if (job.state.nextRunAtMs) {
    return new Date(job.state.nextRunAtMs);
  }
  if (job.def.schedule.kind === "cron" && job.def.schedule.expr) {
    try {
      const expr = CronExpressionParser.parse(job.def.schedule.expr);
      return expr.next().toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = date.getTime() - now;
  const absDiff = Math.abs(diff);
  const past = diff < 0;

  if (absDiff < 60_000) {
    return past ? "agora" : "em breve";
  }
  if (absDiff < 3_600_000) {
    const mins = Math.floor(absDiff / 60_000);
    return past ? `${mins}min atras` : `em ${mins}min`;
  }
  if (absDiff < 86_400_000) {
    const hours = Math.floor(absDiff / 3_600_000);
    return past ? `${hours}h atras` : `em ${hours}h`;
  }
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CronPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | undefined>(undefined);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);

  const { data: jobs, isLoading } = useQuery(
    cronJobsQueryOptions({ includeDisabled: true })
  );
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

  const runMutation = useMutation({
    mutationFn: ({ agentId, slug }: { agentId: string; slug: string }) =>
      runCronJobManually(agentId, slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
      toast.success("Job executado com sucesso");
    },
    onError: () => {
      toast.error("Erro ao executar job");
    },
  });

  const handleRun = useCallback(
    (agentId: string, slug: string) => {
      runMutation.mutate({ agentId, slug });
    },
    [runMutation]
  );

  const filtered = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((j) => {
      const matchesSearch =
        j.slug.toLowerCase().includes(search.toLowerCase()) ||
        j.def.name.toLowerCase().includes(search.toLowerCase());
      const matchesAgent =
        agentFilter === "all" || j.agentId === agentFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && j.def.enabled) ||
        (statusFilter === "inactive" && !j.def.enabled);
      return matchesSearch && matchesAgent && matchesStatus;
    });
  }, [jobs, search, agentFilter, statusFilter]);

  const statusButtons: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "active", label: "Ativos" },
    { value: "inactive", label: "Inativos" },
  ];

  if (selectedJob) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedJob(null)}
          >
            <ArrowLeft className="mr-1 size-4" />
            Voltar
          </Button>
        </div>
        <CronJobDetail
          job={selectedJob}
          agentName={agentNameMap[selectedJob.agentId]}
          onDeleted={() => setSelectedJob(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingJob(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" />
            Novo Job
          </Button>
        }
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
          icon={<Calendar />}
          title={
            jobs?.length
              ? "Nenhum job encontrado"
              : "Nenhum agendamento"
          }
          description={
            jobs?.length
              ? "Tente ajustar sua busca ou filtro."
              : "Em breve voce podera configurar tarefas agendadas aqui."
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Agenda</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Proxima execucao</TableHead>
                <TableHead>Ultima execucao</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((job) => (
                <CronJobRow
                  key={`${job.agentId}/${job.slug}`}
                  job={job}
                  agentName={agentNameMap[job.agentId]}
                  onRun={handleRun}
                  onEdit={(j) => {
                    setEditingJob(j);
                    setFormOpen(true);
                  }}
                  onSelect={setSelectedJob}
                  isRunning={
                    runMutation.isPending &&
                    runMutation.variables?.agentId === job.agentId &&
                    runMutation.variables?.slug === job.slug
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CronJobForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingJob(undefined);
        }}
        job={editingJob}
      />
    </div>
  );
}

function CronJobRow({
  job,
  agentName,
  onRun,
  onEdit,
  onSelect,
  isRunning,
}: {
  job: CronJob;
  agentName?: string;
  onRun: (agentId: string, slug: string) => void;
  onEdit: (job: CronJob) => void;
  onSelect: (job: CronJob) => void;
  isRunning: boolean;
}) {
  const nextRun = computeNextRun(job);
  const lastRun = job.state.lastRunAtMs
    ? new Date(job.state.lastRunAtMs)
    : null;

  return (
    <TableRow className="cursor-pointer" onClick={() => onSelect(job)}>
      <TableCell>
        <Badge variant="outline">{agentName ?? job.agentId}</Badge>
      </TableCell>
      <TableCell className="font-medium">{job.def.name || job.slug}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {describeSchedule(job)}
      </TableCell>
      <TableCell>
        <StatusBadge
          status={job.def.enabled ? "active" : "inactive"}
        />
      </TableCell>
      <TableCell className="text-sm">
        {job.def.enabled && nextRun ? (
          <Tooltip>
            <TooltipTrigger render={<span />}>
              {formatRelativeTime(nextRun)}
            </TooltipTrigger>
            <TooltipContent>
              {nextRun.toLocaleString("pt-BR")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {lastRun ? (
          <div className="flex items-center gap-2">
            <span>{formatRelativeTime(lastRun)}</span>
            {job.state.lastStatus && (
              <StatusBadge
                status={
                  job.state.lastStatus === "ok"
                    ? "active"
                    : job.state.lastStatus === "error"
                      ? "error"
                      : "warning"
                }
                label={
                  job.state.lastStatus === "ok"
                    ? "OK"
                    : job.state.lastStatus === "error"
                      ? "Erro"
                      : "Skip"
                }
              />
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(job);
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              onRun(job.agentId, job.slug);
            }}
            disabled={isRunning}
          >
            <Play className={`size-4 ${isRunning ? "animate-pulse" : ""}`} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
