import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  otelConfigQueryOptions,
  otelStatusQueryOptions,
  updateOTelConfig,
  testOTelConnection,
  type OTelConfig,
  type OTelTestResult,
} from "@/api/otel";
import { agentsQueryOptions } from "@/api/agents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/settings_/otel")({
  staticData: { title: "OpenTelemetry", description: "Exportação de traces para observabilidade" },
  component: OTelSettingsPage,
});

// ─── Presets ──────────────────────────────────────────────────────────────────

interface Preset {
  name: string;
  endpoint: string;
  headers: Record<string, string>;
}

const PRESETS: Preset[] = [
  {
    name: "Grafana Cloud",
    endpoint: "https://otlp-gateway-prod-us-central-0.grafana.net/otlp/v1/traces",
    headers: { Authorization: "Basic <base64(instanceId:token)>" },
  },
  {
    name: "Datadog",
    endpoint: "https://trace.agent.datadoghq.com/api/v0.2/traces",
    headers: { "DD-API-KEY": "<your-api-key>" },
  },
  {
    name: "New Relic",
    endpoint: "https://otlp.nr-data.net/v1/traces",
    headers: { "Api-Key": "<your-license-key>" },
  },
  {
    name: "Langfuse",
    endpoint: "https://cloud.langfuse.com/api/public/otel/v1/traces",
    headers: {
      Authorization: "Basic <base64(publicKey:secretKey)>",
    },
  },
  {
    name: "Local (Jaeger)",
    endpoint: "http://localhost:4318/v1/traces",
    headers: {},
  },
];

const OPERATION_TYPES = [
  { value: "chat", label: "Chat" },
  { value: "heartbeat", label: "Heartbeat" },
  { value: "cron", label: "Cron" },
  { value: "tool_call", label: "Tool Call" },
  { value: "mcp_call", label: "MCP Call" },
];

// ─── Header Entry ─────────────────────────────────────────────────────────────

interface HeaderEntry {
  key: string;
  value: string;
}

function headersToEntries(headers: Record<string, string>): HeaderEntry[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

function entriesToHeaders(entries: HeaderEntry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key, value } of entries) {
    if (key.trim()) result[key.trim()] = value;
  }
  return result;
}

// ─── Status Card ──────────────────────────────────────────────────────────────

