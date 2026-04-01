import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, Key } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { request } from "@/lib/api";

interface ProviderKeyStatus {
  configured: boolean;
  preview?: string;
}

interface ProvidersStatus {
  openrouter: ProviderKeyStatus;
  openai: ProviderKeyStatus;
  brave: ProviderKeyStatus;
  groq: ProviderKeyStatus;
}

interface TestResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

function providersQueryOptions() {
  return {
    queryKey: ["settings", "providers"],
    queryFn: () => request<ProvidersStatus>("/settings/providers"),
  };
}

type ProviderKey = "openrouter" | "openai" | "brave" | "groq";

interface ProviderSectionProps {
  id: ProviderKey;
  title: string;
  description: string;
  status: ProviderKeyStatus;
  onSave: (provider: ProviderKey, key: string) => Promise<void>;
}

function ProviderSection({ id, title, description, status, onSave }: ProviderSectionProps) {
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await onSave(id, apiKey.trim());
      setEditing(false);
      setApiKey("");
      toast.success(`Chave ${title} salva com sucesso`);
    } catch {
      toast.error(`Erro ao salvar chave ${title}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await request<TestResult>(`/settings/providers/test/${id}`, { method: "POST" });
      setTestResult(result);
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : "Erro ao testar" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">{title}</h3>
            {status.configured ? (
              <Badge variant="outline" className="text-xs border-green-500 text-green-600">Configurado</Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-destructive text-destructive">Não configurado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {status.configured && status.preview && (
            <p className="text-xs text-muted-foreground font-mono mt-1">{status.preview}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testing || !status.configured}
          >
            {testing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Testar
          </Button>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => { setEditing(true); setApiKey(""); setTestResult(null); }}>
              {status.configured ? "Alterar" : "Configurar"}
            </Button>
          )}
        </div>
      </div>

      {testResult && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${testResult.ok ? "bg-green-50 text-green-700 dark:bg-green-950/20" : "bg-red-50 text-destructive dark:bg-red-950/20"}`}>
          {testResult.ok
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <XCircle className="h-3.5 w-3.5 shrink-0" />}
          {testResult.ok
            ? `Conexão OK — ${testResult.latencyMs}ms`
            : testResult.error ?? "Falha na conexão"}
        </div>
      )}

      {editing && (
        <div className="space-y-2 border-t pt-3">
          <Label htmlFor={`key-${id}`} className="text-xs">Nova chave API</Label>
          <Input
            id={`key-${id}`}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !apiKey.trim()}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setApiKey(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProvidersSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(providersQueryOptions());

  const saveMutation = useMutation({
    mutationFn: async ({ provider, key }: { provider: ProviderKey; key: string }) => {
      await request("/settings/providers", {
        method: "PATCH",
        body: JSON.stringify({ [provider]: { api_key: key } }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "providers"] });
    },
  });

  async function handleSave(provider: ProviderKey, key: string) {
    await saveMutation.mutateAsync({ provider, key });
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Configure chaves de API dos provedores. As chaves são armazenadas com criptografia e injetadas no ambiente na inicialização.
        </p>
      </div>

      <ProviderSection
        id="openrouter"
        title="OpenRouter"
        description="Usado para roteamento de modelos LLM. Necessário para execução dos agentes."
        status={data.openrouter}
        onSave={handleSave}
      />

      <ProviderSection
        id="openai"
        title="OpenAI"
        description="Usado para embeddings de memória semântica (text-embedding-3-small)."
        status={data.openai}
        onSave={handleSave}
      />

      <ProviderSection
        id="brave"
        title="Brave Search"
        description="Usado para pesquisa web quando o provedor 'brave' está configurado."
        status={data.brave}
        onSave={handleSave}
      />

      <ProviderSection
        id="groq"
        title="Groq"
        description="Inferência ultra-rápida para modelos open-source (Llama, Mixtral, Gemma)."
        status={data.groq}
        onSave={handleSave}
      />
    </div>
  );
}
