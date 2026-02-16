import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ApiHealthCard } from "@/components/connectivity/api-health-card";
import { InstanceSummaryCards } from "@/components/connectivity/instance-summary-cards";
import { InstanceTable } from "@/components/connectivity/instance-table";
import { CreateInstanceDialog } from "@/components/connectivity/create-instance-dialog";
import { evolutionInstancesQuery, useDeleteInstance } from "@/api/evolution";
import { useEvolutionSSE } from "@/hooks/use-evolution-sse";
import { toast } from "sonner";

export function WhatsAppPage() {
  const navigate = useNavigate();
  const { view } = useSearch({ strict: false }) as { view: string };
  const activeTab = view === "instances" ? "instances" : "monitor";

  const { data: instances = [], isLoading } = useQuery(evolutionInstancesQuery);
  const deleteInstance = useDeleteInstance();
  useEvolutionSSE();

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
      onSuccess: () => {
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
          <InstanceSummaryCards instances={instances} />
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Carregando instancias...</p>
            </div>
          ) : (
            <InstanceTable instances={instances} variant="monitor" />
          )}
        </TabsContent>

        <TabsContent value="instances" className="space-y-6">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Carregando instancias...</p>
            </div>
          ) : (
            <InstanceTable
              instances={instances}
              variant="instances"
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
