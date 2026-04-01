# S-069 — Chat.tsx Componente Principal + Exports

Componente auto-suficiente `<Chat />` e barrel export final do pacote.

**Resolve:** AC-014 (Chat.tsx + index.ts exports ausentes)
**Score de prioridade:** 9
**Dependência:** S-057 (ChatProvider), S-068 (MessageBubble/List/Input), S-067 (registry)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `Chat.tsx` — componente auto-suficiente que compõe ChatProvider + MessageList + MessageInput
- Consumidor importa `<Chat endpoint={...} token={...} sessionId={...} />` e tem experiência completa
- Props opcionais para customização: `displayRenderers`, `placeholder`, `className`, `header`, `footer`
- Atualizar `index.ts` com todos os exports públicos do pacote

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/components/Chat.tsx` (NOVO)

```typescript
export interface ChatProps {
  endpoint: string;
  token: string;
  sessionId: string;
  displayRenderers?: DisplayRendererMap;
  placeholder?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Chat({
  endpoint, token, sessionId,
  displayRenderers, placeholder, header, footer, className
}: ChatProps) {
  return (
    <ChatProvider endpoint={endpoint} token={token} sessionId={sessionId}>
      <div className={clsx("ai-chat", className)}>
        {header}
        <ChatContent displayRenderers={displayRenderers} placeholder={placeholder} />
        {footer}
      </div>
    </ChatProvider>
  );
}
```

`ChatContent` é componente interno que consome `useChatContext()`:

```typescript
function ChatContent({ displayRenderers, placeholder }: { ... }) {
  const { messages, input, setInput, handleSubmit, isLoading, stop } = useChatContext();
  return (
    <>
      <MessageList messages={messages} isLoading={isLoading} displayRenderers={displayRenderers} />
      <MessageInput
        input={input} setInput={setInput} handleSubmit={handleSubmit}
        isLoading={isLoading} stop={stop} placeholder={placeholder}
      />
    </>
  );
}
```

### 2.2 Atualizar: `apps/packages/ai-chat/src/index.ts` (FINAL)

Export completo e organizado:

```typescript
// Componentes principais
export { Chat } from "./components/Chat.js";
export type { ChatProps } from "./components/Chat.js";

// Componentes de composição
export { MessageBubble } from "./components/MessageBubble.js";
export { MessageList } from "./components/MessageList.js";
export { MessageInput } from "./components/MessageInput.js";
export { Markdown } from "./components/Markdown.js";
export { StreamingIndicator } from "./components/StreamingIndicator.js";

// Parts
export { PartRenderer } from "./parts/PartRenderer.js";
export { ReasoningBlock } from "./parts/ReasoningBlock.js";
export { ToolActivity } from "./parts/ToolActivity.js";
export { ToolResult } from "./parts/ToolResult.js";

// Display renderers
export * from "./display/index.js";

// Registry
export { defaultDisplayRenderers, resolveDisplayRenderer } from "./display/registry.js";
export type { DisplayRendererMap } from "./display/registry.js";

// Hooks
export { ChatProvider, useChatContext } from "./hooks/ChatProvider.js";
export { useBackboneChat } from "./hooks/useBackboneChat.js";

// Tool icon map
export { defaultToolIconMap } from "./parts/ToolActivity.js";
```

---

## 3. Regras de Implementação

- **`<Chat />` é o entry point recomendado** — composição manual é para power users
- **Classe `.ai-chat`** no wrapper root — ativa CSS variables do styles.css
- **Header/footer slots** são opcionais — permitem branding customizado
- **ChatContent separado** — necessário porque hooks (useChatContext) só funcionam dentro do Provider
- **Exports organizados por categoria** — componentes, parts, display, hooks, types

---

## 4. Critérios de Aceite

- [ ] `<Chat endpoint token sessionId />` renderiza chat completo e funcional
- [ ] Props opcionais `displayRenderers`, `placeholder`, `header`, `footer` funcionam
- [ ] Classe `.ai-chat` está no wrapper root
- [ ] `index.ts` exporta todos os componentes, hooks, types e renderers
- [ ] Import `import { Chat } from "@agentic-backbone/ai-chat"` funciona
- [ ] Import `import "@agentic-backbone/ai-chat/styles.css"` funciona
- [ ] Typecheck passa
