# PRP-15D — Composicao: PartRenderer, MessageBubble e Chat

Criar o switch central que roteia parts para componentes, os componentes UI principais do chat (bubble, list, input) e o componente auto-suficiente `<Chat />`.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Os componentes individuais existem (PRP-15A: Markdown, StreamingIndicator; PRP-15B: ReasoningBlock, ToolActivity, ToolResult; PRP-15C: 19 display renderers + registry), mas:

- Nao existe switch central que mapeia `part.type → componente React`
- MessageBubble do Hub nao itera `message.parts` — renderiza apenas markdown plano
- Nao existe componente `<Chat />` auto-suficiente que o consumidor possa usar com 3 props

### Estado desejado

1. `PartRenderer` — switch que roteia `text → Markdown`, `reasoning → ReasoningBlock`, `tool-invocation → ToolActivity/ToolResult/DisplayRenderer`
2. `MessageBubble` — bolha que itera `message.parts` via PartRenderer
3. `MessageList` — lista com auto-scroll inteligente
4. `MessageInput` — textarea auto-expand com Enter/Shift+Enter e abort
5. `Chat` — componente auto-suficiente `<Chat endpoint token sessionId />`
6. `index.ts` final com todos os exports organizados por categoria

### Dependencias

- **PRP-15A** — ChatProvider, useChatContext, Markdown, StreamingIndicator, styles.css
- **PRP-15B** — ReasoningBlock, ToolActivity, ToolResult
- **PRP-15C** — 19 display renderers + registry (defaultDisplayRenderers, resolveDisplayRenderer)

## Especificacao

### Feature F-191: PartRenderer

**Spec:** S-066

Criar `apps/packages/ai-chat/src/parts/PartRenderer.tsx`:

```typescript
export interface PartRendererProps {
  part: MessagePart;  // tipo do @ai-sdk/react
  isStreaming?: boolean;
  displayRenderers?: DisplayRendererMap;
}
```

Logica de switch:

```typescript
switch (part.type) {
  case "text":
    return <Markdown content={part.text} />;

  case "reasoning":
    return <ReasoningBlock content={part.reasoning} isStreaming={isStreaming} />;

  case "tool-invocation": {
    const isDisplay = part.toolInvocation.toolName.startsWith("display_");

    if (isDisplay && part.toolInvocation.state === "result") {
      const Renderer = resolveDisplayRenderer(part.toolInvocation.toolName, displayRenderers);
      if (Renderer) return <Renderer {...part.toolInvocation.result} />;
    }

    if (part.toolInvocation.state === "result") {
      return <ToolResult toolName={part.toolInvocation.toolName} result={part.toolInvocation.result} />;
    }

    return <ToolActivity toolName={part.toolInvocation.toolName} state={part.toolInvocation.state} />;
  }

  default:
    return null;
}
```

#### Regras

- Display tools identificadas pelo prefixo `display_` — consistente com registry ai-sdk
- Override via prop `displayRenderers` (prioridade) → `defaultDisplayRenderers` (fallback)
- Fallback graceful — se renderer nao encontrado, retorna null
- ToolActivity durante `call`/`partial-call`, ToolResult no `result` — nunca ambos
- Puramente funcional — sem estado interno

### Feature F-192: MessageBubble, MessageList e MessageInput

**Spec:** S-068

**`src/components/MessageBubble.tsx`:**

```typescript
export interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  displayRenderers?: DisplayRendererMap;
  className?: string;
}
```

- Role styling: `user` → direita, cor accent. `assistant` → esquerda, cor muted
- Itera `message.parts` renderizando via `<PartRenderer />`
- Fallback: se `parts` ausente/vazio, renderiza `message.content` via `<Markdown />`
- Streaming: se `isStreaming && role === "assistant"`, append `<StreamingIndicator />`
- Timestamp opcional via `Intl.DateTimeFormat`

**`src/components/MessageList.tsx`:**

```typescript
export interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  displayRenderers?: DisplayRendererMap;
  className?: string;
}
```

- Auto-scroll to bottom em nova mensagem, MAS nao forca se usuario scrollou para cima (threshold: 100px)
- Container com `overflow-y: auto`
- Ultima mensagem assistant recebe `isStreaming={isLoading}`
- Empty state: "Envie uma mensagem para comecar"
- Scroll anchor no final

**`src/components/MessageInput.tsx`:**

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

- Textarea auto-expand (min 1 row, max 6 rows)
- Enter envia, Shift+Enter nova linha
- Botao enviar (Send) — disabled quando input vazio ou loading
- Botao abort (Square) durante loading — chama `stop()`
- Focus automatico ao montar

#### Regras

