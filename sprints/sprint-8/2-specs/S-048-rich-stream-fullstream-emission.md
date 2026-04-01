# S-048 — Rich Stream: Emissão de Eventos no fullStream

Modificar o loop `fullStream` em `agent.ts` para emitir `reasoning`, `tool-call` e `tool-result` como eventos discretos, e configurar `providerOptions` para ativação de extended thinking quando solicitado via `AiAgentOptions.reasoning`.

**Resolve:** RS-004 (loop fullStream descarta eventos ricos), RS-005 (streamText sem providerOptions para reasoning)
**Score de prioridade:** 9
**Dependência:** S-047 (schemas e tipos devem existir antes)
**PRP:** 13 — Rich Stream

---

## 1. Objetivo

- Capturar eventos `reasoning`, `tool-call` e `tool-result` do `fullStream` do Vercel AI SDK e emiti-los como `AiAgentEvent` tipados via yield
- Passar `providerOptions.anthropic.thinking` ao `streamText()` quando `AiAgentOptions.reasoning` estiver habilitado
- Manter comportamento atual para `text-delta`, `finish-step` e `error` — zero regressão

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-sdk/src/agent.ts` — Loop fullStream

No loop `for await (const part of result.fullStream)` (linhas ~382-396), adicionar handlers para os 3 novos tipos de evento:

```typescript
for await (const part of result.fullStream) {
  if (part.type === "text-delta") {
    const delta = (part as any).text ?? (part as any).delta ?? (part as any).textDelta ?? "";
    fullText += delta;
    yield { type: "text", content: delta };

  } else if (part.type === "reasoning") {
    yield {
      type: "reasoning",
      content: (part as any).textDelta ?? (part as any).text ?? "",
    };

  } else if (part.type === "tool-call") {
    yield {
      type: "tool-call",
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      args: part.args,
    };

  } else if (part.type === "tool-result") {
    yield {
      type: "tool-result",
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      result: part.result,
    };

  } else if (part.type === "finish-step") {
    // Comportamento existente — flush pendingStepEvents
    while (pendingStepEvents.length > 0) {
      yield pendingStepEvents.shift()!;
    }

  } else if (part.type === "error") {
    const errMsg = (part as any).error?.message ?? JSON.stringify((part as any).error ?? part);
    throw new Error(`OpenRouter API error: ${errMsg}`);
  }
}
```

**Regras:**
- O campo `reasoning` do Vercel AI SDK só aparece quando o modelo suporta (Claude extended thinking, OpenAI o1/o3). Modelos sem suporte simplesmente não emitem — nenhum guard necessário
- Os campos `toolCallId`, `toolName`, `args` e `result` vêm diretamente do Vercel AI SDK — sem transformação
- A ordem dos `else if` não importa para correção, mas manter `text-delta` primeiro para hot-path

### 2.2 Arquivo: `apps/packages/ai-sdk/src/agent.ts` — providerOptions

Na função que chama `streamText()`, adicionar `providerOptions` condicional baseado em `AiAgentOptions.reasoning`:

```typescript
// Dentro da chamada streamText()
const reasoningConfig = options.reasoning
  ? {
      anthropic: {
        thinking: {
          type: "enabled" as const,
          budgetTokens: typeof options.reasoning === "object"
            ? options.reasoning.budgetTokens
            : 5000,
        },
      },
    }
  : undefined;

streamText({
  // ...existentes...
  providerOptions: reasoningConfig,
});
```

**Regras:**
- Quando `reasoning` é `true`, usa budget padrão de 5000 tokens
- Quando `reasoning` é `{ budgetTokens: N }`, usa o valor especificado
- Quando `reasoning` é `false`/`undefined`, não passa `providerOptions` — comportamento idêntico ao atual
- Modelos que não suportam reasoning ignoram `providerOptions` sem erro

---

## 3. Impacto em Outros Arquivos

- **`stream-dispatcher.ts`** — Não precisa de mudança. Bufferiza apenas `event.type === "text"`, despacha em `step_finish`/`result`. Os novos tipos passam pelo `yield event` sem afetar o buffer
- **`conversations.ts`** — Não precisa de mudança. Serializa qualquer `AgentEvent` como JSON
- **`messages.jsonl`** — Eventos ricos NÃO são persistidos individualmente. O Vercel AI SDK já persiste o histórico completo com tool calls no sessionDir

---

## 4. Critérios de Aceite

- [ ] Evento `reasoning` é emitido via yield quando modelo suporta extended thinking e `reasoning` está habilitado em `AiAgentOptions`
- [ ] Evento `tool-call` é emitido via yield para cada chamada de ferramenta, com `toolCallId`, `toolName` e `args` corretos
- [ ] Evento `tool-result` é emitido via yield para cada resultado de ferramenta, com `toolCallId`, `toolName` e `result` corretos
- [ ] `providerOptions` com `anthropic.thinking` é passado ao `streamText()` quando `reasoning: true` ou `reasoning: { budgetTokens: N }`
- [ ] `providerOptions` NÃO é passado quando `reasoning` é `false`/`undefined` — zero regressão
- [ ] Eventos `text-delta` e `finish-step` continuam funcionando como antes
- [ ] Typecheck passa após alterações
- [ ] Build do ai-sdk (`npm run build:packages`) compila sem erros
