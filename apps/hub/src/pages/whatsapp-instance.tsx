import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, RotateCcw, Trash2, Loader2, AlertTriangle, ArrowLeft, ServerOff } from "lucide-react";
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
  friendlyMessage,
} from "@/api/evolution";
import type { ApiResult } from "@/api/evolution";
import { toast } from "sonner";

interface ActionState {
  cooldownUntil: number | null;
  exhausted: boolean;
}

function useActionState() {
  const [state, setState] = useState<ActionState>({ cooldownUntil: null, exhausted: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleResult = useCallback((result: ApiResult<unknown>) => {
    if (result.ok) return false;

    if (result.error === "cooldown_active" && result.retryAfterMs) {
      const ms = result.retryAfterMs;
      setState({ cooldownUntil: Date.now() + ms, exhausted: false });
      timerRef.current = setTimeout(() => {
        setState((s) => ({ ...s, cooldownUntil: null }));
      }, ms);
      toast.error(friendlyMessage("cooldown_active"));
      return true;
    }

    if (result.error === "retries_exhausted") {
      setState({ cooldownUntil: null, exhausted: true });
      toast.error(friendlyMessage("retries_exhausted"));
      return true;
    }

    toast.error(friendlyMessage(result.error ?? ""));
    return true;
  }, []);

  const remainingSeconds = state.cooldownUntil
    ? Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000))
    : 0;

  return {
    isCooldown: !!state.cooldownUntil && remainingSeconds > 0,
    isExhausted: state.exhausted,
    remainingSeconds,
    handleResult,
  };
}

export function WhatsAppInstancePage() {
  const { name } = useParams({ strict: false }) as { name: string };
  const { tab } = useSearch({ strict: false }) as { tab: string };
  const navigate = useNavigate();
  const activeTab = ["status", "qr", "settings"].includes(tab) ? tab : "status";

  const { data: result, isLoading, refetch } = useQuery(evolutionInstanceQuery(name));
  const instance = result?.ok ? result.data : undefined;
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
      onSuccess: (result) => {
        if (reconnectState.handleResult(result)) return;
        toast.success("Reconexao solicitada");
      },
      onError: (err) => toast.error(`Falha: ${err.message}`),
    });
  }

  function handleRestart() {
    restart.mutate(name, {
      onSuccess: (result) => {
        if (restartState.handleResult(result)) return;
        toast.success("Reinicio solicitado");
      },
      onError: (err) => toast.error(`Falha: ${err.message}`),
    });
  }

  function handleDelete() {
    deleteInstance.mutate(name, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast.error(friendlyMessage(result.error ?? ""));
          return;
        }
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
          ) : result?.error === "api_offline" ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <ServerOff className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Evolution API indisponivel</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                O backbone nao conseguiu consultar a Evolution API. Verifique se o servico esta ativo.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <AlertTriangle className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Instancia nao encontrada</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                A instancia &quot;{name}&quot; nao existe ou foi removida.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/conectividade/whatsapp", search: { view: "instances" } })}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para instancias
              </Button>
            </div>
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
