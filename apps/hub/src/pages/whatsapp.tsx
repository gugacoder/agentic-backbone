import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ApiHealthCard } from "@/components/connectivity/api-health-card";
import { InstanceSummaryCards } from "@/components/connectivity/instance-summary-cards";
import { InstanceTable } from "@/components/connectivity/instance-table";
import { CreateInstanceDialog } from "@/components/connectivity/create-instance-dialog";
import { evolutionInstancesQuery, useDeleteInstance, friendlyMessage } from "@/api/evolution";
import { useEvolutionAlertsStore } from "@/hooks/use-evolution-sse";
import { toast } from "sonner";

export function WhatsAppPage() {
  const navigate = useNavigate();
  const { view } = useSearch({ strict: false }) as { view: string };
  const activeTab = view === "instances" ? "instances" : "monitor";

  const { data: instances = [], isLoading, isError, error, refetch } = useQuery(evolutionInstancesQuery);
  const deleteInstance = useDeleteInstance();
  const { alerts } = useEvolutionAlertsStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function handleTabChange(value: string) {
    navigate({
      to: "/conectividade/whatsapp",
      search: { view: value as "monitor" | "instances" },
      replace: true,
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteInstance.mutate(deleteTarget, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast.error(friendlyMessage(result.error ?? ""));
          setDeleteTarget(null);
          return;
        }
        toast.success(`Instancia "${deleteTarget}" excluida`);
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(`Falha ao excluir: ${err.message}`);
        setDeleteTarget(null);
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        description="Gestao de conectividade WhatsApp via Evolution API"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Instancia
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
          <TabsTrigger value="instances">Instancias</TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="space-y-6">
          <ApiHealthCard />
          <InstanceSummaryCards instances={isError ? [] : instances} />
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Carregando instancias...</p>
            </div>
          ) : isError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <h3 className="text-lg font-semibold">Falha ao carregar instancias</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {error?.message || "Erro desconhecido ao consultar o backbone"}
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <InstanceTable instances={instances} variant="monitor" alerts={alerts} />
          )}
        </TabsContent>

        <TabsContent value="instances" className="space-y-6">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Carregando instancias...</p>
            </div>
          ) : isError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <h3 className="text-lg font-semibold">Falha ao carregar instancias</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {error?.message || "Erro desconhecido ao consultar o backbone"}
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <InstanceTable
              instances={instances}
              variant="instances"
              alerts={alerts}
              onDelete={setDeleteTarget}
            />
          )}
        </TabsContent>
      </Tabs>

      <CreateInstanceDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Excluir Instancia"
        description={`Tem certeza que deseja excluir a instancia "${deleteTarget}"? Esta acao nao pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        typedConfirm={deleteTarget ?? ""}
        onConfirm={handleDelete}
      />
    </div>
  );
}