function StatusCard() {
  const { data: status, isLoading } = useQuery(otelStatusQueryOptions());

  if (isLoading) return <Skeleton className="h-28 rounded-lg" />;

  const s = status ?? { connected: false, spansExported: 0, errors: 0, lastExportAt: null };

  function formatTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          {s.connected ? (
            <Wifi className="size-4 text-green-500" />
          ) : (
            <WifiOff className="size-4 text-muted-foreground" />
          )}
          Status do Exportador
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Spans exportados</p>
            <p className="text-xl font-bold tabular-nums">{s.spansExported.toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Erros</p>
            <p className={`text-xl font-bold tabular-nums ${s.errors > 0 ? "text-destructive" : ""}`}>
              {s.errors}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Último export</p>
            <p className="text-xs font-medium">{formatTime(s.lastExportAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Test Connection Button ───────────────────────────────────────────────────

function TestConnectionButton() {
  const [result, setResult] = useState<OTelTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await testOTelConnection();
      setResult(res);
    } catch {
      setResult({
        success: false,
        message: "Erro ao chamar endpoint de teste",
        latencyMs: 0,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={handleTest}
        disabled={testing}
        className="w-full sm:w-auto"
      >
        {testing ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Activity className="mr-2 size-4" />
        )}
        Testar Conexão
      </Button>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            result.success
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
              : "border-destructive/20 bg-destructive/5 text-destructive"
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-medium">{result.success ? "Sucesso" : "Falha"}</p>
            <p className="text-xs opacity-80">{result.message}</p>
            {result.latencyMs > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-xs opacity-70">
                <Clock className="size-3" />
                {result.latencyMs}ms
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Headers Editor ───────────────────────────────────────────────────────────

function HeadersEditor({
  entries,
  onChange,
}: {
  entries: HeaderEntry[];
  onChange: (entries: HeaderEntry[]) => void;
}) {
  function updateKey(i: number, key: string) {
    const next = [...entries];
    next[i] = { ...next[i], key };
    onChange(next);
  }

  function updateValue(i: number, value: string) {
    const next = [...entries];
    next[i] = { ...next[i], value };
    onChange(next);
  }

  function remove(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
  }

  function add() {
    onChange([...entries, { key: "", value: "" }]);
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="Header"
            value={entry.key}
            onChange={(e) => updateKey(i, e.target.value)}
            className="h-8 text-xs font-mono flex-1"
          />
          <Input
            placeholder="Valor"
            type="password"
            value={entry.value}
            onChange={(e) => updateValue(i, e.target.value)}
            className="h-8 text-xs font-mono flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(i)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={add}>
        <Plus className="mr-1 size-3" />
        Adicionar header
      </Button>
    </div>
  );
}

// ─── Agent Filter ─────────────────────────────────────────────────────────────

function AgentFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: agents } = useQuery(agentsQueryOptions());

  if (!agents || agents.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum agente disponível</p>;
  }

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {agents.map((agent) => (
        <label
          key={agent.id}
          className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-muted/50"
        >
          <Checkbox
            checked={selected.includes(agent.id)}
            onCheckedChange={() => toggle(agent.id)}
          />
          <span className="truncate font-mono">{agent.id}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Operation Filter ─────────────────────────────────────────────────────────

function OperationFilter({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ops: string[]) => void;
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {OPERATION_TYPES.map((op) => (
        <label
          key={op.value}
          className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50"
        >
          <Checkbox
            checked={selected.includes(op.value)}
            onCheckedChange={() => toggle(op.value)}
          />
          <span>{op.label}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function OTelSettingsPage() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery(otelConfigQueryOptions());

  // Local state mirrors the config
  const [enabled, setEnabled] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [headerEntries, setHeaderEntries] = useState<HeaderEntry[]>([]);
  const [samplingRate, setSamplingRate] = useState(100);
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [operationFilter, setOperationFilter] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize local state from fetched config
  if (config && !initialized) {
    setEnabled(config.enabled);
    setEndpoint(config.endpoint);
    setHeaderEntries(headersToEntries(config.headers));
    setSamplingRate(Math.round(config.samplingRate * 100));
    setAgentFilter(config.agentFilter);
    setOperationFilter(config.operationFilter);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: (cfg: OTelConfig) => updateOTelConfig(cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "otel"] });
      toast.success("Configuração OpenTelemetry salva");
    },
    onError: () => {
      toast.error("Erro ao salvar configuração");
    },
  });

  function buildConfig(): OTelConfig {
    return {
      enabled,
      endpoint,
      headers: entriesToHeaders(headerEntries),
      samplingRate: samplingRate / 100,
      agentFilter,
      operationFilter,
    };
  }

  function handleSave() {
    saveMutation.mutate(buildConfig());
  }

  function applyPreset(preset: Preset) {
    setEndpoint(preset.endpoint);
    setHeaderEntries(headersToEntries(preset.headers));
    toast.info(`Preset "${preset.name}" aplicado`);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <StatusCard />

      {/* Main Config Card */}
      <Card>
        <CardContent className="space-y-6 px-4 py-4">

          {/* Enable Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Habilitar exportação OpenTelemetry</Label>
              <p className="text-xs text-muted-foreground">
                Ativa o envio de spans OTLP para o endpoint configurado
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <Separator />

          {/* Presets */}
          <div className="space-y-2">
            <Label className="text-sm">Presets</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Endpoint */}
          <div className="space-y-1.5">
            <Label htmlFor="endpoint" className="text-sm">
              Endpoint URL
            </Label>
            <Input
              id="endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://localhost:4318/v1/traces"
              className="font-mono text-xs"
            />
          </div>

          {/* Headers */}
          <div className="space-y-1.5">
            <Label className="text-sm">Headers de autenticação</Label>
            <p className="text-xs text-muted-foreground">
              Os valores são tratados como senha e não são exibidos em texto claro
            </p>
            <HeadersEditor entries={headerEntries} onChange={setHeaderEntries} />
          </div>

          <Separator />

          {/* Sampling Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Taxa de amostragem</Label>
              <span className="text-sm font-bold tabular-nums">{samplingRate}%</span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[samplingRate]}
              onValueChange={(v) => {
                const arr = Array.isArray(v) ? v : [v];
                if (arr[0] !== undefined) setSamplingRate(arr[0]);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <Separator />

          {/* Agent Filter */}
          <div className="space-y-2">
            <Label className="text-sm">Filtro por agente</Label>
            <p className="text-xs text-muted-foreground">
              Deixe vazio para exportar spans de todos os agentes
            </p>
            <AgentFilter selected={agentFilter} onChange={setAgentFilter} />
          </div>

          <Separator />

          {/* Operation Filter */}
          <div className="space-y-2">
            <Label className="text-sm">Filtro por tipo de operação</Label>
            <p className="text-xs text-muted-foreground">
              Deixe vazio para exportar todos os tipos de operação
            </p>
            <OperationFilter selected={operationFilter} onChange={setOperationFilter} />
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="space-y-2">
            <Label className="text-sm">Testar conexão</Label>
            <p className="text-xs text-muted-foreground">
              Envia um span de teste para o endpoint configurado
            </p>
            <TestConnectionButton />
          </div>

        </CardContent>
      </Card>

      {/* Save / Warning */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar configuração
        </Button>
        {!enabled && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5" />
            Exportação desabilitada — nenhum span será enviado
          </p>
        )}
      </div>
    </div>
  );
}
