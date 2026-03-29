# PRP-16B — Core do Chat com shadcn/ui

Reescrever os 6 componentes core do chat para usar componentes shadcn internos e tokens Tailwind semanticos, eliminando todas as classes `ai-chat-*`.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Os 6 componentes core (`Chat`, `MessageList`, `MessageBubble`, `MessageInput`, `Markdown`, `StreamingIndicator`) usam classes CSS BEM (`ai-chat-*`) e dependem do `styles.css` para estilizacao. Todas as cores sao definidas via CSS variables proprias `--ai-chat-*` com valores HSL hardcoded — ignorando o tema shadcn do host.

### Estado desejado

1. Todos os 6 componentes usam tokens Tailwind semanticos do shadcn (`bg-primary`, `text-foreground`, `bg-muted`, etc.)
2. `MessageList` usa `ScrollArea` do shadcn
3. `MessageInput` usa `Button` do shadcn
4. `Markdown` aplica estilos via `components` override do react-markdown com tokens shadcn
5. Zero classe `ai-chat-*`, zero CSS variable propria, zero cor hardcoded
6. API publica (props, exports) identica

### Dependencias

- **PRP-16A** — `src/ui/` e `src/lib/utils.ts` devem existir

## Especificacao

### Feature F-203: Chat.tsx

**Spec:** S-074

Substituir classe `ai-chat` por tokens Tailwind:

```tsx
// Antes
<div className={["ai-chat", className].filter(Boolean).join(" ")}>

// Depois
import { cn } from "../lib/utils";
<div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
```

- Remover qualquer import de `styles.css`
- Substituir `clsx` por `cn`
- Manter `ChatProvider` wrapper e toda a logica intacta

#### Regras

- Manter API publica identica
- Zero import de `styles.css`

### Feature F-204: MessageList.tsx

**Spec:** S-074

Substituir `<div className="ai-chat-list">` por `ScrollArea` do shadcn:

```tsx
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../lib/utils";

<ScrollArea className={cn("flex-1", className)}>
  <div className="flex flex-col gap-3 p-4">
    {messages.length === 0 ? (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Envie uma mensagem para comecar
      </div>
    ) : (
      messages.map(...)
    )}
  </div>
</ScrollArea>
```

#### Regras

- Manter logica de auto-scroll inteligente (threshold 100px do bottom)
- Manter `isStreaming` na ultima mensagem assistant

### Feature F-205: MessageBubble.tsx

**Spec:** S-074

Substituir classes `ai-chat-bubble-*` por tokens shadcn:

```tsx
// User bubble
<div className="flex w-full justify-end">
  <div className={cn("inline-block max-w-[80%] rounded-lg rounded-br-sm px-4 py-2.5 bg-primary text-primary-foreground", className)}>
    ...
  </div>
</div>

// Assistant bubble
<div className="flex w-full justify-start">
  <div className={cn("inline-block max-w-[80%] rounded-lg rounded-bl-sm px-4 py-2.5 bg-muted text-foreground", className)}>
    ...
  </div>
</div>
```

#### Regras

- User: `bg-primary text-primary-foreground`
- Assistant: `bg-muted text-foreground`
- Manter iteracao de `message.parts` via `PartRenderer`
- Manter fallback para `message.content` via `Markdown`

### Feature F-206: MessageInput.tsx

**Spec:** S-074

Substituir classes `ai-chat-input-*` por `Button` do shadcn:

```tsx
import { Button } from "../ui/button";
import { cn } from "../lib/utils";

<div className={cn("flex items-end gap-3 rounded-xl border border-input bg-background p-2", className)}>
  <textarea
    className="flex-1 bg-transparent border-none text-foreground text-sm resize-none outline-none placeholder:text-muted-foreground"
    ...
  />
  {isLoading && stop ? (
    <Button size="icon" variant="destructive" onClick={stop} aria-label="Parar geracao">
      <Square className="h-4 w-4" />
    </Button>
  ) : (
    <Button size="icon" onClick={handleSubmit} disabled={!input.trim() || !!isLoading} aria-label="Enviar mensagem">
      <Send className="h-4 w-4" />
    </Button>
  )}
</div>
```

