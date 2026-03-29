# PRP-13 — Rich Stream: Eventos Tipados no AgentEvent

Enriquecer o stream de eventos do agente para emitir `reasoning`, `tool-call` e `tool-result` como eventos discretos — permitindo que clientes ricos renderizem timeline de atividades, pensamento retrátil e cards de ferramentas, enquanto canais pobres continuam recebendo texto plano.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O `AgentEvent` (`apps/packages/ai-sdk/src/schemas.ts`) tem 5 tipos: `init`, `text`, `step_finish`, `result`, `usage`. O `fullStream` do Vercel AI SDK emite eventos ricos (`reasoning`, `tool-call`, `tool-result`), mas `agent.ts` só consome `text-delta` e `finish-step` — os demais são descartados. O `proxy.ts` filtra explicitamente e só passa 5 tipos, descartando silenciosamente qualquer tipo novo. `AiAgentOptions` não tem campo para ativar extended thinking.

### Estado desejado

1. Schemas Zod e tipos TypeScript com 3 novos tipos de evento (`reasoning`, `tool-call`, `tool-result`)
2. Campo `reasoning` em `AiAgentOptions` para ativação opt-in de extended thinking
3. Loop `fullStream` emitindo os 3 novos tipos como `AiAgentEvent` tipados
4. `providerOptions` configurado para reasoning quando habilitado
5. `proxy.ts` encaminhando todos os novos tipos ao backbone (gap crítico RS-006)
6. Build do ai-sdk com typecheck limpo
7. Validação end-to-end via SSE

## Especificacao

### Feature F-169: Schemas Zod — 3 novos tipos no AgentEventSchema

**Arquivo:** `apps/packages/ai-sdk/src/schemas.ts`

Adicionar 3 novos membros ao `AgentEventSchema` (discriminated union):

```typescript
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
```

Campos seguem exatamente os nomes do Vercel AI SDK `fullStream` para zero-mapping.

**Critérios de aceite:**
- [ ] `AgentEventSchema` aceita objetos com `type: "reasoning"`, `type: "tool-call"` e `type: "tool-result"` sem erro Zod
- [ ] Tipos existentes (`init`, `text`, `step_finish`, `result`, `usage`) continuam validando

### Feature F-170: Tipos TypeScript — AiAgentEvent + AiAgentOptions.reasoning

**Arquivo:** `apps/packages/ai-sdk/src/types.ts`

Adicionar ao type union `AiAgentEvent`:

```typescript
| { type: "reasoning"; content: string }
| { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown> }
| { type: "tool-result"; toolCallId: string; toolName: string; result: unknown }
```

Adicionar campo ao `AiAgentOptions`:

```typescript
/** Habilita extended thinking/reasoning no stream. Default: false */
reasoning?: boolean | { budgetTokens: number };
```

Quando `true`, usa budget padrão (5000 tokens). Quando objeto, usa `budgetTokens` especificado. Quando `false`/omitido, reasoning não é ativado.

**Critérios de aceite:**
- [ ] `AiAgentEvent` permite yield tipado dos 3 novos tipos sem erro TypeScript
- [ ] `AiAgentOptions` aceita `reasoning: true`, `reasoning: { budgetTokens: 8000 }` e `reasoning: undefined`
- [ ] Tipos existentes de `AiAgentEvent` inalterados

### Feature F-171: Emissão de eventos ricos no loop fullStream

**Arquivo:** `apps/packages/ai-sdk/src/agent.ts`

No loop `for await (const part of result.fullStream)`, adicionar handlers para `reasoning`, `tool-call` e `tool-result`:

```typescript
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
}
```

Manter `text-delta` primeiro no if-chain (hot-path). O campo `reasoning` só aparece quando o modelo suporta — nenhum guard necessário.

Adicionar `providerOptions` condicional baseado em `AiAgentOptions.reasoning`:

```typescript
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

**Critérios de aceite:**
- [ ] Evento `reasoning` emitido via yield quando modelo suporta e `reasoning` habilitado
- [ ] Evento `tool-call` emitido com `toolCallId`, `toolName` e `args` corretos
- [ ] Evento `tool-result` emitido com `toolCallId`, `toolName` e `result` corretos
- [ ] `providerOptions` passado ao `streamText()` quando `reasoning: true` ou `{ budgetTokens: N }`
- [ ] `providerOptions` NÃO passado quando `reasoning` é `false`/`undefined`
- [ ] Eventos `text-delta` e `finish-step` continuam funcionando como antes

### Feature F-172: Proxy passthrough — encaminhar novos tipos ao backbone

**Arquivo:** `apps/packages/ai-sdk/src/proxy.ts`

**Contexto do gap (RS-006):** O `proxy.ts` contém a função `runAgent()` que filtra explicitamente os eventos do generator interno, passando apenas `init`, `text`, `result`, `usage`, `step_finish`. Qualquer novo tipo é silenciosamente descartado. O backbone **nunca** usa `runAiAgent()` diretamente — tudo passa pelo proxy. Sem esta correção, toda a implementação de F-169/F-170/F-171 é invisível ao cliente SSE.

```
agent.ts (yield reasoning/tool-call/tool-result)   ← F-171
  → proxy.ts runAgent()                             ← F-172 (passthrough)
  → backbone/src/agent/index.ts
  → conversations/index.ts sendMessage()
  → routes/conversations.ts (SSE writeSSE)
  → cliente (EventSource)
