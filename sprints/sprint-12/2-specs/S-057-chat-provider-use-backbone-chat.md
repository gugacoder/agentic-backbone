# S-057 — ChatProvider + useBackboneChat

Criar o provider React e hook customizado que encapsulam `useChat` do `@ai-sdk/react` com configuração backbone.

**Resolve:** AC-002 (ChatProvider.tsx + useBackboneChat.ts ausentes — GAP CRÍTICO)
**Score de prioridade:** 10
**Dependência:** S-056 (scaffold deve existir)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `ChatProvider.tsx` — context provider que recebe `endpoint`, `token`, `sessionId` e expõe estado do chat via context
- Criar `useBackboneChat.ts` — hook que configura `useChat` do `@ai-sdk/react` apontando para o backbone com `?format=datastream`
- O hook deve compor a URL completa: `${endpoint}/api/v1/ai/conversations/${sessionId}/messages?format=datastream`
- Injetar header `Authorization: Bearer ${token}` automaticamente
- Expor via context: `messages`, `input`, `setInput`, `handleSubmit`, `isLoading`, `stop`, `error`, `reload`

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/hooks/useBackboneChat.ts` (NOVO)

```typescript
import { useChat } from "@ai-sdk/react";

export interface UseBackboneChatOptions {
  endpoint: string;     // base URL do backbone (ex: "http://localhost:6002")
  token: string;        // JWT token
  sessionId: string;    // ID da sessão/conversa
  initialMessages?: Message[];
}

export function useBackboneChat(options: UseBackboneChatOptions) {
  return useChat({
    api: `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/messages?format=datastream`,
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
    initialMessages: options.initialMessages,
  });
}
```

### 2.2 Arquivo: `apps/packages/ai-chat/src/hooks/ChatProvider.tsx` (NOVO)

React context que:
1. Recebe `endpoint`, `token`, `sessionId` como props
2. Chama `useBackboneChat` internamente
3. Expõe o retorno via `ChatContext`
4. Exporta `useChatContext()` hook para consumo pelos componentes internos

```typescript
export interface ChatProviderProps {
  endpoint: string;
  token: string;
  sessionId: string;
  children: React.ReactNode;
}

export function ChatProvider({ endpoint, token, sessionId, children }: ChatProviderProps) {
  const chat = useBackboneChat({ endpoint, token, sessionId });
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
```

### 2.3 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `ChatProvider`, `useChatContext`, `useBackboneChat` e seus tipos.

---

## 3. Regras de Implementação

- **Não duplicar lógica do `useChat`** — apenas configurar e reexportar
- **URL é composta, não hardcoded** — endpoint vem das props
- **Token é injetado via headers** — não usar query param (segurança)
- **Tipos do `@ai-sdk/react`** devem ser reexportados (Message, etc.)

---

## 4. Critérios de Aceite

- [ ] `useBackboneChat` existe e chama `useChat` com URL correta incluindo `?format=datastream`
- [ ] `ChatProvider` existe como React context provider com props `endpoint`, `token`, `sessionId`
- [ ] `useChatContext()` retorna o estado do chat ou lança erro se fora do provider
- [ ] Header Authorization é injetado automaticamente
- [ ] Exports estão no `index.ts` do pacote
- [ ] Typecheck passa sem erros
