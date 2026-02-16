import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import {
  agentQuery,
  agentFilesQuery,
  agentFileQuery,
  agentHeartbeatQuery,
  agentMemoryStatusQuery,
  heartbeatHistoryQuery,
  heartbeatStatsQuery,
  useSaveAgentFile,
  useToggleHeartbeat,
} from "@/api/agents";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { MarkdownEditor } from "@/components/shared/markdown-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSSE } from "@/hooks/use-sse";
import { Save, Activity, CheckCircle, Cpu, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import type { HeartbeatStats } from "@/api/types";

const PAGE_SIZE = 20;

export function AgentDetailPage() {
  const { agentId } = useParams({ strict: false }) as { agentId: string };
  const { tab, file: activeFile } = useSearch({ strict: false }) as { tab: string; file: string };
  const navigate = useNavigate({ from: "/agents/$agentId" });

  const { data: agent } = useQuery(agentQuery(agentId));
  const { data: files } = useQuery(agentFilesQuery(agentId));
  const { data: heartbeat } = useQuery(agentHeartbeatQuery(agentId));
  const { data: memoryStatus } = useQuery(agentMemoryStatusQuery(agentId));

  const { data: fileData } = useQuery(agentFileQuery(agentId, activeFile));
  const [editorContent, setEditorContent] = useState("");
  const saveFile = useSaveAgentFile();
  const toggleHb = useToggleHeartbeat();

  useEffect(() => {
    if (fileData?.content !== undefined) {
      setEditorContent(fileData.content);
    }
  }, [fileData?.content]);

  const setTab = (value: string) => {
    navigate({ search: (prev) => ({ ...prev, tab: value }), replace: true });
  };

  const setActiveFile = (value: string) => {
    navigate({ search: (prev) => ({ ...prev, file: value }), replace: true });
  };

  if (!agent) {
    return <div className="p-6"><p className="text-muted-foreground">Loading agent...</p></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={agent.id}
        description={agent.description || "No description"}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Heartbeat</span>
            <Switch
              checked={agent.heartbeat.enabled}
              onCheckedChange={(enabled) => toggleHb.mutate({ id: agent.id, enabled })}
            />
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="heartbeat">Heartbeat</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(files ?? ["AGENT.md", "SOUL.md", "HEARTBEAT.md", "MEMORY.md"]).filter(f => f.endsWith(".md")).map((f) => (
              <Button
                key={f}
                variant={activeFile === f ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFile(f)}
              >
                {f}
              </Button>
            ))}
          </div>
          <MarkdownEditor
            value={editorContent}
            onChange={setEditorContent}
            minHeight="300px"
          />
          <Button
            onClick={() => saveFile.mutate({ id: agentId, filename: activeFile, content: editorContent })}
            disabled={saveFile.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save {activeFile}
          </Button>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle className="text-base">Agent Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">ID:</span> {agent.id}</div>
                <div><span className="text-muted-foreground">Owner:</span> {agent.owner}</div>
                <div><span className="text-muted-foreground">Slug:</span> {agent.slug}</div>
                <div><span className="text-muted-foreground">Delivery:</span> {agent.delivery || "none"}</div>
                <div><span className="text-muted-foreground">Heartbeat Interval:</span> {agent.heartbeat.intervalMs}ms</div>
              </div>
              {Object.keys(agent.metadata).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Metadata</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                    {JSON.stringify(agent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heartbeat" className="space-y-4">
          <HeartbeatPanel agentId={agentId} />
        </TabsContent>

        <TabsContent value="memory">
          <Card>
            <CardHeader><CardTitle className="text-base">Memory Index</CardTitle></CardHeader>
            <CardContent>
              {memoryStatus ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Files indexed:</span> {memoryStatus.fileCount}</div>
                  <div><span className="text-muted-foreground">Chunks:</span> {memoryStatus.chunkCount}</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No memory data</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Heartbeat Monitoring Panel ---

function HeartbeatPanel({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const { data: stats } = useQuery(heartbeatStatsQuery(agentId));
  const { data: history } = useQuery(heartbeatHistoryQuery(agentId, PAGE_SIZE, offset));

  // SSE real-time invalidation
  useSSE({
    url: "/system/events",
    onEvent: (type, data) => {
      if (
        type === "heartbeat:status" &&
        (data as Record<string, unknown>)?.agentId === agentId
      ) {
        queryClient.invalidateQueries({ queryKey: ["agents", agentId, "heartbeat"] });
      }
    },
  });

  return (
    <div className="space-y-4">
      {stats && <SummaryCards stats={stats} />}
      {stats && <StatusDistributionBar stats={stats} />}
      <HeartbeatHistoryTable
        rows={history?.rows ?? []}
        total={history?.total ?? 0}
        page={page}
        onPageChange={setPage}
      />
    </div>
  );
}

function SummaryCards({ stats }: { stats: HeartbeatStats }) {
  const executed = stats.totalExecutions - (stats.countByStatus["skipped"] ?? 0);
  const successCount = (stats.countByStatus["ok-token"] ?? 0) + (stats.countByStatus["sent"] ?? 0);
  const successRate = executed > 0 ? (successCount / executed) * 100 : 0;
  const totalTokens = stats.totalInputTokens + stats.totalOutputTokens;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalExecutions}</div>
          <p className="text-xs text-muted-foreground">
            Avg {formatDuration(stats.avgDurationMs)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {successCount} of {executed} executed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(totalTokens)}</div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(stats.totalInputTokens)} in / {formatNumber(stats.totalOutputTokens)} out
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.totalCostUsd.toFixed(4)}</div>
          <p className="text-xs text-muted-foreground">
            Cache: {formatNumber(stats.totalCacheReadTokens)} read
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  "ok-token": "bg-chart-1",
  sent: "bg-chart-2",
  skipped: "bg-chart-4",
  failed: "bg-destructive",
};

function StatusDistributionBar({ stats }: { stats: HeartbeatStats }) {
  const total = stats.totalExecutions;
  if (total === 0) return null;

  const segments = Object.entries(stats.countByStatus)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => {
      const order = ["ok-token", "sent", "skipped", "failed"];
      return order.indexOf(a) - order.indexOf(b);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-4 rounded-md overflow-hidden">
          {segments.map(([status, count]) => (
            <div
              key={status}
              className={`${STATUS_COLORS[status] ?? "bg-muted"}`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${status}: ${count}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          {segments.map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status] ?? "bg-muted"}`} />
              <span className="text-muted-foreground">
                {status}: {count} ({((count / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HeartbeatHistoryTable({
  rows,
  total,
  page,
  onPageChange,
}: {
  rows: { id: number; ts: string; status: string; duration_ms: number | null; input_tokens: number; output_tokens: number; cache_read_tokens: number; cost_usd: number; reason: string | null }[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const maxTokens = Math.max(1, ...rows.map((r) => r.input_tokens + r.output_tokens));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">History</CardTitle>
        <span className="text-xs text-muted-foreground">{total} total</span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No heartbeat executions recorded yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cache</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const totalTkns = row.input_tokens + row.output_tokens;
                  const barWidth = (totalTkns / maxTokens) * 100;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.ts + "Z").toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.duration_ms != null ? formatDuration(row.duration_ms) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-chart-2 rounded-full"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(totalTkns)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatNumber(row.cache_read_tokens)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.cost_usd > 0 ? `$${row.cost_usd.toFixed(4)}` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {row.reason ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => onPageChange(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => onPageChange(page + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Utilities ---

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
