# S-044 — OpenTelemetry Export

Endpoint OTLP para exportar traces semânticos de IA (heartbeats, conversas, cron jobs, tool calls, MCP calls) compatível com GenAI Semantic Conventions. Integração com Datadog, Grafana, Langfuse, New Relic e VictoriaMetrics.

**Resolve:** D-065 (OTel não exportável — 3º sprint), G-065 (OpenTelemetry Export)
**Score de prioridade:** 8
**Dependência:** Trace Timeline existente (Sprint 3, S-015), MCP Support (Sprint 6, S-035)
**Histórico:** Identificada Sprint 5 (D-047/S-034), reafirmada Sprint 6 (D-061), Sprint 7 (D-065). S-034 não foi implementada — esta spec substitui e expande.

---

## 1. Objetivo

- Instrumentar o backbone com OpenTelemetry SDK para gerar spans de cada operação AI
- Exportar traces via OTLP (HTTP/protobuf) para qualquer coletor OpenTelemetry compatível
- Seguir GenAI Semantic Conventions (atributos `gen_ai.*`) para interoperabilidade
- Configuração via Settings no Hub: endpoint, headers, sampling rate, filtros por agente/tipo
- Separação de telemetria por tenant (atributo `tenant.id`)
- Zero impacto no fluxo principal: exportação assíncrona, falha silenciosa se coletor indisponível

---

## 2. Instrumentação

### 2.1 Spans Gerados

| Operação | Span Name | Tipo | Atributos Específicos |
|----------|-----------|------|----------------------|
| Conversa (mensagem) | `gen_ai.chat` | `CLIENT` | `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.response.finish_reason` |
| Heartbeat | `gen_ai.heartbeat` | `CLIENT` | `gen_ai.system`, `gen_ai.request.model`, `gen_ai.heartbeat.result` (ok/skipped/error), `gen_ai.usage.*` |
| Cron job | `gen_ai.cron` | `CLIENT` | `gen_ai.system`, `gen_ai.cron.job_id`, `gen_ai.cron.schedule`, `gen_ai.usage.*` |
| Tool call | `gen_ai.tool_call` | `INTERNAL` | `gen_ai.tool.name`, `gen_ai.tool.duration_ms`, `gen_ai.tool.status` (ok/error) |
| MCP call | `gen_ai.mcp_call` | `CLIENT` | `gen_ai.mcp.adapter_id`, `gen_ai.mcp.server_label`, `gen_ai.tool.name`, `gen_ai.tool.duration_ms` |

### 2.2 Atributos Comuns (Resource)

```typescript
{
  'service.name': 'agentic-backbone',
  'service.version': packageVersion,
  'agent.id': agentId,
  'agent.label': agentLabel,
  'agent.owner': ownerSlug,
  'tenant.id': tenantId,         // para multi-tenancy futuro
  'deployment.environment': env  // 'production' | 'staging' | 'development'
}
```

### 2.3 Contexto de Propagação

Cada conversa/heartbeat/cron gera um trace raiz. Tool calls e MCP calls são spans filhos. O `trace_id` é vinculado ao session ID (conversas) ou ao heartbeat/cron run ID.

---

## 3. Módulo `src/telemetry/`

### 3.1 Estrutura

```
src/telemetry/
  index.ts             # Inicializa OTel SDK, configura exportador, expõe tracer
  config.ts            # Leitura/escrita de configuração OTel (SQLite settings)
  instrumentor.ts      # Instrumentação de runAgent(), tool calls, MCP calls
  schemas.ts           # Zod schemas para configuração
```

### 3.2 Inicialização

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'

