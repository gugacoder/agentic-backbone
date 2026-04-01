# S-049 — Rich Stream: Proxy Passthrough e Validação End-to-End

Atualizar o filtro de eventos em `proxy.ts` para encaminhar `reasoning`, `tool-call` e `tool-result` ao backbone, e validar o fluxo end-to-end via build e teste SSE.

**Resolve:** RS-006 (proxy.ts descarta novos tipos — GAP CRÍTICO), RS-007 (build obrigatório), RS-008 (validação SSE)
**Score de prioridade:** 10
**Dependência:** S-047 (schemas/tipos), S-048 (emissão no fullStream)
**PRP:** 13 — Rich Stream

---

## 1. Objetivo

- Corrigir o filtro explícito em `proxy.ts` que descarta silenciosamente todos os tipos de evento além de `init`, `text`, `result`, `usage`, `step_finish`
- Garantir que `reasoning`, `tool-call` e `tool-result` emitidos por `agent.ts` cheguem ao backbone e ao SSE do cliente
- Build do ai-sdk após todas as mudanças (S-047 + S-048 + S-049)
- Validação end-to-end: confirmar que os novos eventos aparecem no stream SSE

---

## 2. Contexto do Gap

O `proxy.ts` contém a função `runAgent()` que atua como intermediário entre `runAiAgent()` (agent.ts) e o backbone. Esta função itera sobre os eventos do generator interno e **só repassa 5 tipos explícitos**:

```
agent.ts (yield reasoning/tool-call/tool-result)
  → proxy.ts runAgent()        ← EVENTOS DESCARTADOS AQUI
  → backbone/src/agent/index.ts
  → conversations/index.ts sendMessage()
  → routes/conversations.ts (SSE)
  → cliente
```

**Este é o bloqueador absoluto**: sem esta correção, toda a implementação de S-047 e S-048 é invisível ao cliente SSE. O backbone **nunca** usa `runAiAgent()` diretamente — tudo passa pelo proxy.

---

## 3. Alterações

### 3.1 Arquivo: `apps/packages/ai-sdk/src/proxy.ts`

No filtro de eventos de `runAgent()`, adicionar passthrough para os 3 novos tipos:

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

**Alternativa recomendada**: se o filtro for um allowlist (switch/case ou if-chain com tipos explícitos), considerar inverter para denylist — i.e., passar todos os tipos por default e só filtrar os que precisam de tratamento especial. Isso evita que futuros tipos adicionados ao `AiAgentEvent` sejam silenciosamente descartados.

Decisão de implementação: o agente coder deve avaliar a estrutura atual do filtro e escolher a abordagem que minimize risco de regressão futura.

---

## 4. Build e Validação

### 4.1 Build do ai-sdk

Após aplicar todas as mudanças (S-047, S-048, S-049):

```bash
npm run build:packages
```

O backbone consome `dist/` compilado. Sem rebuild, os novos tipos e handlers não estão disponíveis em runtime.

### 4.2 Validação SSE End-to-End

Após build bem-sucedido, validar o fluxo completo:

1. Iniciar o backbone (`npm run dev:all`)
2. Obter token JWT via `POST /api/v1/ai/auth/login`
3. Enviar mensagem que provoque tool calls via `POST /api/v1/ai/conversations/:sessionId/messages`
4. Inspecionar o stream SSE e confirmar presença de:
   - Evento `{ "type": "tool-call", "toolCallId": "...", "toolName": "...", "args": {...} }`
   - Evento `{ "type": "tool-result", "toolCallId": "...", "toolName": "...", "result": ... }`
5. (Opcional) Se reasoning estiver habilitado para o agente, confirmar evento `{ "type": "reasoning", "content": "..." }`

---

## 5. Fluxo Completo Após Implementação

```
agent.ts (yield reasoning/tool-call/tool-result)   ← S-048
  → proxy.ts runAgent()                             ← S-049 (passthrough)
  → backbone/src/agent/index.ts
  → conversations/index.ts sendMessage()
  → routes/conversations.ts (SSE writeSSE)
  → cliente (EventSource)
```

Nenhum arquivo do backbone precisa de mudança — `stream-dispatcher.ts` e `conversations.ts` já passam eventos genéricos.

---

## 6. Critérios de Aceite

- [ ] `proxy.ts` encaminha eventos `reasoning` do generator interno para o consumidor externo
- [ ] `proxy.ts` encaminha eventos `tool-call` com `toolCallId`, `toolName` e `args` intactos
- [ ] `proxy.ts` encaminha eventos `tool-result` com `toolCallId`, `toolName` e `result` intactos
- [ ] Eventos `init`, `text`, `result`, `usage`, `step_finish` continuam sendo encaminhados como antes — zero regressão
- [ ] `npm run build:packages` compila sem erros após todas as mudanças
- [ ] Typecheck passa: nenhum erro TypeScript no ai-sdk
- [ ] (Validação) Stream SSE contém eventos `tool-call` e `tool-result` ao enviar mensagem que provoca tool calls
- [ ] (Validação) Clientes existentes que só tratam `text`/`result` continuam funcionando sem quebra
