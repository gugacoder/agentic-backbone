# Brainstorming — Sprint 8 | Wave 1

**Sprint:** 8 | **Wave:** 1 | **Data:** 2026-03-28

---

## Contexto

Sprint 8 é um sprint de **implementação**, não de pesquisa de mercado. A tarefa definida em `TASK.md` é o **PRP-13 — Rich Stream: Eventos Tipados no AgentEvent**.

### Objetivo do PRP-13

Enriquecer o stream de eventos do agente para emitir `reasoning`, `tool-call` e `tool-result` como eventos discretos — permitindo que clientes ricos (Hub, Chat PWA) renderizem timeline de atividades, pensamento retrátil e cards de ferramentas, enquanto canais pobres (WhatsApp) continuam recebendo texto plano.

### Escopo delimitado pelo PRP

O PRP define mudanças em 4 arquivos principais:
1. `apps/packages/ai-sdk/src/schemas.ts` — adicionar 3 tipos ao `AgentEventSchema`
2. `apps/packages/ai-sdk/src/types.ts` — adicionar 3 tipos ao `AiAgentEvent` + campo `reasoning` em `AiAgentOptions`
3. `apps/packages/ai-sdk/src/agent.ts` — modificar loop `fullStream` + adicionar `providerOptions` para reasoning
4. Build + teste SSE (validação)

O PRP declara que `stream-dispatcher.ts` e `conversations.ts` **não precisam de mudanças**. Isso foi verificado no código e está correto.

---

## Funcionalidades Mapeadas (Estado Atual do Código)

### `apps/packages/ai-sdk/src/schemas.ts`
- `AgentEventSchema` possui 5 tipos: `init`, `text`, `step_finish`, `result`, `usage`
- **Ausentes**: `reasoning`, `tool-call`, `tool-result`

### `apps/packages/ai-sdk/src/types.ts`
- `AiAgentEvent` possui 10 tipos: `init`, `mcp_connected`, `text`, `result`, `usage`, `ask_user`, `todo_update`, `context_status`, `step_finish`, `mcp_error`
- **Ausentes**: `reasoning`, `tool-call`, `tool-result`
- `AiAgentOptions` não tem campo `reasoning?: boolean | { budgetTokens: number }`

### `apps/packages/ai-sdk/src/agent.ts`
- Loop `fullStream` (linhas ~382-396) trata apenas `text-delta` e `finish-step`
- Eventos `reasoning`, `tool-call`, `tool-result` emitidos pelo Vercel AI SDK são **silenciosamente descartados**
- `streamText()` não passa `providerOptions` — reasoning nunca é ativado mesmo em modelos que o suportam

### `apps/packages/ai-sdk/src/proxy.ts` ⚠️ NÃO DOCUMENTADO NO PRP
- `runAgent()` (proxy) filtra **explicitamente** os eventos da camada interna
- Passa apenas: `init`, `text`, `result`, `usage`, `step_finish`
- Comentário atual: `// Other event types (mcp_connected, etc.) are silently dropped`
- **Qualquer novo tipo adicionado ao `AiAgentEvent` será descartado aqui** antes de chegar ao backbone

### `apps/backbone/src/agent/index.ts`
- Chama `runProxyAgent()` (que é o `runAgent()` do `proxy.ts`)
- O backbone nunca usa `runAiAgent()` diretamente em conversas — tudo passa pelo proxy

### `apps/backbone/src/channels/delivery/stream-dispatcher.ts`
- Bufferiza apenas `event.type === "text"`, despacha em `step_finish`/`result`
- Passa todos os eventos via `yield event` — não precisa de mudança

### `apps/backbone/src/routes/conversations.ts`
- Linha 211: `await stream.writeSSE({ data: JSON.stringify(event) })` — serializa qualquer `AgentEvent`
- Não precisa de mudança

---

## Lacunas e Oportunidades

### RS-001 — Gap: `AgentEventSchema` sem os 3 novos tipos
`schemas.ts` não declara `reasoning`, `tool-call`, `tool-result`. Sem isso, o TypeScript rejeita os novos eventos no boundary público (proxy → backbone) e clientes não têm contrato de tipo.

### RS-002 — Gap: `AiAgentEvent` sem os 3 novos tipos
`types.ts` não tem os novos tipos. O `agent.ts` não pode fazer yield tipado dos eventos sem essa declaração.

### RS-003 — Gap: `AiAgentOptions` sem campo `reasoning`
Sem o campo `reasoning?: boolean | { budgetTokens: number }`, o backbone não tem como ativar extended thinking por agente. O campo controla se `providerOptions.anthropic.thinking` é passado ao `streamText()`.

### RS-004 — Gap: Loop `fullStream` em `agent.ts` descarta eventos ricos
O `for await` na linha ~382 ignora `reasoning`, `tool-call`, `tool-result`. Mesmo que o Vercel AI SDK os emita (e emite), eles não chegam ao consumidor do generator.

