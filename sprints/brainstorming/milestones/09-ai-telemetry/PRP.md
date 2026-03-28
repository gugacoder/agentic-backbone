# PRP — Ai: Observabilidade via OpenTelemetry

Integrar OpenTelemetry na ai-sdk usando o suporte nativo do Vercel AI SDK, habilitando tracing estruturado de chamadas LLM, tool calls, e sessoes de agente.

## Execution Mode

`implementar`

## Contexto

### Estado atual

A ai-sdk coleta metricas de forma manual e limitada:

| Metrica | Como eh coletado | Limitacao |
|---|---|---|
| Input/output tokens | `await result.usage` no final | Sem breakdown por step |
| Duracao total | `Date.now() - startMs` | Sem latencia por step ou time-to-first-token |
| Custo | Fetch manual ao OpenRouter `/generation` | Delay de 500ms, falha silenciosa |
| Tool calls | Nao rastreado | Nao sabe quais tools foram chamadas nem quanto tempo cada uma levou |
| Erros | `console.warn` | Sem correlacao com request |

Nao ha tracing estruturado. Em producao, eh impossivel debugar por que um agente demorou 45s ou por que gastou 50k tokens numa sessao.

O Vercel AI SDK v4 tem suporte experimental a OpenTelemetry:

```typescript
streamText({
  model,
  experimental_telemetry: {
    isEnabled: true,
    functionId: "ai-agent",
    metadata: { sessionId, agentId },
  },
});
```

Isso emite spans padroes GenAI com semantic conventions (model, tokens, latencia, finish reason) que qualquer collector OpenTelemetry consome.

### Estado desejado

1. A ai-sdk habilita telemetry opcionalmente via `AiAgentOptions`
2. Spans emitidos para: chamada LLM, cada step, cada tool call
3. Metadata customizada (sessionId, model, agentId) propagada nos spans
4. O consumidor configura o exporter (LangFuse, Datadog, console) — a ai-sdk apenas habilita
5. Zero overhead quando telemetria esta desabilitada

## Especificacao

### 1. Nova opcao em AiAgentOptions

```typescript
// types.ts
export interface AiTelemetryOptions {
  /** Habilita tracing OpenTelemetry. Default: false */
  enabled: boolean;
  /** Identificador da funcao nos spans (ex: "ai-agent", "heartbeat") */
  functionId?: string;
  /** Metadata adicional propagada nos spans */
  metadata?: Record<string, string>;
}

export interface AiAgentOptions {
  // ...existentes...

  /** Configuracao de telemetria OpenTelemetry */
  telemetry?: AiTelemetryOptions;
}
```

### 2. Passagem para streamText e generateText

No `agent.ts`, mapear opcoes para o parametro do Vercel AI SDK:

```typescript
const telemetryConfig = options.telemetry?.enabled
  ? {
      isEnabled: true,
      functionId: options.telemetry.functionId ?? "ai-agent",
      metadata: {
        sessionId,
        model: options.model,
        ...options.telemetry.metadata,
      },
    }
  : undefined;

result = streamText({
  model,
  tools,
  maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
  messages,
  system: systemPrompt,
  experimental_telemetry: telemetryConfig,
});
```

Aplicar o mesmo em `compactMessages()` para rastrear chamadas de compaction.

### 3. Span customizado para sessao

Criar um span pai que engloba toda a execucao de `runAiAgent()`:

```typescript
// agent.ts — no iaiio da funcao
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("ai-sdk");

// Criar span se telemetria habilitada
const span = options.telemetry?.enabled
  ? tracer.startSpan("ai.agent.run", {
      attributes: {
        "ai.session_id": sessionId,
        "ai.model": options.model,
        "ai.max_steps": options.maxSteps ?? DEFAULT_MAX_STEPS,
      },
    })
  : undefined;

try {
  // ...fluxo existente...
} finally {
  span?.end();
}
```

### 4. Dependencia OpenTelemetry

Adicionar como **peerDependency** (opcional):

```json
{
  "peerDependencies": {
    "@opentelemetry/api": "^1",
  },
  "peerDependenciesMeta": {
    "@opentelemetry/api": { "optional": true }
  }
}
```

Se `@opentelemetry/api` nao estiver instalado e telemetria nao for solicitada, a ai-sdk funciona normalmente. Se telemetria for solicitada mas o pacote nao existir, emitir warning no console e prosseguir sem spans customizados (o Vercel AI SDK lida com a ausencia internamente).

### 5. Enriquecer evento usage com dados de telemetria

Se telemetria estiver habilitada, incluir no evento `usage` campos adicionais que o Vercel AI SDK expoe:

```typescript
// types.ts — extender AiUsageData
export interface AiUsageData {
  // ...existentes...

  /** Latencia ate o primeiro token (ms). Disponivel apenas com telemetria. */
  timeToFirstTokenMs?: number;
  /** Breakdown de uso por step. Disponivel apenas com telemetria. */
  steps?: Array<{
    stepNumber: number;
    toolCalls: string[];
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  }>;
}
```

Esses dados vem do `onStepFinish` e sao populados independentemente do exporter.

## Limites

- **NAO** escolher ou configurar exporters — isso eh responsabilidade do consumidor (backbone configura LangFuse, console, etc.)
- **NAO** adicionar `@opentelemetry/api` como dependencia direta — apenas peerDependency opcional
- **NAO** quebrar a interface quando telemetria esta desabilitada — todos os campos novos em `AiUsageData` sao opcionais
- **NAO** emitir spans se `telemetry.enabled` nao for `true` — zero overhead por default
- **NAO** logar dados sensiveis (prompts, respostas) nos spans — apenas metadata e metricas

## Validacao

- [ ] Sem `telemetry` em options: comportamento identico ao atual, zero overhead
- [ ] Com `telemetry.enabled: true` e OpenTelemetry configurado: spans emitidos com atributos corretos
- [ ] Com `telemetry.enabled: true` sem `@opentelemetry/api` instalado: warning no console, execucao normal
- [ ] `AiUsageData.steps` populado com breakdown por step quando telemetria habilitada
- [ ] Compaction tambem emite spans se telemetria habilitada
- [ ] `npm run build --workspace=packages/ai-sdk` compila sem erros

## Rastreabilidade

| Mudanca | Arquivos |
|---|---|
| Novos tipos de telemetria | `packages/ai-sdk/src/types.ts` |
| Integracao no agente | `packages/ai-sdk/src/agent.ts` |
| Integracao na compaction | `packages/ai-sdk/src/context/compaction.ts` |
| Peer dependency | `packages/ai-sdk/package.json` |
| Exports | `packages/ai-sdk/src/index.ts` |
