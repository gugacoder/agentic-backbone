# PRP-34 — OpenTelemetry Export (OTLP)

Instrumentacao do backbone com OpenTelemetry SDK (Node.js) para exportar traces de execucao de agentes, tool calls e metricas de tokens via OTLP/HTTP para stacks externas (Datadog, Grafana, Langfuse, Jaeger).

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone nao possui telemetria exportavel. Nao ha spans de execucao de agente, metricas de tokens por run ou rastreamento de tool calls. Nao ha configuracao de endpoint OTLP.

### Estado desejado

1. `context/system/telemetry.json` como arquivo de configuracao
2. SDK OTel inicializado no startup do backbone quando `enabled: true`
3. `runAgent()` instrumentado com spans de agente e spans filhos de tool calls
4. Endpoints `GET/PUT /settings/telemetry` e `POST /settings/telemetry/test`
5. Secao "Telemetria" na pagina `/settings` do Hub

## Especificacao

### Feature F-129: Setup do OTel SDK + instrumentacao em runAgent()

**Arquivo de configuracao `context/system/telemetry.json`:**

```json
{
  "enabled": false,
  "otlp": {
    "endpoint": "",
    "headers": {},
    "protocol": "http/protobuf"
  },
  "sampling": {
    "rate": 1.0
  }
}
```

**Modulo `src/telemetry/index.ts`:**

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'

let sdk: NodeSDK | null = null

export function initTelemetry(config: TelemetryConfig): void {
  if (!config.enabled) return

  const exporter = new OTLPTraceExporter({
    url: config.otlp.endpoint + '/v1/traces',
    headers: resolveEnvVars(config.otlp.headers),
  })

  sdk = new NodeSDK({
    traceExporter: exporter,
    resource: new Resource({
      'service.name': 'agentic-backbone',
      'service.version': '1.0.0',
    }),
  })
  sdk.start()
}

export function getTracer() {
  return trace.getTracer('backbone')
}
```

`resolveEnvVars(headers)`: substitui `${VAR}` por `process.env.VAR`.

Chamar `initTelemetry()` no startup do backbone apos ler `telemetry.json`.

**Instrumentacao em `runAgent()`:**

```typescript
const span = getTracer().startSpan(`agent.${mode}`, {
  attributes: {
    'agent.id': agentId,
    'agent.slug': slug,
    'agent.owner': owner,
    'session.id': sessionId ?? '',
    'channel.type': channelType ?? '',
  },
})

try {
  // execucao existente...
  span.addEvent('tokens', { input: tokensIn, output: tokensOut, total: tokensIn + tokensOut })
  span.setStatus({ code: SpanStatusCode.OK })
} catch (err) {
  span.setStatus({ code: SpanStatusCode.ERROR })
  span.recordException(err as Error)
  throw err
} finally {
  span.end()
}
```

**Spans de tool calls (filhos do span do agente):**

Wrapping no executor de tools:
```typescript
const toolSpan = getTracer().startSpan('tool.call', {
  attributes: { 'tool.name': toolName },
}, ctx)
// execucao da tool...
toolSpan.setAttribute('tool.success', !error)
toolSpan.setAttribute('duration_ms', elapsed)
toolSpan.end()
```

Quando `sampling.rate < 1.0`: implementar sampler simples (`Math.random() < rate`).
Quando `enabled: false`: sem overhead (sem span criado).

**Dependencias npm:**
```json
{
  "@opentelemetry/sdk-node": "^0.52.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.52.0",
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/resources": "^1.27.0"
}
```

### Feature F-130: Endpoints /settings/telemetry

**Novas rotas em `apps/backbone/src/routes/settings.ts` (ou arquivo existente de settings):**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/settings/telemetry` | Obter configuracao atual |
| PUT | `/settings/telemetry` | Atualizar configuracao (persiste em telemetry.json) |
| POST | `/settings/telemetry/test` | Testar conectividade com coletor OTLP |

**PUT body:**
```json
{
  "enabled": true,
  "otlp": {
    "endpoint": "https://otel-collector.example.com:4318",
    "headers": { "api-key": "${OTEL_API_KEY}" },
    "protocol": "http/protobuf"
  },
  "sampling": { "rate": 0.5 }
}
```

Persiste em `context/system/telemetry.json`. Reinicializa o SDK OTel se necessario.

**POST /settings/telemetry/test:**
- Envia span de teste para o endpoint configurado
- Retorna `{ ok: boolean, latencyMs: number, message: string }`
- Timeout de 5s

**Hub — `apps/hub/src/api/telemetry.ts`:**

```typescript
export const telemetryQueryOptions = () =>
  queryOptions({
    queryKey: ["telemetry"],
    queryFn: () => request<TelemetryConfig>("/settings/telemetry"),
  });
```

### Feature F-131: Secao Telemetria em /settings no Hub

Adicionar secao "Telemetria" na pagina `/settings` do Hub existente.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `TelemetrySection` | `components/settings/telemetry-section.tsx` |

**TelemetrySection:**
- Toggle "Habilitar exportacao OTLP" (`enabled`)
- Campo: Endpoint URL (text input)
- Editor de headers: lista de pares chave-valor, valores mascarados quando contem "key" ou "token" (usando `isSensitiveField` de `utils/sensitive.ts`)
- Slider: Taxa de sampling (0.0 a 1.0, com exibicao de percentual)
- Botao "Salvar" (PUT)
- Botao "Testar conexao" (POST /test)
- Feedback inline: checkmark verde com latencia ou mensagem de erro vermelha

## Limites

- **NAO** implementar metricas (apenas traces/spans)
- **NAO** implementar logs OTel (apenas traces)
- **NAO** suportar protocolo GRPC (apenas HTTP/protobuf)
- **NAO** reiniciar backbone automaticamente ao mudar configuracao (operador reinicia manualmente se precisar)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- Settings page (`/settings`) deve existir no Hub

## Validacao

- [ ] Com `enabled: true` e endpoint valido, spans chegam ao coletor
- [ ] Span `agent.conversation` contem `agent.id`, `session.id` e evento de tokens ao final
- [ ] Tool calls aparecem como spans filhos com `tool.name` e `duration_ms`
- [ ] Com `enabled: false`, nenhum dado enviado (zero overhead)
- [ ] `POST /settings/telemetry/test` retorna latencia ou erro em < 5s
- [ ] Headers com `${ENV_VAR}` resolvidos antes de enviar
- [ ] Taxa de sampling `0.5` envia aproximadamente 50% dos traces
- [ ] Configuracao persiste apos reinicio (lida de `telemetry.json`)
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-129 OTel SDK + instrumentacao runAgent | S-034 sec 4 | D-048 |
| F-130 Endpoints /settings/telemetry | S-034 sec 5 | G-049 |
| F-131 Secao Telemetria em /settings Hub | S-034 sec 6 | G-049 |