### RS-005 — Gap: `streamText()` sem `providerOptions` para reasoning
Sem `providerOptions: { anthropic: { thinking: { type: "enabled", budgetTokens: N } } }`, modelos Claude com extended thinking não emitem eventos `reasoning`. A ativação é opt-in por agente via `AiAgentOptions.reasoning`.

### RS-006 — Gap CRÍTICO (não documentado no PRP): `proxy.ts` descarta todos os novos tipos
**Este é o gap mais impactante e estava ausente do PRP.** O `proxy.ts` tem um filtro explícito que só passa 5 tipos de evento. Qualquer novo tipo adicionado ao `AiAgentEvent` (em `types.ts`) e emitido em `agent.ts` chegará ao proxy e será silenciosamente descartado. O backbone e os clientes SSE **nunca verão** `reasoning`, `tool-call` ou `tool-result` sem que `proxy.ts` seja atualizado para passá-los.

**Fluxo real:**
```
agent.ts (yield reasoning/tool-call/tool-result)
  → proxy.ts runAgent()        ← AQUI OS EVENTOS SÃO DESCARTADOS
  → backbone/src/agent/index.ts
  → conversations/index.ts sendMessage()
  → routes/conversations.ts (SSE)
  → cliente
```

### RS-007 — Necessidade de build após mudanças no ai-sdk
O ai-sdk é um package compilado (`dist/`). Após qualquer mudança nos `.ts` de `apps/packages/ai-sdk/src/`, o comando `npm run build:packages` deve ser executado e o typecheck validado antes de testar via SSE.

### RS-008 — Teste manual de validação SSE
Após implementação e build, a rota `POST /conversations/:sessionId/messages` deve ser chamada e os eventos SSE inspecionados para confirmar que `reasoning`, `tool-call` e `tool-result` aparecem no stream. Isso fecha o ciclo de validação do PRP.

---

## Priorização — Score por Impacto e Dependência

| Score | ID | Item | Justificativa |
|-------|----|------|---------------|
| 10 | RS-006 | proxy.ts — passthrough de novos tipos | Gap crítico não documentado no PRP; bloqueia TUDO; sem essa fix nada chega ao cliente SSE |
| 9 | RS-001 | AgentEventSchema — adicionar 3 tipos | Prerequisite de todos os outros; define o contrato público de tipos |
| 9 | RS-002 | AiAgentEvent — adicionar 3 tipos | Prerequisite do loop fullStream; sem isso o yield é inválido |
| 9 | RS-004 | Loop fullStream — emitir eventos ricos | Core da implementação; sem isso nenhum evento rico é gerado |
| 8 | RS-003 | AiAgentOptions — campo reasoning | Necessário para ativação de extended thinking; não bloqueia tool-call/tool-result |
| 8 | RS-007 | Build ai-sdk após mudanças | Necessário antes de qualquer teste; sem build os tipos novos não estão em dist/ |
| 7 | RS-005 | streamText — providerOptions reasoning | Complementa RS-003; apenas para modelos com extended thinking |
| 7 | RS-008 | Teste manual SSE — validação final | Encerra ciclo de validação do PRP; confirma funcionamento end-to-end |

### Ordem lógica de execução

```
Fase 1 (paralelo): RS-001, RS-002, RS-003
Fase 2 (depende de 1): RS-004 (fullStream), RS-005 (providerOptions), RS-006 (proxy.ts)
Fase 3 (depende de 2): RS-007 (build)
Fase 4 (depende de 3): RS-008 (teste SSE)
```

---

## Consistência do PRP-13

### O que está correto no PRP

- Identificação dos 3 novos tipos (`reasoning`, `tool-call`, `tool-result`)
- Campos exatos seguindo o Vercel AI SDK (`toolCallId`, `toolName`, `args`, `result`)
- Identificação de que `stream-dispatcher.ts` não precisa de mudança (bufferiza apenas `text`)
- Identificação de que `conversations.ts` não precisa de mudança (serializa qualquer AgentEvent)
- Decisão de não persistir eventos ricos no `messages.jsonl` (correto: duplicaria dados já salvos pelo Vercel AI SDK)
- Campo `reasoning?: boolean | { budgetTokens: number }` em `AiAgentOptions`

### Gap identificado (ausente do PRP)

**`proxy.ts` precisa ser atualizado** — o PRP não menciona `apps/packages/ai-sdk/src/proxy.ts`, mas este arquivo filtra explicitamente os eventos e descartará os novos tipos sem a devida atualização.

A correção necessária é adicionar três `else if` ao filtro de eventos em `runAgent()`:
```typescript
} else if (event.type === "reasoning") {
  yield { type: "reasoning", content: event.content };
} else if (event.type === "tool-call") {
  yield { type: "tool-call", toolCallId: event.toolCallId, toolName: event.toolName, args: event.args };
} else if (event.type === "tool-result") {
  yield { type: "tool-result", toolCallId: event.toolCallId, toolName: event.toolName, result: event.result };
}
```

---

*Sprint 8 — implementação de PRP-13 (Rich Stream). Backlog de produto (Sprints 1-7: 142 discoveries) mantido em ranking.json.*
