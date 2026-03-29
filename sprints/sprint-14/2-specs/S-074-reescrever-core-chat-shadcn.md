# S-074 — Reescrever Core do Chat com shadcn/ui

Reescrever os 6 componentes core do chat para usar componentes shadcn internos e tokens Tailwind semanticos, eliminando todas as classes `ai-chat-*` e CSS variables.

**Resolve:** D-002 (reescrever 6 componentes core)
**Score de prioridade:** 9
**Dependencia:** S-073 (infraestrutura src/ui/ e cn())
**PRP:** 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)

---

## 1. Objetivo

- Reescrever `Chat.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `MessageInput.tsx`, `Markdown.tsx` e `StreamingIndicator.tsx`
- Substituir todas as classes CSS BEM (`ai-chat-*`) por tokens Tailwind semanticos do shadcn
- Usar componentes shadcn internos (`ScrollArea`, `Button`) onde aplicavel
- Manter a API publica (props, exports) identica

---

## 2. Alteracoes

### 2.1 Arquivo: `apps/packages/ai-chat/src/components/Chat.tsx` (MODIFICAR)

**Antes:**
```tsx
<div className={["ai-chat", className].filter(Boolean).join(" ")}>
```

**Depois:**
```tsx
import { cn } from "../lib/utils";

<div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
```

- Remover qualquer import de `styles.css`
- Substituir `clsx` por `cn` onde usado
- Manter `ChatProvider` wrapper e toda a logica intacta

### 2.2 Arquivo: `apps/packages/ai-chat/src/components/MessageList.tsx` (MODIFICAR)

**Antes:** `<div className="ai-chat-list">` + `<div className="ai-chat-list-empty">`

**Depois:** Usar `ScrollArea` do shadcn:
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

- Manter logica de auto-scroll inteligente (threshold 100px do bottom)
- Manter `isStreaming` na ultima mensagem assistant

### 2.3 Arquivo: `apps/packages/ai-chat/src/components/MessageBubble.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-bubble`, `ai-chat-bubble-user`, `ai-chat-bubble-assistant`, `ai-chat-bubble-row-*`

**Depois:**
```tsx
import { cn } from "../lib/utils";

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

- User: `bg-primary text-primary-foreground` (cor de destaque do tema)
- Assistant: `bg-muted text-foreground` (cor neutra do tema)
- Manter iteracao de `message.parts` via `PartRenderer`
- Manter fallback para `message.content` via `Markdown`

### 2.4 Arquivo: `apps/packages/ai-chat/src/components/MessageInput.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-input`, `ai-chat-input-btn`, `ai-chat-input-btn-send`, `ai-chat-input-btn-abort`

**Depois:** Usar `Button` do shadcn:
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

- Manter auto-expand (min 1 row, max 6 rows)
- Manter Enter para enviar, Shift+Enter para nova linha
- Manter focus automatico ao montar

### 2.5 Arquivo: `apps/packages/ai-chat/src/components/Markdown.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-markdown`, `ai-chat-code-block`, `ai-chat-inline-code`

**Depois:** Tokens Tailwind nos `components` override do react-markdown:

```tsx
import { cn } from "../lib/utils";

const components: Components = {
  pre: ({ children }) => (
    <pre className="bg-muted border border-border rounded-md my-3 overflow-hidden">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={cn("block p-4 overflow-x-auto font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted border border-border rounded-sm px-1.5 py-0.5 font-mono text-sm" {...props}>
        {children}
      </code>
    );
  },
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="text-primary underline underline-offset-2 hover:opacity-80" {...props}>
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-border my-3 py-1 px-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-border px-3 py-1.5 text-left font-semibold bg-muted" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-3 py-1.5 text-left" {...props}>
      {children}
    </td>
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

- NAO usar `@tailwindcss/typography` (prose) — estilos aplicados via components override
- Manter `remark-gfm` e `rehype-highlight`

### 2.6 Arquivo: `apps/packages/ai-chat/src/components/StreamingIndicator.tsx` (MODIFICAR)

**Antes:** classe `ai-chat-streaming-indicator` com animacao `ai-chat-blink`

**Depois:**
```tsx
<span className="inline-block w-2 h-4 align-text-bottom bg-current animate-pulse">|</span>
```

- `animate-pulse` substitui a animacao CSS `ai-chat-blink`
- `bg-current` herda a cor do texto pai

---

## 3. Regras de Implementacao

- **Substituir `clsx()` por `cn()`** em todos os componentes (importar de `../lib/utils`)
- **Zero classe `ai-chat-*`** — todas devem ser removidas
- **Zero import de `styles.css`** — remover qualquer referencia
- **Zero cor hardcoded** — nenhum `hsl()`, `oklch()`, `#hex`, `rgb()`
- **Apenas tokens semanticos shadcn** para cores: `bg-primary`, `text-foreground`, `bg-muted`, `border-border`, etc.
- **Layout e spacing Tailwind** sao livres: `flex`, `gap-*`, `p-*`, `m-*`, `text-sm`, etc.
- **Manter API publica** — props, tipos exportados e comportamento identicos
- **Manter logica** — auto-scroll, auto-expand, streaming, PartRenderer routing

---

## 4. Criterios de Aceite

- [ ] Chat.tsx usa `bg-background text-foreground` — zero classe `ai-chat`
- [ ] MessageList.tsx usa `ScrollArea` do shadcn — zero classe `ai-chat-list`
- [ ] MessageBubble.tsx usa `bg-primary`/`bg-muted` para user/assistant — zero classe `ai-chat-bubble`
- [ ] MessageInput.tsx usa `Button` do shadcn — zero classe `ai-chat-input`
- [ ] Markdown.tsx usa tokens Tailwind nos components override — zero classe `ai-chat-markdown`
- [ ] StreamingIndicator.tsx usa `animate-pulse` — zero animacao CSS customizada
- [ ] Auto-scroll inteligente no MessageList funciona (nao forca quando usuario scrollou)
- [ ] Auto-expand do textarea no MessageInput funciona (1-6 rows)
- [ ] Enter envia, Shift+Enter nova linha
- [ ] Botao abort visivel durante loading
- [ ] Zero `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo
- [ ] API publica (props, exports) inalterada
