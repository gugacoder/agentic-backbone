import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Globe, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { request } from "@/lib/api";

interface NgrokConfig {
  domain?: string;
  enabled?: boolean;
  hasAuthtoken?: boolean;
}

interface NgrokStatus {
  running: boolean;
  url?: string;
  error?: string;
}

interface NgrokData {
  config: NgrokConfig;
  status: NgrokStatus;
}

function ngrokQueryOptions() {
  return {
    queryKey: ["settings", "ngrok"],
    queryFn: () => request<NgrokData>("/settings/infrastructure/ngrok"),
  };
}

export function NgrokSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    ...ngrokQueryOptions(),
    refetchInterval: 30000,
  });

  const [editingAuthtoken, setEditingAuthtoken] = useState(false);
  const [authtoken, setAuthtoken] = useState("");
  const [domain, setDomain] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (data) {
      setDomain(data.config.domain ?? "");
      setEnabled(data.config.enabled ?? false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (updates: { authtoken?: string; domain?: string; enabled?: boolean }) => {
      await request("/settings/infrastructure/ngrok", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "ngrok"] });
      toast.success("Configuração ngrok salva");
    },
    onError: () => toast.error("Erro ao salvar configuração ngrok"),
  });

  async function handleSaveAuthtoken() {
    if (!authtoken.trim()) return;
    await saveMutation.mutateAsync({ authtoken: authtoken.trim() });
    setEditingAuthtoken(false);
    setAuthtoken("");
  }

  async function handleSaveConfig() {
    await saveMutation.mutateAsync({ domain: domain || undefined, enabled });
  }

  async function handleStart() {
    setStarting(true);
    try {
      const status = await request<NgrokStatus>("/settings/infrastructure/ngrok/start", { method: "POST" });
      if (status.running) {
        toast.success(`ngrok iniciado: ${status.url}`);
      } else {
        toast.error(status.error ?? "Falha ao iniciar ngrok");
      }
      // Poll for status update
      let polls = 0;
      const interval = setInterval(async () => {
        polls++;
        queryClient.invalidateQueries({ queryKey: ["settings", "ngrok"] });
        if (polls >= 12) clearInterval(interval);
      }, 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar ngrok");
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    try {
      await request("/settings/infrastructure/ngrok/stop", { method: "POST" });
      toast.success("ngrok parado");
      queryClient.invalidateQueries({ queryKey: ["settings", "ngrok"] });
    } catch {
      toast.error("Erro ao parar ngrok");
    } finally {
      setStopping(false);
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  const status = data?.status;
  const config = data?.config;
  const isBusy = starting || stopping || saveMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Gerencie o túnel ngrok para expor o backbone à internet.
        </p>
      </div>

      {/* Status */}
      <div className={`rounded-lg border p-4 flex items-center justify-between ${status?.running ? "border-green-300 bg-green-50 dark:bg-green-950/20" : "border-muted"}`}>
        <div className="flex items-center gap-2">
          {status?.running
            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
            : <XCircle className="h-4 w-4 text-muted-foreground" />}
          <div>
            <p className="text-sm font-medium">{status?.running ? "Rodando" : "Parado"}</p>
            {status?.url && (
              <a
                href={status.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                {status.url}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!status?.running ? (
            <Button size="sm" onClick={handleStart} disabled={isBusy || !config?.hasAuthtoken}>
              {starting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Iniciar
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleStop} disabled={isBusy}>
              {stopping && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Parar
            </Button>
          )}
        </div>
      </div>

      {/* Auth Token */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auth Token</p>
            <p className="text-xs text-muted-foreground">
              {config?.hasAuthtoken ? "Configurado" : "Não configurado"}
            </p>
          </div>
          {!editingAuthtoken && (
            <Button size="sm" variant="outline" onClick={() => setEditingAuthtoken(true)}>
              {config?.hasAuthtoken ? "Alterar" : "Configurar"}
            </Button>
          )}
        </div>
        {editingAuthtoken && (
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs">Auth Token ngrok</Label>
            <Input
              type="password"
              value={authtoken}
              onChange={(e) => setAuthtoken(e.target.value)}
              placeholder="2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveAuthtoken} disabled={isBusy || !authtoken.trim()}>
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingAuthtoken(false); setAuthtoken(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Domain & Auto-start */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Configurações</p>
        <div className="space-y-1.5">
          <Label htmlFor="ngrok-domain" className="text-xs">Domínio fixo (opcional)</Label>
          <Input
            id="ngrok-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="seu-dominio.ngrok-free.dev"
            className="font-mono text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ngrok-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="ngrok-enabled" className="text-sm">Iniciar automaticamente</Label>
        </div>
        <Button size="sm" onClick={handleSaveConfig} disabled={isBusy}>
          {saveMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
