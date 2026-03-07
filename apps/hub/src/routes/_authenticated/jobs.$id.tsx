import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Cpu,
  MemoryStick,
  Clock,
  Hash,
  Terminal,
  Square,
  Trash2,
} from "lucide-react";
import { jobQueryOptions, killJob, deleteJob } from "@/api/jobs";
import { agentsQueryOptions } from "@/api/agents";
import { TerminalOutput } from "@/components/jobs/terminal-output";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/jobs/$id")({
  component: JobDetailDrawer,
});

const statusColors: Record<string, string> = {
  running:
    "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  completed:
    "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
  killed: "bg-muted text-muted-foreground border-border",
  timeout:
    "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
};

const statusLabels: Record<string, string> = {
  running: "Rodando",
  completed: "Concluido",
  failed: "Falhou",
  killed: "Cancelado",
  timeout: "Timeout",
};

function formatDuration(startedAt: number, durationMs?: number): string {
  const ms = durationMs ?? (Date.now() - startedAt);
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function formatMemory(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function JobDetailDrawer() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: job } = useQuery(jobQueryOptions(id));
  const { data: agents } = useQuery(agentsQueryOptions());

  const agentName =
    agents?.find((a) => a.id === job?.agentId)?.slug ?? job?.agentId ?? "";

  const isRunning = job?.status === "running";
  const isFinished = !isRunning && !!job;

  function closeDrawer() {
    navigate({ to: "/jobs" });
  }

  async function handleKill() {
    try {
      await killJob(id);
      toast.success("Job cancelado");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", id] });
    } catch {
      toast.error("Erro ao cancelar job");
    }
  }

  async function handleDelete() {
    try {
      await deleteJob(id);
      toast.success("Job removido");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      closeDrawer();
    } catch {
      toast.error("Erro ao remover job");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-2xl"
      >
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-3 pr-8">
            <Terminal className="size-5 text-muted-foreground" />
            <SheetTitle className="flex-1 truncate">
              {job?.command ?? "Carregando..."}
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Detalhes do job
          </SheetDescription>

          {job && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="outline" className={statusColors[job.status]}>
                {statusLabels[job.status]}
              </Badge>
              <Badge variant="outline">{agentName}</Badge>
              {job.pid && (
                <span className="text-xs text-muted-foreground">
                  PID {job.pid}
                </span>
              )}

              <div className="ml-auto flex gap-2">
                {isRunning && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleKill}
                  >
                    <Square className="mr-1.5 size-3.5" />
                    Cancelar
                  </Button>
                )}
                {isFinished && (
                  <ConfirmDialog
                    title="Remover job"
                    description="O job e seus logs serao removidos permanentemente."
                    onConfirm={handleDelete}
                    destructive
                  >
                    <Button variant="outline" size="sm">
                      <Trash2 className="mr-1.5 size-3.5" />
                      Limpar
                    </Button>
                  </ConfirmDialog>
                )}
              </div>
            </div>
          )}
        </SheetHeader>

        {job && (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 pt-0">
            {/* Terminal */}
            <TerminalOutput
              stdout={job.tail ?? ""}
              stderr=""
              streaming={isRunning}
              jobId={isRunning ? id : undefined}
            />

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                icon={<Clock className="size-4" />}
                label="Duracao"
                value={formatDuration(job.startedAt, job.durationMs)}
              />
              {job.resourceStats && (
                <>
                  <MetricCard
                    icon={<Cpu className="size-4" />}
                    label="CPU"
                    value={`${Math.round(job.resourceStats.cpu)}%`}
                  />
                  <MetricCard
                    icon={<MemoryStick className="size-4" />}
                    label="Memoria"
                    value={formatMemory(job.resourceStats.memory)}
                  />
                </>
              )}
              {job.exitCode != null && (
                <MetricCard
                  icon={<Hash className="size-4" />}
                  label="Exit code"
                  value={String(job.exitCode)}
                />
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
