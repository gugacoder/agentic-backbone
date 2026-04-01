# PRP-45 — OpenTelemetry Export

Instrumentação do backbone com OpenTelemetry SDK para exportar traces semânticos de IA (conversas, heartbeats, cron jobs, tool calls, MCP calls) via OTLP HTTP. Compatível com GenAI Semantic Conventions e integrável com Datadog, Grafana, Langfuse, New Relic e Jaeger.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone possui trace timeline interno (Sprint 3, S-015) mas não exporta telemetria para sistemas externos. Não há integração com OpenTelemetry. Identificada em Sprint 5 (S-034), reafirmada em Sprint 6 e Sprint 7 — nunca implementada.

### Estado desejado

1. Módulo `src/telemetry/` com OpenTelemetry SDK configurável
2. Spans gerados para cada operação AI com atributos `gen_ai.*` (GenAI Semantic Conventions)
3. Exportação via OTLP HTTP para qualquer coletor OpenTelemetry
4. Configuração persistente via Settings (endpoint, headers, sampling, filtros)
5. Página `/settings/otel` no Hub com presets para backends populares
6. Zero impacto no fluxo principal (exportação assíncrona, falha silenciosa)

## Especificacao

### Feature F-157: Módulo src/telemetry/ + inicialização OTel SDK

**Nova estrutura:**

```
src/telemetry/
  index.ts             # Inicializa OTel SDK, configura exportador, expõe tracer
  config.ts            # Leitura/escrita de configuração OTel (SQLite settings)
  instrumentor.ts      # Instrumentação de runAgent(), tool calls, MCP calls
  schemas.ts           # Zod schemas para configuração
```

**Inicialização:**

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

**Configuração persistente** armazenada na tabela `settings` existente com key `otel`:

```typescript
interface OTelConfig {
  enabled: boolean
  endpoint: string
  headers: Record<string, string>
  samplingRate: number          // 0.0 a 1.0
  agentFilter: string[]         // IDs de agentes (vazio = todos)
  operationFilter: string[]     // 'chat' | 'heartbeat' | 'cron' | 'tool_call' | 'mcp_call' (vazio = todos)
}
```

**Resource attributes comuns:**

```typescript
{
  'service.name': 'agentic-backbone',
  'service.version': packageVersion,
  'agent.id': agentId,
  'agent.label': agentLabel,
  'agent.owner': ownerSlug,
  'tenant.id': tenantId,
  'deployment.environment': env
}
```

**Dependências de pacote:**

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

### Feature F-158: Instrumentação de runAgent(), tool calls, MCP calls

**Spans gerados:**

| Operação | Span Name | Tipo | Atributos Específicos |
|----------|-----------|------|----------------------|
| Conversa | `gen_ai.chat` | CLIENT | `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.response.finish_reason` |
| Heartbeat | `gen_ai.heartbeat` | CLIENT | `gen_ai.system`, `gen_ai.request.model`, `gen_ai.heartbeat.result`, `gen_ai.usage.*` |
| Cron job | `gen_ai.cron` | CLIENT | `gen_ai.system`, `gen_ai.cron.job_id`, `gen_ai.cron.schedule`, `gen_ai.usage.*` |
| Tool call | `gen_ai.tool_call` | INTERNAL | `gen_ai.tool.name`, `gen_ai.tool.duration_ms`, `gen_ai.tool.status` |
| MCP call | `gen_ai.mcp_call` | CLIENT | `gen_ai.mcp.adapter_id`, `gen_ai.mcp.server_label`, `gen_ai.tool.name`, `gen_ai.tool.duration_ms` |

**Wrapper de runAgent():**

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

Contexto de propagação: cada conversa/heartbeat/cron gera trace raiz. Tool calls e MCP calls são child spans. `trace_id` vinculado ao session ID ou heartbeat/cron run ID.

### Feature F-159: API endpoints settings/otel

**Endpoints:**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/settings/otel` | Configuração atual |
| PUT | `/settings/otel` | Atualizar configuração |
| POST | `/settings/otel/test` | Testar conexão (envia span de teste) |
| GET | `/settings/otel/status` | Status do exportador (connected, spans exported, errors) |

**POST `/settings/otel/test` — Response:**

```json
{
  "success": true,
  "message": "Span de teste enviado com sucesso para http://localhost:4318/v1/traces",
  "latencyMs": 42
}
```

Ao atualizar configuração: reinicializa OTel SDK com novos parâmetros (sem restart do backbone).

### Feature F-160: Hub — página /settings/otel com presets

**`/settings/otel` — Configuração OpenTelemetry:**

- Toggle "Habilitar exportação OpenTelemetry"
- Campo Endpoint URL (placeholder: `http://localhost:4318/v1/traces`)
- Key-value editor de headers de autenticação (campo password para valores)
- Slider de sampling rate (0% a 100%)
- Multi-select de filtro por agente (checkbox list)
- Multi-select de filtro por tipo de operação
- Botão "Testar Conexão" com feedback visual (sucesso/erro + latência)
- Status card: spans exportados (total, hoje), erros de exportação, último export

**Presets de configuração (botões que preenchem endpoint + headers):**

- **Grafana Cloud** — endpoint + header template
- **Datadog** — endpoint + DD-API-KEY
- **New Relic** — endpoint + Api-Key
- **Langfuse** — endpoint + header template
- **Local (Jaeger)** — endpoint localhost

## Limites

- **NÃO** implementar métricas OpenTelemetry (apenas traces/spans)
- **NÃO** implementar logs OpenTelemetry
- **NÃO** implementar auto-instrumentation de HTTP requests (apenas operações AI)
- **NÃO** implementar caching ou buffering persistente de spans (batch em memória apenas)

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- Trace Timeline (Sprint 3, S-015) deve estar implementado — contexto de propagação
- MCP Support (Sprint 6, S-035) deve estar implementado — instrumentação de MCP calls

## Validacao

- [ ] Conversas geram spans com atributos `gen_ai.*` corretos
- [ ] Heartbeats geram spans com resultado e token usage
- [ ] Cron jobs geram spans com job_id e schedule
- [ ] Tool calls geram child spans com nome, duração e status
- [ ] MCP calls geram child spans com adapter_id e server_label
- [ ] Spans exportados via OTLP HTTP para endpoint configurado
- [ ] Sampling rate funciona: rate 0.5 exporta ~50% dos traces
- [ ] Filtro por agente funciona
- [ ] Filtro por tipo de operação funciona
- [ ] Botão "Testar Conexão" reporta sucesso/falha
- [ ] Falha no exportador não impacta operação normal do backbone
- [ ] Presets preenchem corretamente endpoint e headers
- [ ] `npm run build` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-157 Módulo telemetry + OTel SDK | S-044 sec 3.1-3.2 | D-065 |
| F-158 Instrumentação runAgent/tools/MCP | S-044 sec 2, 3.3 | D-065, G-065 |
| F-159 API endpoints settings/otel | S-044 sec 5 | G-065 |
| F-160 Hub /settings/otel + presets | S-044 sec 6 | G-065 |
