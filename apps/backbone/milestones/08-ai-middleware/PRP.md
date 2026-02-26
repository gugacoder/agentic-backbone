# PRP — Ai: Middleware Pipeline via wrapLanguageModel

Introduzir suporte a middleware do Vercel AI SDK na ai-sdk, permitindo composicao de comportamentos cross-cutting (logging, caching, guardrails, RAG) sem poluir o agent.ts.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O `agent.ts` concentra toda logica cross-cutting inline:

| Concern | Onde esta hoje | Problema |
|---|---|---|
| Token counting | `context/usage.ts` chamado inline | Acoplado ao fluxo principal |
| Compaction | `compactMessages()` chamado inline | Logica de decisao no agent.ts |
| Cost tracking | Fetch ao OpenRouter inline | ~15 linhas de boilerplate no agent.ts |
| Error wrapping | Try/catch manual no streaming | Repetitivo |
| Logging | `console.warn` espalhado | Sem estrutura |

Nao ha como um consumidor adicionar comportamentos (ex: cache, guardrails, metricas) sem modificar o agent.ts ou o source da ai-sdk.

O Vercel AI SDK v4 oferece `wrapLanguageModel()` que compoe middleware ao redor do modelo:

```typescript
const wrapped = wrapLanguageModel({
  model: baseModel,
  middleware: [loggingMiddleware, cachingMiddleware, guardrailsMiddleware],
});
```

Cada middleware pode interceptar `transformParams`, `wrapGenerate`, e `wrapStream`.

### Estado desejado

1. O consumidor pode passar um array de middleware via `AiAgentOptions`
2. A ai-sdk aplica os middleware ao modelo antes de chamar `streamText()`
3. Middleware de logging padrao disponivel como export opcional
4. O agent.ts fica mais limpo — middleware pode absorver concerns que hoje estao inline

## Especificacao

### 1. Nova opcao em AiAgentOptions

```typescript
// types.ts
import type { LanguageModelV1Middleware } from "ai";

export interface AiAgentOptions {
  // ...existentes...

  /** Middleware pipeline aplicada ao modelo. Executados na ordem do array. */
  middleware?: LanguageModelV1Middleware[];
}
```

### 2. Aplicacao no agent.ts

No `agent.ts`, antes de chamar `streamText()`, aplicar middleware se fornecidos:

```typescript
import { wrapLanguageModel } from "ai";

// Criar modelo base
let model = openrouter(options.model);

// Aplicar middleware pipeline
if (options.middleware && options.middleware.length > 0) {
  model = wrapLanguageModel({ model, middleware: options.middleware });
}

result = streamText({
  model, // modelo com middleware aplicado
  tools,
  maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
  messages,
  system: systemPrompt,
});
```

Tambem aplicar na `compactMessages()` se middleware existir — a compaction usa `generateText()` e deve passar pelo mesmo pipeline.

### 3. Middleware de logging embutido

Criar `packages/ai-sdk/src/middleware/logging.ts`:

```typescript
import type { LanguageModelV1Middleware } from "ai";

export function createLoggingMiddleware(
  logger: (msg: string, data?: Record<string, unknown>) => void = console.log
): LanguageModelV1Middleware {
  return {
    transformParams: async ({ params }) => {
      logger("[ai:llm] request", {
        model: params.model,
        tools: params.tools?.length ?? 0,
        messages: params.prompt?.length ?? 0,
      });
      return params;
    },
    wrapGenerate: async ({ doGenerate }) => {
      const startMs = Date.now();
      const result = await doGenerate();
      logger("[ai:llm] generate", {
        durationMs: Date.now() - startMs,
        finishReason: result.finishReason,
        usage: result.usage,
      });
      return result;
    },
    wrapStream: async ({ doStream }) => {
      const startMs = Date.now();
      const result = await doStream();
      logger("[ai:llm] stream started", { durationMs: Date.now() - startMs });
      return result;
    },
  };
}
```

### 4. Exportar no index.ts

```typescript
export { createLoggingMiddleware } from "./middleware/logging.js";
```

### 5. Passagem para compaction

Refatorar `CompactOptions` para aceitar middleware e aplicar na chamada `generateText()`:

```typescript
// context/compaction.ts
export interface CompactOptions {
  // ...existentes...
  middleware?: LanguageModelV1Middleware[];
}
```

Na funcao `compactMessages()`, aplicar `wrapLanguageModel()` se middleware fornecido.

No `agent.ts`, passar `options.middleware` para `compactMessages()`.

## Limites

- **NAO** mover logica existente do agent.ts para middleware neste PRP — isso eh refatoracao futura. Este PRP apenas abre a porta
- **NAO** criar middleware de caching, guardrails ou RAG — apenas o de logging como exemplo. Os demais serao criados pelos consumidores
- **NAO** tornar middleware obrigatorio — sem middleware, o comportamento eh identico ao atual
- **NAO** adicionar dependencias — `wrapLanguageModel` e `LanguageModelV1Middleware` ja existem no pacote `ai`

## Validacao

- [ ] `runAiAgent()` sem `middleware` se comporta identicamente ao antes
- [ ] `runAiAgent()` com `createLoggingMiddleware()` loga request/response com timing
- [ ] Middleware sao aplicados na ordem do array
- [ ] Compaction tambem passa pelo middleware pipeline
- [ ] Tipo `LanguageModelV1Middleware` re-exportado para consumidores que queiram criar middleware customizados
- [ ] `npm run build --workspace=packages/ai-sdk` compila sem erros

## Rastreabilidade

| Mudanca | Arquivos |
|---|---|
| Nova opcao middleware | `packages/ai-sdk/src/types.ts` |
| Aplicacao do middleware | `packages/ai-sdk/src/agent.ts` |
| Middleware de logging | `packages/ai-sdk/src/middleware/logging.ts` (novo) |
| Compaction com middleware | `packages/ai-sdk/src/context/compaction.ts` |
| Exports | `packages/ai-sdk/src/index.ts` |
