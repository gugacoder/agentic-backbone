import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  Clock,
  FileText,
  Plus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { complianceOverviewQueryOptions, generateReport } from "@/api/compliance";
import type { RiskLevel, ReportType } from "@/api/compliance";
import {
  lgpdDataMapQueryOptions,
  lgpdRightsRequestsQueryOptions,
} from "@/api/lgpd";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ComplianceSearch {
  tab?: "euaiact" | "lgpd";
}

export const Route = createFileRoute("/_authenticated/compliance/")({
  staticData: { title: "Conformidade", description: "Painel EU AI Act + LGPD" },
  validateSearch: (search: Record<string, unknown>): ComplianceSearch => ({
    tab:
      search.tab === "lgpd" || search.tab === "euaiact"
        ? (search.tab as "euaiact" | "lgpd")
        : undefined,
  }),
  component: CompliancePage,
});

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: "Alto risco",
  limited: "Risco limitado",
  minimal: "Risco mínimo",
};

const RISK_LEVEL_BADGE_VARIANT: Record<
  RiskLevel,
  "destructive" | "secondary" | "outline"
> = {
  high: "destructive",
  limited: "secondary",
  minimal: "outline",
};

function RiskIcon({ level }: { level: RiskLevel | null }) {
  if (level === "high") return <ShieldX className="size-4 text-destructive" />;
  if (level === "limited") return <ShieldAlert className="size-4 text-yellow-500" />;
  return <ShieldCheck className="size-4 text-green-500" />;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ─── System Report Button ────────────────────────────────────────────────────

function SystemReportButton() {
  const [reportType, setReportType] = useState<ReportType>("audit");
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      // System-level report — use a synthetic agentId "system"
      await generateReport("system", { reportType });
      toast.success("Relatório de sistema gerado");
    } catch {
      toast.error("Erro ao gerar relatório de sistema");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="audit">Auditoria</SelectItem>
          <SelectItem value="dpia">DPIA</SelectItem>
          <SelectItem value="human_oversight">Supervisão Humana</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleGenerate} disabled={generating}>
        <Plus className="mr-1 size-4" />
        Gerar Relatório de Sistema
      </Button>
    </div>
  );
}

// ─── EU AI Act Tab ────────────────────────────────────────────────────────────

