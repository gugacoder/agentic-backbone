import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { agentsQuery, useToggleAgent, useToggleHeartbeat, useDeleteAgent } from "@/api/agents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Bot, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";

export function AgentsPage() {
  const { data: agents, isLoading, isError, error } = useQuery(agentsQuery);
  const toggleAgent = useToggleAgent();
  const toggleHeartbeat = useToggleHeartbeat();
  const deleteAgent = useDeleteAgent();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (isLoading) {
    return <div className="space-y-4"><PageHeader title="Agents" /><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Agents" />
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load agents"
          description={error?.message ?? "Check your connection and authentication."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description={`${agents?.length ?? 0} agent(s) registered`}
      />

      {!agents?.length ? (
        <EmptyState
          icon={Bot}
          title="No agents"
          description="Create your first agent to get started."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="group relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={agent.enabled}
                      onCheckedChange={(enabled) =>
                        toggleAgent.mutate({ id: agent.id, enabled })
                      }
                    />
                    <Link to="/agents/$agentId" params={{ agentId: agent.id }} search={{ tab: "files", file: "SOUL.md" }}>
                      <CardTitle className={`text-base hover:underline${agent.enabled ? "" : " text-muted-foreground"}`}>
                        {agent.id}
                      </CardTitle>
                    </Link>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteTarget(agent.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <p className={`text-sm line-clamp-2${agent.enabled ? " text-muted-foreground" : " text-muted-foreground/50"}`}>
                  {agent.description || "No description"}
                </p>
              </CardHeader>
              <CardContent>
                {agent.enabled ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Heartbeat</span>
                      <Switch
                        checked={agent.heartbeat.enabled}
                        onCheckedChange={(enabled) =>
                          toggleHeartbeat.mutate({ id: agent.id, enabled })
                        }
                      />
                    </div>
                    <StatusBadge status={agent.heartbeat.enabled ? "active" : "pending"} />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/50">Agent disabled</span>
                    <StatusBadge status="disabled" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Agent"
        description={`Are you sure you want to delete ${deleteTarget}? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        typedConfirm={deleteTarget ?? ""}
        onConfirm={() => {
          if (deleteTarget) deleteAgent.mutate(deleteTarget);
        }}
      />
    </div>
  );
}
