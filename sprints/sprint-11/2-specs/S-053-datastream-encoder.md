# S-053 — DataStream Encoder: encodeDataStreamEvent()

Criar a função `encodeDataStreamEvent()` que traduz `AgentEvent` para o protocolo Vercel DataStream (prefixos `0:`, `9:`, `a:`, `e:`, `d:`, `g:`), habilitando compatibilidade com `useChat()` do `ai/react`.

**Resolve:** RC-005 (routes/datastream.ts não existe)
**Score de prioridade:** 9
**Dependência:** PRP-13 (Rich Stream — já implementado)
**PRP:** 14 — Rich Content

---

## 1. Objetivo

- Criar `apps/backbone/src/routes/datastream.ts` com a função `encodeDataStreamEvent()`
- Mapear cada tipo de `AgentEvent` para o prefixo correto do protocolo Vercel DataStream
- Eventos sem representação no DataStream retornam `null` (são ignorados)
- Habilitar que a rota de conversação (S-054) ofereça formato alternativo para clientes `useChat()`

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/routes/datastream.ts` (NOVO)

```typescript
import type { AgentEvent } from "../agent/types.js";

/**
 * Traduz AgentEvent para o protocolo Vercel AI SDK DataStream.
 * Retorna string formatada com prefixo ou null se o evento não tem representação.
 *
 * Prefixos DataStream:
 *   0: — text delta
 *   9: — tool call
 *   a: — tool result
 *   e: — step finish (finish reason)
 *   d: — done (usage + finish reason)
 *   g: — reasoning
 */
export function encodeDataStreamEvent(event: AgentEvent): string | null {
  switch (event.type) {
    case "text":
      return `0:${JSON.stringify(event.content)}`;
    case "reasoning":
      return `g:${JSON.stringify(event.content)}`;
    case "tool-call":
      return `9:${JSON.stringify({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      })}`;
    case "tool-result":
      return `a:${JSON.stringify({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
      })}`;
    case "step_finish":
      return `e:${JSON.stringify({ finishReason: "stop" })}`;
    case "usage":
      return `d:${JSON.stringify({
        finishReason: "stop",
        usage: {
          promptTokens: event.usage.inputTokens,
          completionTokens: event.usage.outputTokens,
        },
      })}`;
    case "init":
      return null;
    case "result":
      return null;
    default:
      return null;
  }
}
```

---

## 3. Regras de Implementação

- **Função pura, sem side effects** — recebe evento, retorna string ou null
- **Prefixos devem ser exatamente os do protocolo Vercel DataStream** — `0:`, `9:`, `a:`, `e:`, `d:`, `g:`
- **Mapeamento de campos `usage`**: `inputTokens` → `promptTokens`, `outputTokens` → `completionTokens` (convenção Vercel)
- **Eventos `init` e `result`** retornam `null` — `init` não tem equivalente no DataStream; `result` já está coberto pelos text deltas
- **Default** retorna `null` — tipos desconhecidos ou futuros são ignorados silenciosamente (forward compatible)
- Verificar os nomes exatos dos campos de `AgentEvent` no código atual (`apps/backbone/src/agent/types.ts` ou equivalente) antes de implementar

---

## 4. Critérios de Aceite

- [ ] Arquivo `apps/backbone/src/routes/datastream.ts` existe com `encodeDataStreamEvent()` exportada
- [ ] Evento `text` → prefixo `0:` com content JSON-stringified
- [ ] Evento `reasoning` → prefixo `g:` com content JSON-stringified
- [ ] Evento `tool-call` → prefixo `9:` com toolCallId, toolName, args
- [ ] Evento `tool-result` → prefixo `a:` com toolCallId, toolName, result
- [ ] Evento `step_finish` → prefixo `e:` com finishReason "stop"
- [ ] Evento `usage` → prefixo `d:` com usage mapeado para convenção Vercel
- [ ] Eventos `init` e `result` → `null`
- [ ] Typecheck passa: nenhum erro TypeScript no backbone