```

Adicionar passthrough para os 3 novos tipos no filtro de eventos:

```typescript
} else if (event.type === "reasoning") {
  yield { type: "reasoning", content: event.content };
} else if (event.type === "tool-call") {
  yield {
    type: "tool-call",
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    args: event.args,
  };
} else if (event.type === "tool-result") {
  yield {
    type: "tool-result",
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    result: event.result,
  };
}
```

**Alternativa recomendada:** Se o filtro for um allowlist (if-chain com tipos explícitos), considerar inverter para denylist — passar todos os tipos por default e só filtrar os que precisam de tratamento especial. Isso evita que futuros tipos sejam silenciosamente descartados. O agente coder deve avaliar a estrutura e escolher a abordagem que minimize risco de regressão futura.

**Critérios de aceite:**
- [ ] `proxy.ts` encaminha `reasoning` com `content` intacto
- [ ] `proxy.ts` encaminha `tool-call` com `toolCallId`, `toolName`, `args` intactos
- [ ] `proxy.ts` encaminha `tool-result` com `toolCallId`, `toolName`, `result` intactos
- [ ] Eventos `init`, `text`, `result`, `usage`, `step_finish` continuam sendo encaminhados
- [ ] Clientes existentes que só tratam `text`/`result` continuam funcionando

### Feature F-173: Build ai-sdk + validação end-to-end

Após aplicar todas as mudanças (F-169 a F-172):

1. Build: `npm run build:packages` — compila sem erros
2. Typecheck: nenhum erro TypeScript no ai-sdk
3. Validação SSE:
   - Iniciar backbone (`npm run dev:all`)
   - Obter JWT via `POST /api/v1/ai/auth/login`
   - Enviar mensagem que provoque tool calls via `POST /api/v1/ai/conversations/:sessionId/messages`
   - Confirmar presença de `tool-call` e `tool-result` no stream SSE
   - (Opcional) Se reasoning habilitado, confirmar evento `reasoning`

**Critérios de aceite:**
- [ ] `npm run build:packages` compila sem erros
- [ ] Typecheck passa
- [ ] Stream SSE contém eventos `tool-call` e `tool-result` ao provocar tool calls
- [ ] Clientes existentes continuam funcionando sem quebra

## Limites

- **NÃO** criar mecanismo de filtragem por tipo no SSE — o frontend decide o que renderizar
- **NÃO** alterar o formato do `messages.jsonl` — histórico de mensagens continua como está
- **NÃO** implementar UI/frontend neste PRP — responsabilidade do app consumidor
- **NÃO** truncar ou sanitizar `tool-result` — resultado completo emitido, frontend decide apresentação
- **NÃO** quebrar backward compatibility — clientes que só tratam `text`/`result` continuam funcionando
- **NÃO** alterar `stream-dispatcher.ts` nem `conversations.ts` — já passam eventos genéricos
- **NÃO** persistir eventos ricos individualmente no `messages.jsonl` — Vercel AI SDK já persiste histórico completo

## Dependencias

Nenhuma dependência de PRPs anteriores para a implementação. As mudanças são internas ao package `ai-sdk`.

**Ordem interna de features:**

| Fase | Features | Depende de |
|------|----------|------------|
| 1 (paralelo) | F-169, F-170 | nada |
| 2 (depende de 1) | F-171, F-172 | F-169, F-170 |
| 3 (depende de 2) | F-173 | F-171, F-172 |

## Validacao

- [ ] `AgentEventSchema` aceita os 3 novos tipos sem erro Zod
- [ ] `AiAgentEvent` permite yield tipado dos novos tipos sem erro TypeScript
- [ ] `AiAgentOptions` aceita `reasoning: true` e `reasoning: { budgetTokens: N }`
- [ ] Loop `fullStream` emite `reasoning`, `tool-call`, `tool-result` como eventos discretos
- [ ] `providerOptions` ativado condicionalmente para extended thinking
- [ ] `proxy.ts` encaminha os 3 novos tipos ao backbone (gap RS-006 corrigido)
- [ ] `npm run build:packages` compila sem erros
- [ ] Stream SSE contém `tool-call` e `tool-result` ao provocar tool calls
- [ ] Backward compatible — clientes existentes sem quebra

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-169 Schemas Zod — 3 novos tipos | S-047 sec 2.1 | RS-001 |
| F-170 Tipos TypeScript — AiAgentEvent + reasoning | S-047 sec 2.2, 2.3 | RS-002, RS-003 |
| F-171 Emissão fullStream + providerOptions | S-048 sec 2.1, 2.2 | RS-004, RS-005 |
| F-172 Proxy passthrough | S-049 sec 3.1 | RS-006 (gap crítico) |
| F-173 Build + validação E2E | S-049 sec 4 | RS-007, RS-008 |
