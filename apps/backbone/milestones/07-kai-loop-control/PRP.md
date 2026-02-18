# PRP — Kai: Controle de Loop Agentic via stopWhen/prepareStep

Adicionar suporte a `stopWhen` e `prepareStep` do Vercel AI SDK na kai-sdk, permitindo controle fino do loop agentic (parada condicional, troca de modelo por step, filtragem de tools por etapa).

## Execution Mode

`implementar`

## Contexto

### Estado atual

A kai-sdk usa `streamText()` com `maxSteps` como unico controle de loop:

```typescript
// agent.ts:204-211
result = streamText({
  model: openrouter(options.model),
  tools,
  maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS, // bruto: 30
  messages,
  system: systemPrompt,
  onStepFinish: () => {},
});
```

Problemas:

| Problema | Impacto |
|---|---|
| Limite unico (`maxSteps: 30`) | Nao ha como parar antes se a tarefa ja foi concluida |
| Mesmo modelo em todos os steps | Gasta modelo caro em steps triviais (ex: ler um arquivo) |
| Todas as tools disponiveis em todos os steps | Modelo pode chamar tools irrelevantes para a etapa atual |
| `onStepFinish` vazio | Nenhuma logica de observacao ou decisao entre steps |

O Vercel AI SDK v4 oferece:

- **`stopWhen`**: condicoes de parada declarativas (ex: `stepCountIs(N)`, custom predicates)
- **`prepareStep`**: callback executado antes de cada step que pode alterar `model`, `tools`, `toolChoice`, e `providerOptions`

### Estado desejado

1. O consumidor pode passar condicoes de parada customizadas via `KaiAgentOptions`
2. O consumidor pode fornecer um callback `prepareStep` para customizar cada step
3. A kai-sdk usa `onStepFinish` para emitir eventos de progresso (novo tipo de evento)

## Especificacao

### 1. Novas opcoes em KaiAgentOptions

```typescript
// types.ts — novas opcoes
export interface KaiAgentOptions {
  // ...existentes...

  /** Condicao de parada customizada. Complementa maxSteps — o que chegar primeiro. */
  stopWhen?: (event: StepFinishEvent) => boolean;

  /** Callback executado antes de cada step. Retorna overrides para model, tools, toolChoice. */
  prepareStep?: (context: PrepareStepContext) => PrepareStepResult | undefined;
}

export interface PrepareStepContext {
  /** Numero do step atual (0-indexed) */
  stepNumber: number;
  /** Numero total de steps executados ate agora */
  stepCount: number;
  /** Tool calls do step anterior (vazio no primeiro step) */
  previousToolCalls: string[];
}

export interface PrepareStepResult {
  /** Trocar o modelo para este step */
  model?: string;
  /** Filtrar tools disponiveis neste step (nomes) */
  activeTools?: string[];
  /** Forcar escolha de tool: "auto" | "required" | "none" | nome da tool */
  toolChoice?: "auto" | "required" | "none" | { type: "tool"; toolName: string };
}
```

### 2. Integracao no streamText

No `agent.ts`, mapear as opcoes da kai para os parametros do Vercel AI SDK:

```typescript
result = streamText({
  model: openrouter(options.model),
  tools,
  maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
  messages,
  system: systemPrompt,

  // Loop control — novo
  prepareStep: options.prepareStep
    ? ({ stepNumber, stepCount }) => {
        const previous = []; // extrair tool calls do step anterior
        const overrides = options.prepareStep!({
          stepNumber,
          stepCount,
          previousToolCalls: previous,
        });
        if (!overrides) return undefined;
        return {
          model: overrides.model ? openrouter(overrides.model) : undefined,
          activeTools: overrides.activeTools,
          toolChoice: overrides.toolChoice,
        };
      }
    : undefined,

  onStepFinish: (event) => {
    // Emitir evento de progresso (via side-channel — ver secao 3)
  },
});
```

### 3. Novo evento: step_finish

Adicionar tipo de evento para observabilidade do loop:

```typescript
// types.ts
export type KaiAgentEvent =
  | // ...existentes...
  | { type: "step_finish"; step: number; toolCalls: string[]; finishReason: string };
```

O `onStepFinish` popula um array de eventos que o loop de streaming emite entre os text-deltas.

### 4. stopWhen via maxSteps adaptativo

O `stopWhen` do Vercel AI SDK pode nao estar disponivel em todas as versoes. Implementar de forma compativel:

- Se `options.stopWhen` for fornecido, usar `onStepFinish` para avaliar a condicao
- Se a condicao retornar `true`, usar `result.abort()` ou `maxSteps` dinamico

Fallback: se a API nao suportar `stopWhen` nativamente, manter `maxSteps` como limite superior e documentar a limitacao.

## Limites

- **NAO** alterar o comportamento default — sem `prepareStep` e `stopWhen`, o agente funciona exatamente como hoje
- **NAO** adicionar dependencias
- **NAO** criar abstracoes de "routing" entre modelos — `prepareStep` eh o mecanismo, o consumidor decide a logica
- **NAO** mexer em tools existentes — apenas a chamada `streamText()` e os tipos

## Validacao

- [ ] `runKaiAgent()` sem `prepareStep`/`stopWhen` se comporta identicamente ao antes
- [ ] `prepareStep` com `model` diferente executa o step com o modelo especificado
- [ ] `prepareStep` com `activeTools` filtra tools visiveis ao modelo naquele step
- [ ] Eventos `step_finish` emitidos corretamente entre steps
- [ ] `stopWhen` interrompe o loop antes de `maxSteps` quando a condicao eh satisfeita
- [ ] `npm run build --workspace=packages/kai-sdk` compila sem erros

## Rastreabilidade

| Mudanca | Arquivos |
|---|---|
| Novos tipos | `packages/kai-sdk/src/types.ts` |
| Integracao streamText | `packages/kai-sdk/src/agent.ts` |
| Exports | `packages/kai-sdk/src/index.ts` |
