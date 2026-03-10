import { useQuery } from "@tanstack/react-query";
import { healthQuery, systemStatsQuery, globalHeartbeatStatsQuery } from "@/api/system";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { useSSE } from "@/hooks/use-sse";
import { Bot, Radio, MessageSquare, Activity, HeartPulse } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { GlobalAgentStats } from "@/api/types";

const STATUS_COLORS: Record<string, string> = {
  "ok-token": "bg-chart-1",
  sent: "bg-chart-2",
  skipped: "bg-chart-4",
  failed: "bg-destructive",
};

export function DashboardPage() {
  const { data: health } = useQuery(healthQuery);
  const { data: stats } = useQuery(systemStatsQuery);
  const { data: heartbeatStats } = useQuery(globalHeartbeatStatsQuery);
  const [events, setEvents] = useState<{ ts: number; type: string; data: unknown }[]>([]);

  useSSE({
    url: "/system/events",
    onEvent: (type, data) => {
      setEvents((prev) => [{ ts: Date.now(), type, data }, ...prev].slice(0, 50));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="System overview and real-time events" />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <StatusBadge status={health?.status ?? "connecting"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.agents ?? health?.agents.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {health?.agents.filter((a) => a.heartbeat).length ?? 0} with heartbeat
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Channels</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.channels ?? health?.channels.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {health?.channels.reduce((sum, ch) => sum + ch.listeners, 0) ?? 0} listeners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sessions ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Uptime: {stats ? formatUptime(stats.uptime) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {heartbeatStats && heartbeatStats.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Heartbeat Health</CardTitle>
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {heartbeatStats.map((agent) => (
                <HeartbeatAgentRow key={agent.agentId} agent={agent} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Waiting for events...</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {events.map((evt, i) => (
                <div key={i} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(evt.ts).toLocaleTimeString()}
                  </span>
                  <StatusBadge status={evt.type.replace("heartbeat:", "")} />
                  <span className="text-muted-foreground truncate">
                    {JSON.stringify(evt.data).slice(0, 120)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HeartbeatAgentRow({ agent }: { agent: GlobalAgentStats }) {
  const total = agent.totalExecutions;
  const segments = Object.entries(agent.countByStatus)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => {
      const order = ["ok-token", "sent", "skipped", "failed"];
      return order.indexOf(a) - order.indexOf(b);
    });

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link
        to="/agents/$agentId"
        params={{ agentId: agent.agentId }}
        search={{ tab: "heartbeat", file: "SOUL.md" }}
        className="text-sm font-medium hover:underline min-w-[140px] truncate"
      >
        {agent.agentId}
      </Link>
      <div className="flex h-2 w-20 rounded-full overflow-hidden shrink-0">
        {segments.map(([status, count]) => (
          <div
            key={status}
            className={STATUS_COLORS[status] ?? "bg-muted"}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${status}: ${count}`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {total} ticks
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        ${agent.totalCostUsd.toFixed(4)}
      </span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
