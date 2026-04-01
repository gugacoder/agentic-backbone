# PRP — Rich Stream: Eventos Tipados no AgentEvent

Enriquecer o stream de eventos do agente para emitir `reasoning`, `tool-call` e `tool-result` como eventos discretos — permitindo que clientes ricos (Hub, Chat PWA) renderizem timeline de atividades, pensamento retratil e cards de ferramentas, enquanto canais pobres (WhatsApp, Discord) continuam recebendo texto plano.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

O `AgentEvent` (definido em `apps/packages/ai-sdk/src/schemas.ts`) tem 5 tipos:

```typescript
AgentEvent =
  | { type: "init"; sessionId?: string }
  | { type: "text"; content: string }
  | { type: "step_finish" }
  | { type: "result"; content: string }
  | { type: "usage"; usage: UsageData }
```

O `fullStream` do Vercel AI SDK emite eventos ricos (`text-delta`, `reasoning`, `tool-call`, `tool-result`, `finish-step`), mas `agent.ts:382-386` so consome `text-delta` e `finish-step` — os demais sao descartados.

O `AiAgentEvent` interno (`types.ts`) inclui `step_finish` com `toolCalls: string[]` (nomes), mas sem argumentos, resultados ou status.

O `stream-dispatcher.ts` (canais) acumula `text` em buffer e despacha texto plano a cada `step_finish` — unico formato de entrega.

A rota `POST /conversations/:sessionId/messages` serializa cada `AgentEvent` como JSON no SSE sem filtragem (`routes/conversations.ts:209-213`).

### Problema / Motivacao

Clientes ricos (como a interface do Claude.ai nas imagens de referencia) oferecem:

1. **Timeline retratil** — cada tool call aparece como item expandivel com query e resultados
2. **Pensamento visivel** — bloco de reasoning colapsavel durante e apos a geracao
3. **Resposta limpa** — texto final separado das atividades intermediarias

Sem eventos tipados, o frontend recebe texto concatenado sem estrutura, impossibilitando essa UX.

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| `AgentEvent` tipos | 5 (`init`, `text`, `step_finish`, `result`, `usage`) | 8 (+`reasoning`, `tool-call`, `tool-result`) |
| `fullStream` consumo | So `text-delta` e `finish-step` | Todos os tipos relevantes |
| Entrega SSE (canal rico) | Texto plano concatenado | Eventos tipados discretos |
| Entrega canal pobre | Texto plano | Texto plano (sem mudanca) |
| `stream-dispatcher` | Buffer de `text` | Buffer de `text`, ignora eventos ricos |
| `messages.jsonl` | So texto final | Inclui metadados de tool calls e reasoning |

---

## Especificacao

### 1. Novos tipos no AgentEvent

#### 1.1 Arquivo: `apps/packages/ai-sdk/src/schemas.ts`

Adicionar 3 novos membros ao `AgentEventSchema`:

```typescript
export const AgentEventSchema = z.discriminatedUnion("type", [
  // Existentes
  z.object({ type: z.literal("init"), sessionId: z.string().optional() }),
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({ type: z.literal("step_finish") }),
  z.object({ type: z.literal("result"), content: z.string() }),
  z.object({ type: z.literal("usage"), usage: UsageDataSchema }),

  // Novos — rich stream
  z.object({
    type: z.literal("reasoning"),
    content: z.string(),
  }),
  z.object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.unknown(),
  }),
]);
```

Campos seguem exatamente os nomes do Vercel AI SDK `fullStream` para evitar mapeamento.

#### 1.2 Arquivo: `apps/packages/ai-sdk/src/types.ts`

Adicionar ao `AiAgentEvent`:

```typescript
export type AiAgentEvent =
  // ...existentes...
  | { type: "reasoning"; content: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown };
```

### 2. Emissao dos eventos ricos no fullStream

#### 2.1 Arquivo: `apps/packages/ai-sdk/src/agent.ts`

