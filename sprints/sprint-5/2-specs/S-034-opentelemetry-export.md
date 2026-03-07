# S-034 — OpenTelemetry Export (OTLP)

Endpoint OTLP compativel para exportar traces, metricas de token, latencia e erros do backbone para stacks de observabilidade externas (Datadog, Grafana, Langfuse, Jaeger).

**Resolve:** D-048 (telemetria nao exportavel), G-049 (OpenTelemetry export)
**Score de prioridade:** 6

---

## 1. Objetivo

- Instrumentar o backbone com OpenTelemetry SDK (Node.js)
- Exportar traces de execucao de agentes via OTLP/HTTP para coletor externo configuravel
- Spans cobrem: heartbeat, conversation, tool calls, memory pipeline, cron jobs
- Configuracao do endpoint OTLP via Settings no Hub
- Nenhuma mudanca na API publica existente

---

## 2. Sem Schema DB Adicional

Configuracao do endpoint OTLP armazenada em `context/system/telemetry.json`.

### 2.1 `context/system/telemetry.json`

```json
{
  "enabled": false,
  "otlp": {
    "endpoint": "https://otel-collector.example.com:4318",
    "headers": {
      "api-key": "${OTEL_API_KEY}"
    },
    "protocol": "http/protobuf"
  },
  "sampling": {
    "rate": 1.0
  }
}
```

---

## 3. Instrumentacao

### 3.1 Spans de alto nivel

| Span | Atributos |
|------|-----------|
| `agent.heartbeat` | `agent.id`, `agent.slug`, `agent.owner`, `mode: heartbeat` |
| `agent.conversation` | `agent.id`, `session.id`, `channel.type`, `mode: conversation` |
| `agent.webhook` | `agent.id`, `webhook.id`, `mode: webhook` |
| `agent.cron` | `agent.id`, `cron.job_id`, `mode: cron` |

### 3.2 Spans de tool calls (filhos do span do agente)

| Span | Atributos |
|------|-----------|
| `tool.call` | `tool.name`, `tool.success`, `tool.error` (se falhou) |
| `tool.call` duration | `duration_ms` |

### 3.3 Metricas de tokens (eventos no span)

Ao final de cada execucao de agente, adicionar evento ao span:
```
tokens.input: N
tokens.output: N
tokens.total: N
model: "openai/gpt-4o"
cost_usd: 0.0023  (estimativa)
```

### 3.4 Atributos de recurso (resource)

```
service.name: "agentic-backbone"
service.version: "1.0.0"
deployment.environment: "production"
```

---

## 4. Implementacao

### 4.1 Setup do SDK (`src/telemetry/index.ts`)

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

export function initTelemetry(config: TelemetryConfig) {
  if (!config.enabled) return

  const exporter = new OTLPTraceExporter({
    url: config.otlp.endpoint + '/v1/traces',
    headers: resolveEnvVars(config.otlp.headers)
  })

  const sdk = new NodeSDK({ traceExporter: exporter })
  sdk.start()
}
```

### 4.2 Instrumentacao em `runAgent()`

```typescript
const tracer = trace.getTracer('backbone')
const span = tracer.startSpan(`agent.${mode}`, {
  attributes: { 'agent.id': agentId, 'session.id': sessionId }
})

// ... execucao do agente ...

span.addEvent('tokens', { input: tokensIn, output: tokensOut })
span.setStatus({ code: SpanStatusCode.OK })
span.end()
```

### 4.3 Propagacao de contexto

- Cada execucao de agente cria um novo span root (sem propagacao de trace externo)
- Tool calls sao spans filhos do span do agente
- Memory pipeline e cron jobs criam spans independentes quando executam

---

## 5. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/settings/telemetry` | Obter configuracao atual de telemetria |
| PUT | `/settings/telemetry` | Atualizar configuracao (endpoint, headers, enabled) |
| POST | `/settings/telemetry/test` | Testar conectividade com coletor OTLP |

### 5.1 PUT `/settings/telemetry` — Body

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

### 5.2 POST `/settings/telemetry/test` — Response

```json
{
  "ok": true,
  "latencyMs": 45,
  "message": "Conexao com coletor OTLP estabelecida com sucesso"
}
```

---

## 6. Telas (Hub)

### 6.1 `/settings` — Secao "Telemetria"

- Toggle "Habilitar exportacao OTLP"
- Campo: Endpoint URL
- Campo: Headers (editor de key-value pairs, valores mascarados se contem "key" ou "token")
- Campo: Taxa de sampling (0.0 a 1.0, slider)
- Botao "Testar conexao" (chama `/settings/telemetry/test`)
- Feedback: checkmark verde com latencia ou erro vermelho

---

## 7. Dependencias

```json
{
  "@opentelemetry/sdk-node": "^0.52.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.52.0",
  "@opentelemetry/api": "^1.9.0"
}
```

---

## 8. Criterios de Aceite

- [ ] Com `enabled: true` e endpoint valido, spans de execucao de agente chegam ao coletor
- [ ] Span de `agent.conversation` contem `agent.id`, `session.id` e evento de tokens ao final
- [ ] Tool calls aparecem como spans filhos com `tool.name` e `duration_ms`
- [ ] Com `enabled: false`, nenhum dado e enviado (zero overhead)
- [ ] `POST /settings/telemetry/test` retorna latencia ou erro de conectividade em < 5s
- [ ] Headers com `${ENV_VAR}` sao resolvidos antes de enviar (sem expor variaveis na GUI)
- [ ] Taxa de sampling `0.5` envia aproximadamente 50% dos traces
- [ ] Configuracao persiste apos reinicio do backbone (lida de `telemetry.json`)
