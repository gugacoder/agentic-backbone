# S-068 — MessageBubble, MessageList e MessageInput

Componentes UI principais do chat portáveis que substituem os equivalentes acoplados do Hub.

**Resolve:** AC-013 (MessageBubble/List/Input portáveis ausentes)
**Score de prioridade:** 9
**Dependência:** S-057 (ChatProvider/useChatContext), S-058 (Markdown, StreamingIndicator), S-066 (PartRenderer)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `MessageBubble.tsx` — bolha de mensagem que itera `message.parts` via PartRenderer
- Criar `MessageList.tsx` — lista de mensagens com auto-scroll inteligente
- Criar `MessageInput.tsx` — input de texto com auto-expand, envio via Enter, Shift+Enter para nova linha, botão abort

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/components/MessageBubble.tsx` (NOVO)

```typescript
export interface MessageBubbleProps {
  message: Message;  // tipo do @ai-sdk/react
  isStreaming?: boolean;
  displayRenderers?: DisplayRendererMap;
  className?: string;
}
```

Comportamento:
- **Role styling:** `user` → alinhado à direita, cor accent. `assistant` → alinhado à esquerda, cor muted
- **Itera `message.parts`** — renderiza cada part via `<PartRenderer />`
- **Fallback content:** se `parts` ausente/vazio, renderiza `message.content` via `<Markdown />`
- **Streaming indicator:** se `isStreaming && role === "assistant"`, append `<StreamingIndicator />`
- **Timestamp** opcional (formatado via `Intl.DateTimeFormat`)

### 2.2 Arquivo: `apps/packages/ai-chat/src/components/MessageList.tsx` (NOVO)

```typescript
export interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  displayRenderers?: DisplayRendererMap;
  className?: string;
}
```

Comportamento:
- **Auto-scroll:** scroll to bottom quando nova mensagem chega, MAS não forçar se usuário scrollou para cima (threshold: 100px do bottom)
- **Ref** para container com `overflow-y: auto`
- **Última mensagem assistant** recebe `isStreaming={isLoading}`
- **Empty state:** mensagem "Envie uma mensagem para começar" quando lista vazia
- **Scroll anchor** no final da lista

### 2.3 Arquivo: `apps/packages/ai-chat/src/components/MessageInput.tsx` (NOVO)

```typescript
export interface MessageInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  stop?: () => void;
  placeholder?: string;
  className?: string;
}
```

Comportamento:
- **Textarea** com auto-expand (min 1 row, max 6 rows)
- **Enter** envia mensagem, **Shift+Enter** nova linha
- **Botão enviar** (Send icon) à direita — disabled quando input vazio ou loading
- **Botão abort** (Square icon) aparece durante loading, chama `stop()`
- **Focus** automático ao montar

### 2.4 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `MessageBubble`, `MessageList`, `MessageInput` e seus tipos.

---

## 3. Regras de Implementação

- **Consome `useChatContext` quando possível**, mas aceita props diretas para uso standalone
- **Auto-scroll** via `useEffect` + `scrollIntoView({ behavior: "smooth" })` com guard de scroll position
- **Auto-expand** do textarea via `useEffect` observando `input.length` e ajustando `style.height`
- **CSS classes** `.ai-chat-bubble-*`, `.ai-chat-list-*`, `.ai-chat-input-*`
- **Sem dependências externas** — apenas React, lucide-react, componentes internos

---

## 4. Critérios de Aceite

- [ ] MessageBubble itera `message.parts` via PartRenderer
- [ ] MessageBubble diferencia visualmente user vs assistant
- [ ] MessageBubble faz fallback para `message.content` quando parts ausente
- [ ] MessageList tem auto-scroll inteligente (não força quando usuário scrollou para cima)
- [ ] MessageList marca última mensagem assistant como streaming quando `isLoading`
- [ ] MessageInput suporta Enter para enviar, Shift+Enter para nova linha
- [ ] MessageInput auto-expande até 6 linhas
- [ ] Botão abort visível durante loading, chama `stop()`
- [ ] Exports no `index.ts`
