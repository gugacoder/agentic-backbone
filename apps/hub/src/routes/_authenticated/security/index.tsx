import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { securitySummaryQueryOptions } from "@/api/security";
import { SecuritySummaryCards } from "@/components/security/security-summary-cards";
import { SecurityTrendChart } from "@/components/security/security-trend-chart";
import { SecurityEventTable } from "@/components/security/security-event-table";
import { SecurityRulesTab } from "@/components/security/security-rules-tab";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/security/")({
  component: SecurityPage,
});

function SecurityPage() {
  const [activeTab, setActiveTab] = useState<"events" | "rules">("events");
  const [activeDays, setActiveDays] = useState(7);

  const { data: summary, isLoading } = useQuery(securitySummaryQueryOptions(activeDays));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguranca"
        description="Monitoramento de eventos de seguranca e gestao de regras de protecao"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeDays === 7 ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setActiveDays(7)}
            >
              7 dias
            </Button>
            <Button
              size="sm"
              variant={activeDays === 30 ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setActiveDays(30)}
            >
              30 dias
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "events" | "rules")}>
        <TabsList>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-56 rounded-lg" />
            </div>
          ) : summary ? (
            <>
              <SecuritySummaryCards summary={summary} />
              <SecurityTrendChart trend={summary.trend} />

              {/* Agentes mais visados */}
              {summary.byAgent.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Agentes Mais Visados</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agente</TableHead>
                          <TableHead className="text-right">Eventos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.byAgent.slice(0, 5).map((a: { agent_id: string; count: number }) => (
                          <TableRow key={a.agent_id}>
                            <TableCell className="font-mono text-xs">{a.agent_id}</TableCell>
                            <TableCell className="text-right text-xs">{a.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <SecurityEventTable days={activeDays} />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <SecurityRulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