- Consome `useChatContext` quando possivel, mas aceita props diretas para uso standalone
- Auto-scroll via `useEffect` + `scrollIntoView({ behavior: "smooth" })` com guard
- Auto-expand textarea via `useEffect` observando input e ajustando `style.height`
- CSS classes `.ai-chat-bubble-*`, `.ai-chat-list-*`, `.ai-chat-input-*`
- Sem deps externas — React, lucide-react, componentes internos

### Feature F-193: Chat.tsx + Exports Finais

**Spec:** S-069

**`src/components/Chat.tsx`:**

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

export function Chat({ endpoint, token, sessionId, displayRenderers, placeholder, header, footer, className }: ChatProps) {
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

`ChatContent` eh componente interno que consome `useChatContext()`:

```typescript
function ChatContent({ displayRenderers, placeholder }) {
  const { messages, input, setInput, handleSubmit, isLoading, stop } = useChatContext();
  return (
    <>
      <MessageList messages={messages} isLoading={isLoading} displayRenderers={displayRenderers} />
      <MessageInput input={input} setInput={setInput} handleSubmit={handleSubmit}
        isLoading={isLoading} stop={stop} placeholder={placeholder} />
    </>
  );
}
```

**`src/index.ts` (FINAL):**

```typescript
// Componentes principais
export { Chat, type ChatProps } from "./components/Chat.js";

// Componentes de composicao
export { MessageBubble } from "./components/MessageBubble.js";
export { MessageList } from "./components/MessageList.js";
export { MessageInput } from "./components/MessageInput.js";
export { Markdown } from "./components/Markdown.js";
export { StreamingIndicator } from "./components/StreamingIndicator.js";

// Parts
export { PartRenderer } from "./parts/PartRenderer.js";
export { ReasoningBlock } from "./parts/ReasoningBlock.js";
export { ToolActivity, defaultToolIconMap } from "./parts/ToolActivity.js";
export { ToolResult } from "./parts/ToolResult.js";

// Display renderers
export * from "./display/index.js";

// Registry
export { defaultDisplayRenderers, resolveDisplayRenderer, type DisplayRendererMap } from "./display/registry.js";

// Hooks
export { ChatProvider, useChatContext } from "./hooks/ChatProvider.js";
export { useBackboneChat } from "./hooks/useBackboneChat.js";
```

#### Regras

- `<Chat />` eh o entry point recomendado — composicao manual para power users
- Classe `.ai-chat` no wrapper root — ativa CSS variables
- Header/footer slots opcionais para branding customizado
- ChatContent separado porque hooks so funcionam dentro do Provider
- Exports organizados por categoria

## Limites

- **NAO** incluir logica de negocio do Hub (takeover, feedback, sidebar) — isso fica no Hub
- **NAO** fazer fetch de sessoes ou mensagens historicas — o hook `useChat` gerencia
- **NAO** criar rotas ou navegacao — pacote eh de componentes, nao de app
- **NAO** instalar deps adicionais — usar apenas o que ja esta no package.json do scaffold

## Validacao

- [ ] `PartRenderer` renderiza corretamente parts `text`, `reasoning`, `tool-invocation`
- [ ] Display tools (prefixo `display_`) resolvem para o renderer correto
- [ ] Renderers de display overridable via prop `displayRenderers`
- [ ] Tool calls funcionais mostram ToolActivity durante call, ToolResult no result
- [ ] Parts desconhecidos retornam null sem quebrar a UI
- [ ] MessageBubble itera `message.parts` via PartRenderer
- [ ] MessageBubble diferencia visualmente user vs assistant
- [ ] MessageBubble faz fallback para `message.content` quando parts ausente
- [ ] MessageList tem auto-scroll inteligente
- [ ] MessageList marca ultima mensagem assistant como streaming quando `isLoading`
- [ ] MessageInput suporta Enter para enviar, Shift+Enter para nova linha
- [ ] MessageInput auto-expande ate 6 linhas
- [ ] Botao abort visivel durante loading
- [ ] `<Chat endpoint token sessionId />` renderiza chat completo e funcional
- [ ] Props opcionais `displayRenderers`, `placeholder`, `header`, `footer` funcionam
- [ ] Classe `.ai-chat` no wrapper root
- [ ] `index.ts` exporta todos os componentes, hooks, types e renderers
- [ ] `import { Chat } from "@agentic-backbone/ai-chat"` funciona
- [ ] `import "@agentic-backbone/ai-chat/styles.css"` funciona
- [ ] Typecheck passa

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-191 PartRenderer | S-066 | AC-011 |
| F-192 MessageBubble + MessageList + MessageInput | S-068 | AC-013 |
| F-193 Chat.tsx + Exports Finais | S-069 | AC-014 |
