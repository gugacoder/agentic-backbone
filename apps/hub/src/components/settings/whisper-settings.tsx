import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { request } from "@/lib/api";

interface WhisperConfig {
  model: string;
  computeType: string;
}

interface WhisperHealth {
  available: boolean;
  model?: string;
  url?: string;
  reason?: string;
}

function whisperQueryOptions() {
  return {
    queryKey: ["settings", "whisper"],
    queryFn: () => request<WhisperConfig>("/settings/infrastructure/whisper"),
  };
}

export function WhisperSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(whisperQueryOptions());

  const [model, setModel] = useState("");
  const [computeType, setComputeType] = useState("");
  const [health, setHealth] = useState<WhisperHealth | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (data) {
      setModel(data.model);
      setComputeType(data.computeType);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<WhisperConfig>) =>
      request("/settings/infrastructure/whisper", {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "whisper"] });
      toast.success("Configuração Whisper salva");
    },
    onError: () => toast.error("Erro ao salvar configuração Whisper"),
  });

  async function handleSave() {
    await saveMutation.mutateAsync({ model: model.trim(), computeType: computeType.trim() });
  }

  async function handleCheck() {
    setChecking(true);
    try {
      const result = await request<WhisperHealth>("/transcriptions/health");
      setHealth(result);
    } catch {
      setHealth({ available: false, reason: "Erro ao verificar serviço" });
    } finally {
      setChecking(false);
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  const isBusy = saveMutation.isPending || checking;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Configure o modelo Whisper para transcrição de áudio.
        </p>
      </div>

      {/* Status */}
      {health !== null && (
        <div className={`rounded-lg border p-4 flex items-center gap-2 ${health.available ? "border-green-300 bg-green-50 dark:bg-green-950/20" : "border-muted"}`}>
          {health.available
            ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div>
            <p className="text-sm font-medium">{health.available ? "Serviço disponível" : "Serviço indisponível"}</p>
            {health.url && <p className="text-xs text-muted-foreground">{health.url}</p>}
            {health.reason && <p className="text-xs text-destructive">{health.reason}</p>}
          </div>
        </div>
      )}

      {/* Config */}
      <div className="rounded-lg border p-4 space-y-4">
        <p className="text-sm font-medium">Parâmetros</p>

        <div className="space-y-1.5">
          <Label htmlFor="whisper-model" className="text-xs">Modelo</Label>
          <Input
            id="whisper-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="small"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Ex: tiny, base, small, medium, large, large-v3
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whisper-compute" className="text-xs">Compute Type</Label>
          <Input
            id="whisper-compute"
            value={computeType}
            onChange={(e) => setComputeType(e.target.value)}
            placeholder="int8"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Ex: int8, float16, float32
          </p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isBusy || !model.trim()}>
            {saveMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={handleCheck} disabled={isBusy}>
            {checking && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Testar conexão
          </Button>
        </div>
      </div>
    </div>
  );
}