function EuAiActTab() {
  const { data: overview, isLoading } = useQuery(complianceOverviewQueryOptions());

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!overview) return null;

  const nonCompliantCount = overview.nonCompliantItems.length;
  const overdueCount = overview.pendingReviews.filter((r) =>
    isOverdue(r.reviewDueAt),
  ).length;

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total de agentes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{overview.totalAgents}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Taxa de conformidade
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p
              className={`text-2xl font-bold ${
                overview.complianceRate >= 0.8
                  ? "text-green-600"
                  : overview.complianceRate >= 0.5
                    ? "text-yellow-600"
                    : "text-destructive"
              }`}
            >
              {Math.round(overview.complianceRate * 100)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="size-3" />
              Não conformes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p
              className={`text-2xl font-bold ${
                nonCompliantCount > 0 ? "text-destructive" : "text-green-600"
              }`}
            >
              {nonCompliantCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              Revisões vencidas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p
              className={`text-2xl font-bold ${
                overdueCount > 0 ? "text-destructive" : "text-green-600"
              }`}
            >
              {overdueCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk level distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Distribuição por nível de risco</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6 pb-4">
          {(["high", "limited", "minimal"] as RiskLevel[]).map((level) => (
            <div key={level} className="flex items-center gap-2">
              <RiskIcon level={level} />
              <span className="text-sm">
                <strong>{overview.byRiskLevel[level] ?? 0}</strong>{" "}
                <span className="text-muted-foreground">{RISK_LEVEL_LABELS[level]}</span>
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              <strong>{overview.totalAgents - (overview.byRiskLevel.high ?? 0) - (overview.byRiskLevel.limited ?? 0) - (overview.byRiskLevel.minimal ?? 0)}</strong>{" "}
              sem classificação
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Agents table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Agentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overview.agents.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum agente com classificação registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Nível de risco</TableHead>
                  <TableHead>Conformidade</TableHead>
                  <TableHead>Próxima revisão</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.agents.map((agent) => {
                  const pct = Math.round(agent.complianceRate * 100);
                  return (
                    <TableRow key={agent.agentId}>
                      <TableCell className="font-mono text-xs">{agent.agentId}</TableCell>
                      <TableCell>
                        {agent.riskLevel ? (
                          <Badge
                            variant={RISK_LEVEL_BADGE_VARIANT[agent.riskLevel]}
                            className="text-xs"
                          >
                            {RISK_LEVEL_LABELS[agent.riskLevel]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 80
                                  ? "bg-green-500"
                                  : pct >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs ${
                            agent.hasOverdueReview
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {agent.hasOverdueReview && (
                            <Clock className="inline size-3 mr-0.5" />
                          )}
                          {formatDate(agent.reviewDueAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/agents/$id"
                          params={{ id: agent.agentId }}
                          search={{ tab: "compliance" } as Record<string, unknown>}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          Ver
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {(nonCompliantCount > 0 || overdueCount > 0) && (
        <div className="space-y-2">
          {nonCompliantCount > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    {nonCompliantCount} item{nonCompliantCount !== 1 ? "s" : ""} não conforme
                    {nonCompliantCount !== 1 ? "s" : ""}
                  </p>
                  <ul className="space-y-0.5">
                    {overview.nonCompliantItems.slice(0, 5).map((item, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground">
                        <span className="font-mono">{item.agentId}</span> —{" "}
                        <span className="font-medium">{item.itemKey}</span> ({item.category})
                      </li>
                    ))}
                    {overview.nonCompliantItems.length > 5 && (
                      <li className="text-xs text-muted-foreground">
                        e mais {overview.nonCompliantItems.length - 5} item(s)…
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {overdueCount > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
              <div className="flex items-start gap-3">
                <Clock className="size-4 text-yellow-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    {overdueCount} revisão{overdueCount !== 1 ? "ões" : ""} vencida
                    {overdueCount !== 1 ? "s" : ""}
                  </p>
                  <ul className="space-y-0.5">
                    {overview.pendingReviews
                      .filter((r) => isOverdue(r.reviewDueAt))
                      .map((r, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground">
                          <span className="font-mono">{r.agentId}</span> — venceu em{" "}
                          {formatDate(r.reviewDueAt)}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LGPD Tab ─────────────────────────────────────────────────────────────────

function LgpdTab() {
  const { data: dataMap, isLoading: mapLoading } = useQuery(lgpdDataMapQueryOptions());
  const { data: rightsRequests, isLoading: rightsLoading } = useQuery(
    lgpdRightsRequestsQueryOptions(),
  );

  return (
    <div className="space-y-6">
      {/* Link to note about shared items */}
      <div className="rounded-lg border p-4 bg-muted/30 flex items-start gap-3">
        <FileText className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Itens compartilhados com EU AI Act</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            O item <strong>data_documentation</strong> do checklist EU AI Act está vinculado ao
            mapeamento de dados LGPD. Atualizações em qualquer um dos painéis refletem nos dois.
          </p>
        </div>
      </div>

      {/* Data map */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Mapa de Dados (LGPD)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {mapLoading ? (
            <div className="p-4">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !dataMap || dataMap.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum mapeamento de dados registrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Tipo de dado</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead>Base legal</TableHead>
                  <TableHead>Retenção (dias)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataMap.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">{entry.agent_id}</TableCell>
                    <TableCell className="text-xs">{entry.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.purpose}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.legal_basis}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.retention_days ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rights requests */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Solicitações de Direitos (LGPD)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rightsLoading ? (
            <div className="p-4">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !rightsRequests || rightsRequests.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma solicitação registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Solicitado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rightsRequests.slice(0, 20).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.user_ref}</TableCell>
                    <TableCell className="text-xs">{r.right_type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "resolved"
                            ? "default"
                            : r.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(r.requested_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CompliancePage() {
  const { tab } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<"euaiact" | "lgpd">(tab ?? "euaiact");

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<SystemReportButton />}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "euaiact" | "lgpd")}>
        <TabsList>
          <TabsTrigger value="euaiact">
            <ShieldCheck className="mr-1.5 size-4" />
            EU AI Act
          </TabsTrigger>
          <TabsTrigger value="lgpd">
            <FileText className="mr-1.5 size-4" />
            LGPD
          </TabsTrigger>
        </TabsList>

        <TabsContent value="euaiact" className="mt-4">
          <EuAiActTab />
        </TabsContent>

        <TabsContent value="lgpd" className="mt-4">
          <LgpdTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