#### Regras

- Manter auto-expand (min 1 row, max 6 rows)
- Manter Enter para enviar, Shift+Enter para nova linha
- Manter focus automatico ao montar

### Feature F-207: Markdown.tsx

**Spec:** S-074

Substituir classes `ai-chat-markdown`, `ai-chat-code-block`, `ai-chat-inline-code` por tokens Tailwind nos `components` override do react-markdown:

```tsx
const components: Components = {
  pre: ({ children }) => (
    <pre className="bg-muted border border-border rounded-md my-3 overflow-hidden">{children}</pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className={cn("block p-4 overflow-x-auto font-mono text-sm", className)} {...props}>{children}</code>;
    }
    return <code className="bg-muted border border-border rounded-sm px-1.5 py-0.5 font-mono text-sm" {...props}>{children}</code>;
  },
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="text-primary underline underline-offset-2 hover:opacity-80" {...props}>{children}</a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-border my-3 py-1 px-3 text-muted-foreground">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-border px-3 py-1.5 text-left font-semibold bg-muted" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-3 py-1.5 text-left" {...props}>{children}</td>
  ),
};
```

Container:
```tsx
<div className={cn(
  "text-foreground text-sm leading-relaxed",
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base",
  "[&_h1,&_h2,&_h3,&_h4]:font-semibold [&_h1,&_h2,&_h3,&_h4]:mt-5 [&_h1,&_h2,&_h3,&_h4]:mb-2",
  "[&_ul,&_ol]:pl-6 [&_ul,&_ol]:my-2 [&_li]:my-1",
  "[&_hr]:border-border [&_hr]:my-4",
  className
)}>
  <ReactMarkdown ...>{children}</ReactMarkdown>
</div>
```

#### Regras

- NAO usar `@tailwindcss/typography` (prose)
- Manter `remark-gfm` e `rehype-highlight`

### Feature F-208: StreamingIndicator.tsx

**Spec:** S-074

Substituir animacao CSS `ai-chat-blink` por `animate-pulse` do Tailwind:

```tsx
<span className="inline-block w-2 h-4 align-text-bottom bg-current animate-pulse">|</span>
```

- `animate-pulse` substitui a animacao CSS customizada
- `bg-current` herda a cor do texto pai

## Limites

- **NAO** alterar hooks (`useBackboneChat`, `ChatProvider`) — sao logica pura
- **NAO** alterar `PartRenderer` — eh roteamento puro
- **NAO** deletar `styles.css` — sera feito no PRP-16F
- **NAO** adicionar `@tailwindcss/typography`

## Validacao

- [ ] Chat.tsx usa `bg-background text-foreground` — zero classe `ai-chat`
- [ ] MessageList.tsx usa `ScrollArea` do shadcn — zero classe `ai-chat-list`
- [ ] MessageBubble.tsx usa `bg-primary`/`bg-muted` para user/assistant — zero classe `ai-chat-bubble`
- [ ] MessageInput.tsx usa `Button` do shadcn — zero classe `ai-chat-input`
- [ ] Markdown.tsx usa tokens Tailwind nos components override — zero classe `ai-chat-markdown`
- [ ] StreamingIndicator.tsx usa `animate-pulse` — zero animacao CSS customizada
- [ ] Auto-scroll inteligente no MessageList funciona
- [ ] Auto-expand do textarea no MessageInput funciona (1-6 rows)
- [ ] Enter envia, Shift+Enter nova linha
- [ ] Botao abort visivel durante loading
- [ ] Zero `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo
- [ ] API publica (props, exports) inalterada

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-203 Chat.tsx | S-074 | D-002 |
| F-204 MessageList.tsx | S-074 | D-002 |
| F-205 MessageBubble.tsx | S-074 | D-002 |
| F-206 MessageInput.tsx | S-074 | D-002 |
| F-207 Markdown.tsx | S-074 | D-002 |
| F-208 StreamingIndicator.tsx | S-074 | D-002 |
