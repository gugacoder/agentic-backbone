import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Activity,
  DollarSign,
  MessageSquare,
  Calendar,
  Cpu,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { UpcomingCronJobs } from "@/components/dashboard/upcoming-cron-jobs";
import { QuotaAlertWidget } from "@/components/quotas/quota-alert-widget";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardQueryOptions, type DashboardData } from "@/api/dashboard";

export const Route = createFileRoute("/_authenticated/")({
  staticData: { title: "Dashboard", description: "Visão geral da plataforma" },
  component: DashboardPage,
});

function getHeartbeatStatus(heartbeats: DashboardData["heartbeats"]): "ok" | "warning" | "error" {
  const { total, error } = heartbeats.today;
  if (total === 0) return "ok";
  const rate = error / total;
  if (rate > 0.25) return "error";
  if (rate > 0.1) return "warning";
  return "ok";
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function DashboardPage() {
  const { data, isLoading } = useQuery(dashboardQueryOptions());

  return (
    <div className="space-y-6">
      {isLoading || !data ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Agentes"
            value={`${data.agents.enabled} ativos`}
            subtitle={`de ${data.agents.total} cadastrados`}
            icon={Bot}
            status="ok"
            href="/agents"
          />
          <StatCard
            title="Heartbeats"
            value={`${data.heartbeats.today.ok} ok`}
            subtitle={`${data.heartbeats.today.error} erros hoje`}
            icon={Activity}
            status={getHeartbeatStatus(data.heartbeats)}
            href="/agents"
          />
          <StatCard
            title="Custos"
            value={formatCurrency(data.heartbeats.costToday)}
            subtitle="hoje"
            icon={DollarSign}
            status="ok"
            href="/costs"
          />
          <StatCard
            title="Conversas"
            value={`${data.conversations.today} hoje`}
            subtitle={`${data.conversations.totalSessions} total`}
            icon={MessageSquare}
            status="ok"
            href="/conversations"
          />
          <StatCard
            title="Cron Jobs"
            value={`${data.cronJobs.enabled} ativos`}
            subtitle={
              data.cronJobs.nextRuns[0]
                ? `proximo: ${new Date(data.cronJobs.nextRuns[0].nextRun).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : undefined
            }
            icon={Calendar}
            status="ok"
            href="/cron"
          />
          <StatCard
            title="Jobs"
            value={`${data.jobs.running} rodando`}
            subtitle={`${data.jobs.completed} concluidos`}
            icon={Cpu}
            status={data.jobs.failed > 0 ? "error" : "ok"}
            href="/jobs"
          />
        </div>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ActivityTimeline events={data.recentActivity} />
          <UpcomingCronJobs jobs={data.cronJobs.nextRuns} />
        </div>
      )}

      <QuotaAlertWidget />
    </div>
  );
}
