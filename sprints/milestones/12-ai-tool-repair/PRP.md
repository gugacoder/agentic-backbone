# PRP — Ai: Tool Call Repair para Resiliencia com Modelos Baratos

Habilitar `experimental_repairToolCall` do Vercel AI SDK na ai-sdk, permitindo que tool calls malformadas sejam corrigidas automaticamente antes de falhar.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Quando um modelo gera uma tool call com JSON invalido ou parametros fora do schema, o Vercel AI SDK lanca `InvalidToolInputError` e o step falha. A ai-sdk propaga o erro como `OpenRouter stream error`:

```typescript
// agent.ts:229-235
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg.startsWith("OpenRouter")) {
    throw new Error(`OpenRouter stream error: ${msg}`);
  }
  throw err;
}
```

Isso eh aceitavel com modelos fortes (Claude Sonnet/Opus) que raramente erram tool calls. Mas com modelos baratos (Haiku, DeepSeek, Llama, Gemini Flash) — que o consumidor pode querer usar via `prepareStep` (PRP 07) ou aliases (PRP 10) — erros de tool call sao frequentes:

| Modelo | Tipo de erro comum |
|---|---|
| Claude Haiku | Omite campos required, tipos errados |
| DeepSeek | JSON com trailing comma, strings sem escape |
| Llama 3.1 | Esquece quotes em string values |
| Gemini Flash | Campos extras nao declarados no schema |

O Vercel AI SDK v4 oferece `experimental_repairToolCall`:

```typescript
streamText({
  experimental_repairToolCall: async ({ toolCall, tools, parameterSchema, error }) => {
    // Tentar corrigir a tool call
    return repairedToolCall;
  },
});
```

### Estado desejado

1. A ai-sdk tenta corrigir tool calls invalidas automaticamente antes de falhar
2. A estrategia de reparo eh configuravel pelo consumidor
3. Reparo padrao: re-enviar o tool call com o erro para o mesmo modelo corrigir
4. Limite de tentativas para evitar loop infinito

## Especificacao

### 1. Nova opcao em AiAgentOptions

```typescript
// types.ts
export interface AiAgentOptions {
  // ...existentes...

  /** Habilita reparo automatico de tool calls malformadas. Default: true */
  repairToolCalls?: boolean;

  /** Maximo de tentativas de reparo por tool call. Default: 1 */
  maxRepairAttempts?: number;
}
```

### 2. Implementacao do repair handler

Criar `packages/ai-sdk/src/tool-repair.ts`:

```typescript
import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";

const MAX_REPAIR_ATTEMPTS_DEFAULT = 1;

export interface RepairContext {
  model: LanguageModelV1;
  maxAttempts: number;
}

/**
 * Cria um handler de reparo que pede ao modelo para corrigir a tool call.
 * Tenta N vezes. Se todas falharem, retorna null (deixa o erro original propagar).
 */
export function createToolCallRepairHandler(ctx: RepairContext) {
  const attempts = new Map<string, number>();

  return async ({
    toolCall,
    tools,
    parameterSchema,
    error,
  }: {
    toolCall: { toolName: string; args: string };
    tools: Record<string, unknown>;
    parameterSchema: unknown;
    error: Error;
  }) => {
    const key = `${toolCall.toolName}:${toolCall.args}`;
    const current = attempts.get(key) ?? 0;

    if (current >= ctx.maxAttempts) {
      return null; // desiste — erro original propaga
    }
    attempts.set(key, current + 1);

    try {
      const result = await generateText({
        model: ctx.model,
        system: [
          "You generated an invalid tool call. Fix the JSON arguments to match the schema.",
          "Return ONLY the corrected JSON object — no explanation, no markdown.",
        ].join("\n"),
        prompt: [
          `Tool: ${toolCall.toolName}`,
          `Schema: ${JSON.stringify(parameterSchema)}`,
          `Invalid args: ${toolCall.args}`,
          `Error: ${error.message}`,
        ].join("\n"),
        maxTokens: 1000,
      });

      const repaired = result.text.trim();
      return { toolName: toolCall.toolName, args: repaired };
    } catch {
      return null; // reparo falhou — erro original propaga
    }
  };
}
```

### 3. Integracao no agent.ts

```typescript
import { createToolCallRepairHandler } from "./tool-repair.js";

// No agent.ts, ao montar streamText:
const repairEnabled = options.repairToolCalls ?? true;

result = streamText({
  model,
  tools,
  maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
  messages,
  system: systemPrompt,

  experimental_repairToolCall: repairEnabled
    ? createToolCallRepairHandler({
        model, // mesmo modelo usado no agente
        maxAttempts: options.maxRepairAttempts ?? MAX_REPAIR_ATTEMPTS_DEFAULT,
      })
    : undefined,
});
```

### 4. Novo evento: tool_repair

```typescript
// types.ts
export type AiAgentEvent =
  | // ...existentes...
  | { type: "tool_repair"; toolName: string; error: string; repaired: boolean };
```

Emitir quando um reparo eh tentado, para observabilidade. O consumidor sabe quando modelos baratos estao gerando tool calls invalidas.

### 5. Metricas no usage

Adicionar ao `AiUsageData`:

```typescript
export interface AiUsageData {
  // ...existentes...

  /** Numero de tool calls reparadas nesta sessao. */
  repairedToolCalls?: number;
}
```

## Limites

- **NAO** usar um modelo diferente para reparo neste PRP — usar o mesmo modelo do agente. Trocar modelo de reparo eh otimizacao futura (e pode usar `prepareStep` do PRP 07)
- **NAO** tentar reparar mais de `maxRepairAttempts` vezes (default: 1) — evita loop infinito e custo inesperado
- **NAO** reparar erros que nao sao `InvalidToolInputError` — erros de execucao da tool nao sao reparaveis
- **NAO** adicionar dependencias

## Validacao

- [ ] Com `repairToolCalls: true` (default): tool call invalida eh corrigida e executa normalmente
- [ ] Com `repairToolCalls: false`: tool call invalida falha como antes
- [ ] Apos `maxRepairAttempts` tentativas: desiste e propaga o erro original
- [ ] Evento `tool_repair` emitido com resultado (repaired: true/false)
- [ ] `AiUsageData.repairedToolCalls` contabiliza reparos da sessao
- [ ] Modelos fortes (Sonnet, Opus): repair nunca eh acionado (tool calls ja sao validas)
- [ ] `npm run build --workspace=packages/ai-sdk` compila sem erros

## Rastreabilidade

| Mudanca | Arquivos |
|---|---|
| Handler de reparo | `packages/ai-sdk/src/tool-repair.ts` (novo) |
| Integracao no agente | `packages/ai-sdk/src/agent.ts` |
| Novos tipos | `packages/ai-sdk/src/types.ts` |
| Exports | `packages/ai-sdk/src/index.ts` |
