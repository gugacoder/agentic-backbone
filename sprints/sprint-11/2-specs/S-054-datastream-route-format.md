# S-054 — DataStream Route: ?format=datastream na Rota de Conversação

Adicionar suporte ao parâmetro `?format=datastream` na rota `POST /conversations/:sessionId/messages` para emitir eventos no formato Vercel DataStream, compatível com `useChat()`.

**Resolve:** RC-006 (conversations.ts não suporta ?format=datastream)
**Score de prioridade:** 8
**Dependência:** S-053 (encodeDataStreamEvent deve existir)
**PRP:** 14 — Rich Content

---

## 1. Objetivo

- Adicionar parâmetro query `format` na rota de envio de mensagens
- Quando `format=datastream`, usar `encodeDataStreamEvent()` para emitir eventos no protocolo Vercel DataStream
- Quando `format` é omitido ou diferente, manter comportamento atual (AgentEvent JSON) — backward compatible
- Apps usando `useChat()` do `ai/react` passam a consumir o stream nativamente

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/routes/conversations.ts`

Na rota `POST /conversations/:sessionId/messages`, ler o query param `format` e bifurcar a serialização:

```typescript
import { encodeDataStreamEvent } from "./datastream.js";

// Dentro do handler POST /conversations/:sessionId/messages:
const format = c.req.query("format");

if (format === "datastream") {
  return streamSSE(c, async (stream) => {
    for await (const event of sendMessage(auth.user, sessionId, message)) {
      const encoded = encodeDataStreamEvent(event);
      if (encoded) {
        await stream.writeSSE({ data: encoded });
      }
    }
  });
}

// Formato original (AgentEvent JSON) — sem mudança
return streamSSE(c, async (stream) => {
  for await (const event of sendMessage(auth.user, sessionId, message)) {
    await stream.writeSSE({ data: JSON.stringify(event) });
  }
});
```

**Regras:**
- O check `format === "datastream"` deve ser feito **antes** do stream existente
- O branch padrão (sem format ou format desconhecido) deve ser **idêntico** ao código atual — não refatorar o path existente
- Eventos onde `encodeDataStreamEvent()` retorna `null` são silenciosamente ignorados (não emitidos no SSE)
- Não alterar headers SSE — o formato DataStream usa o mesmo `text/event-stream`

---

## 3. Regras de Implementação

- **Backward compatible** — rota sem `?format` continua funcionando como antes
- **Não criar rota separada** — é o mesmo endpoint, apenas formato de saída diferente
- **Não adicionar validação de format** — valores desconhecidos caem no branch padrão (JSON)
- Verificar a estrutura atual da rota em `conversations.ts` antes de implementar — localizar o ponto exato de inserção

---

## 4. Critérios de Aceite

- [ ] `POST /conversations/:sessionId/messages?format=datastream` emite SSE no formato Vercel DataStream
- [ ] Eventos `text` aparecem como `0:"..."` no stream
- [ ] Eventos `tool-call` aparecem como `9:{...}` no stream
- [ ] Eventos `tool-result` aparecem como `a:{...}` no stream
- [ ] `POST /conversations/:sessionId/messages` (sem format) continua emitindo AgentEvent JSON — zero regressão
- [ ] Clientes existentes não são afetados pela mudança
- [ ] Typecheck passa: nenhum erro TypeScript no backbone
