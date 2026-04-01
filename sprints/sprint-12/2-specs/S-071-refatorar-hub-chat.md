# S-071 — Refatorar Hub para Usar ai-chat

Refatorar `conversation-chat.tsx` no Hub para usar `<Chat />` do pacote ai-chat e remover componentes redundantes.

**Resolve:** AC-016 (Hub não usa o pacote ai-chat)
**Score de prioridade:** 8
**Dependência:** S-069 (Chat.tsx), S-070 (workspace install)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Substituir a stack de chat manual do Hub (`chat-stream.ts` + componentes acoplados) por `<Chat />` do pacote ai-chat
- `conversation-chat.tsx` se torna um wrapper fino que gerencia lógica de negócio do Hub (header, takeover, feedback) e delega renderização de chat ao pacote
- Remover arquivos redundantes do Hub após migração
- Importar `@agentic-backbone/ai-chat/styles.css` no entry point do Hub

---

## 2. Alterações

### 2.1 Modificar: `apps/hub/src/components/conversations/conversation-chat.tsx`

Antes (simplificado):
```typescript
import { MessageBubble } from "../chat/message-bubble";
import { MessageList } from "../chat/message-list";
import { MessageInput } from "../chat/message-input";
import { useChatStream } from "../../lib/chat-stream";
```

Depois:
```typescript
import { Chat } from "@agentic-backbone/ai-chat";
import "@agentic-backbone/ai-chat/styles.css";
```

O componente mantém:
- Header com info da sessão, botão takeover, breadcrumbs
- Feedback buttons (like/dislike)
- Lógica de seleção de sessão e navegação

E delega ao `<Chat />`:
```typescript
<Chat
  endpoint={backboneUrl}
  token={authToken}
  sessionId={selectedSessionId}
  className="flex-1"
/>
```

### 2.2 Remover arquivos redundantes do Hub

Após migração comprovada, remover:
- `apps/hub/src/components/chat/message-bubble.tsx`
- `apps/hub/src/components/chat/message-list.tsx`
- `apps/hub/src/components/chat/message-input.tsx`
- `apps/hub/src/components/chat/streaming-indicator.tsx`
- `apps/hub/src/lib/chat-stream.ts`

### 2.3 Importar CSS no entry point

Adicionar `import "@agentic-backbone/ai-chat/styles.css"` em `apps/hub/src/main.tsx` ou no componente raiz.

---

## 3. Regras de Implementação

- **Não remover lógica de negócio** — header, takeover, feedback permanecem em conversation-chat.tsx
- **Remover arquivos SOMENTE após validação** de que o Chat funciona no Hub
- **`conversations-layout.tsx` não é afetado** — sidebar e navegação ficam no Hub
- **Manter backward compatibility de rotas** — URLs não mudam
- **CSS do ai-chat não deve conflitar** com Tailwind do Hub — namespace `.ai-chat` garante isolamento

---

## 4. Critérios de Aceite

- [ ] `conversation-chat.tsx` usa `<Chat />` do pacote ai-chat
- [ ] Chat funciona: enviar mensagem, receber resposta com streaming, exibir parts tipados
- [ ] Header, takeover e feedback do Hub continuam funcionando
- [ ] 5 arquivos redundantes removidos do Hub
- [ ] `import "@agentic-backbone/ai-chat/styles.css"` presente no entry point
- [ ] Typecheck passa em `apps/hub`
- [ ] Build do Hub completa sem erros
