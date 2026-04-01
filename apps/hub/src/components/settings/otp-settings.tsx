import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { request } from "@/lib/api";

interface OtpConfig {
  enabled: boolean;
  host: string;
  "api-key": string;
  instance: string;
  hasApiKey: boolean;
}

function otpQueryOptions() {
  return {
    queryKey: ["settings", "otp"],
    queryFn: () => request<OtpConfig>("/settings/otp"),
  };
}

export function OtpSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(otpQueryOptions());

  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instance, setInstance] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setHost(data.host);
      setApiKey("");
      setInstance(data.instance);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        enabled,
        host,
        instance,
      };
      if (apiKey.trim()) {
        body["api-key"] = apiKey.trim();
      }
      await request("/settings/otp", {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "otp"] });
      toast.success("Configuração OTP salva com sucesso");
      setApiKey("");
    },
    onError: () => toast.error("Erro ao salvar configuração OTP"),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Instância Evolution dedicada para envio de códigos OTP via WhatsApp.
        </p>
      </div>

      {/* Enable toggle */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Switch id="otp-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <div>
            <Label htmlFor="otp-enabled" className="text-sm font-medium cursor-pointer">
              Habilitado
            </Label>
            <p className="text-xs text-muted-foreground">
              Ativar autenticação em 2 etapas via WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* Evolution instance config */}
      <div className="rounded-lg border p-4 space-y-4">
        <p className="text-sm font-medium">Instância Evolution OTP</p>

        <div className="space-y-1.5">
          <Label htmlFor="otp-host" className="text-xs">Host (URL)</Label>
          <Input
            id="otp-host"
            type="url"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="https://evo.example.com"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="otp-api-key" className="text-xs">
            API Key
            {data?.hasApiKey && !apiKey && (
              <span className="ml-2 text-muted-foreground font-normal">(configurada — deixe em branco para manter)</span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="otp-api-key"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={data?.hasApiKey ? "••••••••••••" : "Chave de API da Evolution"}
              className="font-mono text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showApiKey ? "Ocultar API key" : "Mostrar API key"}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="otp-instance" className="text-xs">Instância</Label>
          <Input
            id="otp-instance"
            value={instance}
            onChange={(e) => setInstance(e.target.value)}
            placeholder="otp-instance"
            className="font-mono text-sm"
          />
        </div>

        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