function initTelemetry(config: OTelConfig): void {
  if (!config.enabled || !config.endpoint) return

  const exporter = new OTLPTraceExporter({
    url: config.endpoint,
    headers: config.headers
  })

  const sdk = new NodeSDK({
    traceExporter: exporter,
    spanProcessor: new BatchSpanProcessor(exporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000
    }),
    resource: buildResource()
  })

  sdk.start()
}
```

### 3.3 Instrumentação de runAgent()

O `instrumentor.ts` wrapa a chamada a `runAgent()` em um span:

```typescript
async function* instrumentedRunAgent(params: RunAgentParams): AsyncGenerator<AgentEvent> {
  const span = tracer.startSpan(`gen_ai.${params.mode}`, {
    attributes: {
      'gen_ai.system': 'openrouter',
      'gen_ai.request.model': params.model,
      'agent.id': params.agentId,
    }
  })

  try {
    for await (const event of runAgent(params)) {
      // Captura métricas durante streaming
      if (event.type === 'usage') {
        span.setAttribute('gen_ai.usage.input_tokens', event.inputTokens)
        span.setAttribute('gen_ai.usage.output_tokens', event.outputTokens)
      }
      yield event
    }
    span.setStatus({ code: SpanStatusCode.OK })
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
    throw err
  } finally {
    span.end()
  }
}
```

### 3.4 Sampling

Configurável por agente e por tipo de operação:

```typescript
interface OTelConfig {
  enabled: boolean
  endpoint: string                    // ex: 'http://localhost:4318/v1/traces'
  headers: Record<string, string>     // ex: { 'Authorization': 'Bearer xxx' }
  samplingRate: number                // 0.0 a 1.0 (1.0 = 100%)
  agentFilter: string[]               // IDs de agentes a exportar (vazio = todos)
  operationFilter: string[]           // tipos: 'chat', 'heartbeat', 'cron', 'tool_call', 'mcp_call' (vazio = todos)
}
```

---

## 4. Configuração Persistente

Armazenada na tabela `settings` existente com key `otel`:

```json
{
  "enabled": false,
  "endpoint": "",
  "headers": {},
  "samplingRate": 1.0,
  "agentFilter": [],
  "operationFilter": []
}
```

---

## 5. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/settings/otel` | Configuração atual do OTel |
| PUT | `/settings/otel` | Atualizar configuração do OTel |
| POST | `/settings/otel/test` | Testar conexão com coletor (envia span de teste) |
| GET | `/settings/otel/status` | Status do exportador (connected, spans exported, errors) |

### 5.1 POST `/settings/otel/test`

Envia um span de teste para o endpoint configurado e verifica se foi aceito.

**Response:**
```json
{
  "success": true,
  "message": "Span de teste enviado com sucesso para http://localhost:4318/v1/traces",
  "latencyMs": 42
}
```

---

## 6. Telas (Hub)

### 6.1 `/settings/otel` — Configuração OpenTelemetry

- **Toggle** "Habilitar exportação OpenTelemetry"
- **Campo** Endpoint URL (com placeholder: `http://localhost:4318/v1/traces`)
- **Key-value editor** Headers de autenticação (campo password para valores)
- **Slider** Sampling rate (0% a 100%)
- **Multi-select** Filtro por agente (checkbox list dos agentes registrados)
- **Multi-select** Filtro por tipo de operação (chat, heartbeat, cron, tool_call, mcp_call)
- **Botão** "Testar Conexão" — feedback visual de sucesso/erro + latência
- **Status card**: spans exportados (total, hoje), erros de exportação, último export bem-sucedido

### 6.2 Presets de configuração

Botões de preset para backends populares:
- **Grafana Cloud**: preenche endpoint + header template
- **Datadog**: preenche endpoint + header template (DD-API-KEY)
- **New Relic**: preenche endpoint + header template (Api-Key)
- **Langfuse**: preenche endpoint + header template
- **Local (Jaeger)**: preenche endpoint localhost

---

## 7. Dependências

```json
{
  "@opentelemetry/sdk-node": "^0.52.0",
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.52.0",
  "@opentelemetry/sdk-trace-base": "^1.25.0",
  "@opentelemetry/resources": "^1.25.0",
  "@opentelemetry/semantic-conventions": "^1.25.0"
}
```

---

## 8. Critérios de Aceite

- [ ] Conversas (mensagens do usuário + resposta) geram spans com atributos `gen_ai.*` corretos
- [ ] Heartbeats geram spans com resultado (ok/skipped/error) e token usage
- [ ] Cron jobs geram spans com job_id e schedule
- [ ] Tool calls geram child spans com nome, duração e status
- [ ] MCP calls geram child spans com adapter_id e server_label
- [ ] Spans são exportados via OTLP HTTP para endpoint configurado
- [ ] Sampling rate funciona: rate 0.5 exporta ~50% dos traces
- [ ] Filtro por agente funciona: apenas agentes selecionados são exportados
- [ ] Filtro por tipo de operação funciona: apenas tipos selecionados são exportados
- [ ] Botão "Testar Conexão" envia span de teste e reporta sucesso/falha
- [ ] Falha no exportador (coletor offline) não impacta operação normal do backbone
- [ ] Presets preenchem corretamente endpoint e headers para cada backend
