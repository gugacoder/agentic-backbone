import { useState } from "react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InstanceStatusCard } from "@/components/connectivity/instance-status-card";
import { InstanceEventFeed } from "@/components/connectivity/instance-event-feed";
import { InstanceQR } from "@/components/connectivity/instance-qr";
import { InstanceSettingsForm } from "@/components/connectivity/instance-settings-form";
import {
  evolutionInstanceQuery,
  useReconnectInstance,
  useRestartInstance,
  useDeleteInstance,
} from "@/api/evolution";
import { toast } from "sonner";

export function WhatsAppInstancePage() {
  const { name } = useParams({ strict: false }) as { name: string };
  const { tab } = useSearch({ strict: false }) as { tab: string };
  const navigate = useNavigate();
  const activeTab = ["status", "qr", "settings"].includes(tab) ? tab : "status";

  const { data: instance, isLoading } = useQuery(evolutionInstanceQuery(name));
  const reconnect = useReconnectInstance();
  const restart = useRestartInstance();
  const deleteInstance = useDeleteInstance();

  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleTabChange(value: string) {
    navigate({
      to: "/conectividade/whatsapp/$name",
      params: { name },
      search: { tab: value as "status" | "qr" | "settings" },
      replace: true,
    });
  }

  function handleReconnect() {
    reconnect.mutate(name, {
      onSuccess: () => toast.success("Reconexao solicitada"),
      onError: (err) => toast.error(`Falha: ${err.message}`),
    });
  }

  function handleRestart() {
    restart.mutate(name, {
      onSuccess: () => toast.success("Reinicio solicitado"),
      onError: (err) => toast.error(`Falha: ${err.message}`),
    });
  }

  function handleDelete() {
    deleteInstance.mutate(name, {
      onSuccess: () => {
        toast.success(`Instancia "${name}" excluida`);
        navigate({ to: "/conectividade/whatsapp", search: { view: "instances" } });
      },
      onError: (err) => toast.error(`Falha ao excluir: ${err.message}`),
    });
  }

  const isOnline = instance?.state === "open";

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={instance?.owner ?? "Nao vinculado"}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isOnline || reconnect.isPending}
              onClick={handleReconnect}
            >
              {reconnect.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-2" />}
              Reconectar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isOnline || restart.isPending}
              onClick={handleRestart}
            >
              {restart.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RotateCcw className="h-4 w-4 mr-2" />}
              Reiniciar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="qr">QR Code</TabsTrigger>
          <TabsTrigger value="settings">Configuracoes</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : instance ? (
            <>
              <InstanceStatusCard instance={instance} />
              <InstanceEventFeed instanceName={name} />
            </>
          ) : (
            <p className="text-muted-foreground">Instancia nao encontrada.</p>
          )}
        </TabsContent>

        <TabsContent value="qr">
          <InstanceQR instanceName={name} />
        </TabsContent>

        <TabsContent value="settings">
          <InstanceSettingsForm instanceName={name} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir Instancia"
        description={`Tem certeza que deseja excluir a instancia "${name}"? Esta acao nao pode ser desfeita.`}
        confirmText="Excluir"
        variant="destructive"
        typedConfirm={name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
