import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

interface ActionState {
  cooldownUntil: number | null;
  exhausted: boolean;
}

function useActionState() {
  const [state, setState] = useState<ActionState>({ cooldownUntil: null, exhausted: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleError = useCallback((err: Error) => {
    if (err instanceof ApiError) {
      if (err.status === 429 && err.data?.retryAfterMs) {
        const ms = err.data.retryAfterMs as number;
        setState({ cooldownUntil: Date.now() + ms, exhausted: false });
        timerRef.current = setTimeout(() => {
          setState((s) => ({ ...s, cooldownUntil: null }));
        }, ms);
        toast.error(`Aguarde ${Math.ceil(ms / 60_000)}min antes de tentar novamente`);
        return;
      }
      if (err.status === 409) {
        setState({ cooldownUntil: null, exhausted: true });
        toast.error("Tentativas esgotadas");
        return;
      }
    }
    toast.error(`Falha: ${err.message}`);
  }, []);

  const remainingSeconds = state.cooldownUntil
    ? Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000))
    : 0;

  return {
    isCooldown: !!state.cooldownUntil && remainingSeconds > 0,
    isExhausted: state.exhausted,
    remainingSeconds,
    handleError,
  };
}

export function WhatsAppInstancePage() {
  const { name } = useParams({ strict: false }) as { name: string };
  const { tab } = useSearch({ strict: false }) as { tab: string };
  const navigate = useNavigate();
  const activeTab = ["status", "qr", "settings"].includes(tab) ? tab : "status";

  const { data: instance, isLoading } = useQuery(evolutionInstanceQuery(name));
  const reconnect = useReconnectInstance();
  const restart = useRestartInstance();
  const deleteInstance = useDeleteInstance();

  const reconnectState = useActionState();
  const restartState = useActionState();

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
      onError: reconnectState.handleError,
    });
  }

  function handleRestart() {
    restart.mutate(name, {
      onSuccess: () => toast.success("Reinicio solicitado"),
      onError: restartState.handleError,
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
  const reconnectDisabled = isOnline || reconnect.isPending || reconnectState.isCooldown || reconnectState.isExhausted;
  const restartDisabled = isOnline || restart.isPending || restartState.isCooldown || restartState.isExhausted;

  function getTooltip(actionState: ReturnType<typeof useActionState>): string | null {
    if (actionState.isExhausted) return "Tentativas esgotadas";
    if (actionState.isCooldown) {
      const mins = Math.ceil(actionState.remainingSeconds / 60);
      return `Aguarde ${mins}min`;
    }
    return null;
  }

  const reconnectTooltip = getTooltip(reconnectState);
  const restartTooltip = getTooltip(restartState);

  const actionButtons = (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="sm"
              disabled={reconnectDisabled}
              onClick={handleReconnect}
            >
              {reconnect.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-2" />}
              Reconectar
            </Button>
          </span>
        </TooltipTrigger>
        {reconnectTooltip && (
          <TooltipContent>{reconnectTooltip}</TooltipContent>
        )}
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="sm"
              disabled={restartDisabled}
              onClick={handleRestart}
            >
              {restart.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RotateCcw className="h-4 w-4 mr-2" />}
              Reiniciar
            </Button>
          </span>
        </TooltipTrigger>
        {restartTooltip && (
          <TooltipContent>{restartTooltip}</TooltipContent>
        )}
      </Tooltip>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Excluir
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={instance?.owner ?? "Nao vinculado"}
        actions={<div className="hidden md:block">{actionButtons}</div>}
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
              <div className="md:hidden">{actionButtons}</div>
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