Alterar o loop `for await (const part of result.fullStream)` (linhas ~382-396):

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
    while (pendingStepEvents.length > 0) {
      yield pendingStepEvents.shift()!;
    }

  } else if (part.type === "error") {
    const errMsg = (part as any).error?.message ?? JSON.stringify((part as any).error ?? part);
    throw new Error(`OpenRouter API error: ${errMsg}`);
  }
}
```

**Regra**: o campo `reasoning` do Vercel AI SDK so aparece quando o modelo suporta (Claude extended thinking, OpenAI o1/o3). Modelos sem suporte simplesmente nao emitem — nenhum guard necessario.

### 3. Stream dispatcher — canais pobres

#### 3.1 Arquivo: `apps/backbone/src/channels/delivery/stream-dispatcher.ts`

O dispatcher NAO precisa de mudanca funcional. Ele ja filtra por `event.type === "text"` para buffer e despacha em `step_finish`/`result`. Os novos tipos (`reasoning`, `tool-call`, `tool-result`) passam pelo `yield event` sem afetar o buffer de texto.

O canal pobre recebe apenas o texto acumulado via `deliverToChannel()` — comportamento identico ao atual.

### 4. Rota SSE — passthrough

#### 4.1 Arquivo: `apps/backbone/src/routes/conversations.ts`

Nenhuma mudanca necessaria. A rota ja serializa qualquer `AgentEvent` como JSON:

```typescript
await stream.writeSSE({ data: JSON.stringify(event) });
```

Os novos tipos sao serializados automaticamente.

### 5. Persistencia — messages.jsonl

#### 5.1 Arquivo: `apps/backbone/src/conversations/index.ts`

Na funcao `sendMessage()`, o `result` event ja persiste o texto final. Os eventos ricos (`reasoning`, `tool-call`, `tool-result`) NAO sao persistidos individualmente no `messages.jsonl` — eles existem apenas no stream em tempo real.

**Justificativa**: o Vercel AI SDK ja persiste o historico completo (com tool calls) no `sessionDir`. Duplicar no JSONL seria redundante e quebraria a separacao de responsabilidades.

### 6. Reasoning — ativacao no Vercel AI SDK

#### 6.1 Arquivo: `apps/packages/ai-sdk/src/agent.ts`

Para que o modelo emita `reasoning` no `fullStream`, eh necessario habilitar na chamada `streamText()`. O Vercel AI SDK usa `providerOptions` especifico por provider:

```typescript
// Dentro de callStreamText()
streamText({
  // ...existentes...
  providerOptions: {
    anthropic: { thinking: { type: "enabled", budgetTokens: 5000 } },
    ...options.providerConfig,
  },
});
```

**Decisao**: NAO habilitar reasoning por default. Adicionar campo em `AiAgentOptions`:

```typescript
export interface AiAgentOptions {
  // ...existentes...

  /** Habilita extended thinking/reasoning no stream. Default: false */
  reasoning?: boolean | { budgetTokens: number };
}
```

O backbone controla isso via configuracao do agente (AGENT.yml ou LLM settings) — nao pelo cliente.

---

## Limites

### NAO fazer

- NAO criar mecanismo de filtragem por tipo no SSE — o frontend decide o que renderizar
- NAO alterar o formato do `messages.jsonl` — historico de mensagens continua como esta
- NAO adicionar campo `rich` em CHANNEL.yml — a riqueza eh do stream, nao do canal. O canal pobre simplesmente ignora eventos que nao entende
- NAO implementar UI/frontend neste PRP — isso eh responsabilidade do app consumidor (Pneu SOS, Hub)
- NAO truncar ou sanitizar `tool-result` — o resultado completo eh emitido. O frontend decide se mostra resumo ou detalhe
- NAO quebrar backward compatibility — clientes existentes que so tratam `text`/`result` continuam funcionando

### Observacoes

- Modelos via OpenRouter que nao suportam `reasoning` simplesmente nao emitem o evento — zero impacto
- O `tool-result` pode conter payloads grandes (ex: resultado de WebSearch com 10 resultados). O frontend deve tratar isso com virtualizacao ou truncamento visual
- O `toolCallId` eh essencial para correlacionar `tool-call` com seu `tool-result` no frontend
- O `step_finish` continua existindo e marca o fim de um step — util para o frontend saber quando agrupar tool calls

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1a | Adicionar tipos ao `AgentEventSchema` em `schemas.ts` | nada |
| 1b | Adicionar tipos ao `AiAgentEvent` em `types.ts` | nada |
| 1c | Adicionar `reasoning` ao `AiAgentOptions` em `types.ts` | nada |
| 2 | Alterar loop `fullStream` em `agent.ts` para emitir novos eventos | 1a, 1b, 1c |
| 3 | Configurar `providerOptions` para reasoning em `agent.ts` | 1c |
| 4 | Build do ai-sdk (`npm run build:packages`) e validacao | 2, 3 |
| 5 | Teste manual via `POST /conversations/:id/messages` — verificar que novos eventos aparecem no SSE | 4 |

Fases 1a, 1b e 1c sao independentes e podem ser executadas em paralelo.
