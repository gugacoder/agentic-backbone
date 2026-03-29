# PRP 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)

Reescrever `@agentic-backbone/ai-chat` para usar exclusivamente componentes shadcn/ui e tokens CSS do host. Eliminar o `styles.css` de 2346 linhas e todas as ~40 CSS variables proprias (`--ai-chat-*`). O pacote deve ter **zero configuracao de cor** — herda 100% do tema shadcn do app consumidor.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

O `@agentic-backbone/ai-chat` (PRP 15) entrega chat rico funcional com 29 componentes:
- 6 componentes core (Chat, MessageList, MessageBubble, MessageInput, Markdown, StreamingIndicator)
- 4 parts (PartRenderer, ReasoningBlock, ToolActivity, ToolResult)
- 19 display renderers (Alert, Chart, Carousel, DataTable, Gallery, ImageViewer, etc.)
- 2 hooks (useBackboneChat, ChatProvider)

**Problema critico**: O pacote define seu proprio sistema de cores (~40 CSS variables `--ai-chat-*` com valores HSL hardcoded) e usa classes CSS BEM puras (`ai-chat-bubble`, `ai-chat-tool-activity`, etc.) — ignorando completamente o tema shadcn do app consumidor.

Resultado: no Hub, que usa tema copper/laranja via tweakcn, o chat aparece com tema azul proprio. Qualquer troca de tema no host nao afeta o chat.

### Estado desejado

1. `ai-chat` usa **exclusivamente** componentes shadcn/ui (`Card`, `Button`, `Alert`, `Table`, `Badge`, `Collapsible`, `Dialog`, `ScrollArea`, `Input`, `Separator`, etc.)
2. **Zero CSS variable propria** — o pacote nao define nenhum `--ai-chat-*`
3. **Zero classe CSS propria** — eliminar todas as classes `ai-chat-*` e o arquivo `styles.css`
4. **Zero cor hardcoded** — nenhum `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo
5. O pacote se adapta automaticamente a qualquer tema shadcn — se o host troca de copper para verde, o chat muda junto
6. A API publica (`ChatProps`, exports, hooks) permanece identica — breaking change zero para o consumidor

### Dependencias

- **PRP 15** (ai-chat) — o pacote existe e funciona; esta PRP reescreve a camada visual

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Estilizacao | `styles.css` (2346 linhas) + 40 CSS vars proprias | Zero CSS proprio — shadcn components + tokens |
| Componentes UI | HTML puro + classes BEM | shadcn/ui (`Card`, `Button`, `Alert`, `Table`, etc.) |
| Cores | HSL hardcoded (azul) | Herda do tema shadcn do host |
| Dark mode | Bloco `.dark` proprio no CSS | Automatico via shadcn |
| Tailwind classes | Zero (CSS puro) | Apenas tokens seguros (`bg-primary`, `text-foreground`, `border-border`, etc.) |
| Deps do pacote | `clsx` | `clsx` + componentes shadcn inline (sem dep de registry) |
| `styles.css` export | `"./styles.css": "./src/styles.css"` | Removido |

### O que NAO muda

| Aspecto | Motivo |
|---|---|
| API publica (`ChatProps`, exports) | Compatibilidade com consumidores existentes |
| Hooks (`useBackboneChat`, `ChatProvider`) | Zero logica visual |
| `PartRenderer` (logica de roteamento) | Logica pura, sem UI |
| Display tool data contract (`DisplayToolName`, schemas Zod) | Pertence ao ai-sdk, nao ao ai-chat |
| `registry.ts` / `resolveDisplayRenderer()` | Logica de mapeamento, nao UI |

---

## Premissas de Design

### 1. Componentes shadcn inline (nao importados)

O ai-chat eh um pacote npm publicavel. Ele nao pode importar de `@/components/ui/` — esse path so existe no app consumidor.

**Solucao**: cada componente shadcn necessario eh copiado para dentro do pacote como arquivo interno (padrao oficial do shadcn — "copy and own"). Ficam em `src/ui/` e sao internos — nao exportados.

```
src/ui/
  alert.tsx
  badge.tsx
  button.tsx
  card.tsx
  collapsible.tsx
  dialog.tsx
  progress.tsx
  scroll-area.tsx
  separator.tsx
  table.tsx
```

Esses componentes usam os tokens shadcn (`bg-primary`, `text-foreground`, etc.) que sao resolvidos pelo CSS do host. O pacote nao precisa definir nenhuma variavel — os tokens ja existem no `:root` do app consumidor.

### 2. Classes Tailwind permitidas vs proibidas

**Permitido** — tokens semanticos shadcn (resolvem para CSS variables do host):
```
bg-primary, bg-secondary, bg-muted, bg-card, bg-background, bg-destructive, bg-accent, bg-popover
text-foreground, text-primary-foreground, text-muted-foreground, text-card-foreground, text-destructive-foreground
border-border, border-input
ring-ring
rounded-sm, rounded-md, rounded-lg, rounded-xl
```

**Proibido** — decisoes de cor in-loco:
```
bg-blue-500, text-gray-400, border-slate-200, bg-green-100
hsl(...), oklch(...), #hex, rgb(...)
```

**Permitido** — layout e spacing (nao sao decisoes de cor):
```
flex, grid, gap-*, p-*, m-*, w-*, h-*, text-sm, text-xs, font-medium, overflow-*, animate-*
```

### 3. Animacoes

As 3 animacoes do CSS atual (`ai-chat-blink`, `ai-chat-spin`, `ai-chat-fade-in`) viram classes Tailwind:
- `ai-chat-blink` → `animate-pulse` (built-in Tailwind)
- `ai-chat-spin` → `animate-spin` (built-in Tailwind)
- `ai-chat-fade-in` → inline style ou classe utilitaria minima

### 4. Tipografia

O pacote nao define fonte. Herda `font-sans` do host (via shadcn/Tailwind). Para monospace (code blocks), usa `font-mono`.

### 5. Markdown prose

O `Markdown.tsx` precisa de estilos para headings, lists, tables, blockquotes, code blocks, links. Esses estilos usam tokens shadcn via Tailwind inline:
- `prose` nao eh necessario — o componente aplica classes nos elementos via `react-markdown` components override
- Links: `text-primary underline`
- Blockquotes: `border-l-2 border-border text-muted-foreground`
- Tables: `Table` do shadcn
- Code blocks: `bg-muted border border-border rounded-md font-mono text-sm`
- Inline code: `bg-muted border border-border rounded-sm px-1.5 py-0.5 font-mono text-sm`

---

## Especificacao

### Fase 1 — Infraestrutura: shadcn internos + limpeza

#### 1.1 Copiar componentes shadcn para `src/ui/`

Copiar os seguintes componentes do Hub (`apps/hub/src/components/ui/`) para `apps/packages/ai-chat/src/ui/`, ajustando imports:

| Componente | Usado por |
|---|---|
| `alert.tsx` | AlertRenderer |
| `badge.tsx` | ProductCard, PriceHighlight, DataTable, Carousel |
| `button.tsx` | MessageInput, CodeBlock, ChoiceButtons, ImageViewer, Gallery, Carousel |
| `card.tsx` | MetricCard, FileCard, LinkPreview, ProductCard, PriceHighlight, MapView |
| `collapsible.tsx` | ReasoningBlock, ToolResult |
| `dialog.tsx` | Gallery, ImageViewer |
| `scroll-area.tsx` | MessageList, DataTable, ComparisonTable, Spreadsheet |
| `separator.tsx` | SourcesList |
| `table.tsx` | DataTable, ComparisonTable, Spreadsheet |

#### 1.2 Adicionar deps ao `package.json`

```json
{
  "dependencies": {
    "@radix-ui/react-collapsible": "^1",
    "@radix-ui/react-dialog": "^1",
    "@radix-ui/react-scroll-area": "^1",
    "@radix-ui/react-separator": "^1",
    "class-variance-authority": "^0.7",
    "tailwind-merge": "^3"
  }
}
```

#### 1.3 Criar `src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

#### 1.4 Remover do `package.json`

- Remover export `"./styles.css": "./src/styles.css"` do campo `exports`

#### 1.5 Deletar `src/styles.css`

O arquivo inteiro (2346 linhas) eh eliminado. Nenhum CSS proprio.

---

### Fase 2 — Core do Chat (6 componentes)

#### 2.1 `Chat.tsx`

Antes:
```tsx
<div className={["ai-chat", className].filter(Boolean).join(" ")}>
```

Depois:
```tsx
<div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
```

Sem classe `ai-chat`. Sem CSS variables.

#### 2.2 `MessageList.tsx`

Antes: `<div className="ai-chat-list">` + `<div className="ai-chat-list-empty">`

Depois: usa `ScrollArea` do shadcn:
```tsx
<ScrollArea className="flex-1">
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

#### 2.3 `MessageBubble.tsx`

Antes: classes `ai-chat-bubble`, `ai-chat-bubble-user`, `ai-chat-bubble-assistant`, `ai-chat-bubble-row-*`

Depois:
```tsx
// User bubble
<div className="flex w-full justify-end">
  <div className="inline-block max-w-[80%] rounded-lg rounded-br-sm px-4 py-2.5 bg-primary text-primary-foreground">
    ...
  </div>
</div>

// Assistant bubble
<div className="flex w-full justify-start">
  <div className="inline-block max-w-[80%] rounded-lg rounded-bl-sm px-4 py-2.5 bg-muted text-foreground">
    ...
  </div>
</div>
```

Zero classe propria. Cores via tokens shadcn.

#### 2.4 `MessageInput.tsx`

Antes: classes `ai-chat-input`, `ai-chat-input-btn`, `ai-chat-input-btn-send`, `ai-chat-input-btn-abort`

Depois: usa `Button` do shadcn:
```tsx
<div className={cn("flex items-end gap-3 rounded-xl border border-input bg-background p-2", className)}>
  <textarea className="flex-1 bg-transparent border-none text-foreground text-sm resize-none outline-none placeholder:text-muted-foreground" ... />
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

#### 2.5 `Markdown.tsx`

Antes: classes `ai-chat-markdown`, `ai-chat-code-block`, `ai-chat-inline-code`

Depois: inline Tailwind tokens nos `components` override do react-markdown:
```tsx
const components: Components = {
  pre: ({ children }) => (
    <pre className="bg-muted border border-border rounded-md my-3 overflow-hidden">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) return <code className={cn("block p-4 overflow-x-auto font-mono text-sm", className)} {...props}>{children}</code>;
    return <code className="bg-muted border border-border rounded-sm px-1.5 py-0.5 font-mono text-sm" {...props}>{children}</code>;
  },
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80" {...props}>
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
    <th className="border border-border px-3 py-1.5 text-left font-semibold bg-muted" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-3 py-1.5 text-left" {...props}>{children}</td>
  ),
};

// Container
<div className="text-foreground text-sm leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1,&_h2,&_h3,&_h4]:font-semibold [&_h1,&_h2,&_h3,&_h4]:mt-5 [&_h1,&_h2,&_h3,&_h4]:mb-2 [&_ul,&_ol]:pl-6 [&_ul,&_ol]:my-2 [&_li]:my-1 [&_hr]:border-border [&_hr]:my-4">
  <ReactMarkdown ...>{children}</ReactMarkdown>
</div>
```

#### 2.6 `StreamingIndicator.tsx`

Sem mudanca significativa — apenas trocar classe:
```tsx
<span className="inline-block w-2 h-4 align-text-bottom bg-current animate-pulse" ...>|</span>
```

---

### Fase 3 — Parts (3 componentes visuais)

#### 3.1 `ReasoningBlock.tsx`

Antes: classes `ai-chat-reasoning`, `ai-chat-reasoning-header`, `ai-chat-reasoning-body`

Depois: usa `Collapsible` do shadcn:
```tsx
<Collapsible open={expanded} onOpenChange={setExpanded}>
  <div className="bg-muted/50 border border-border rounded-md text-sm overflow-hidden">
    <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full text-left font-medium text-muted-foreground hover:bg-muted cursor-pointer">
      <Brain className="h-3.5 w-3.5" />
      <span>Raciocinio</span>
      {expanded ? <ChevronDown className="h-3.5 w-3.5 ml-auto" /> : <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="max-h-96 overflow-y-auto px-3 py-3 text-muted-foreground whitespace-pre-wrap break-words border-t border-border">
        {content}
      </div>
    </CollapsibleContent>
  </div>
</Collapsible>
```

#### 3.2 `ToolActivity.tsx`

Antes: classes `ai-chat-tool-activity`, `ai-chat-tool-activity-icon`, etc.

Depois:
```tsx
<div className={cn("flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm", className)}>
  <span className="text-primary shrink-0"><Icon className="h-3.5 w-3.5" /></span>
  <span className="font-medium font-mono">{displayName}</span>
  <span className="ml-auto text-muted-foreground">
    {isActive
      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
      : <Check className="h-3.5 w-3.5 text-green-500" />
    }
  </span>
</div>
```

> **Nota**: `text-green-500` no check eh a unica excecao — cor semantica de "sucesso concluido". Alternativa: usar `text-primary` e perder a semantica de sucesso. Decisao do implementador.

#### 3.3 `ToolResult.tsx`

Antes: classes `ai-chat-tool-result`, `ai-chat-tool-result--error`, etc.

Depois: usa `Collapsible` do shadcn:
```tsx
<Collapsible open={expanded} onOpenChange={setExpanded}>
  <div className="rounded-md border border-border bg-muted/50 text-sm overflow-hidden">
    <CollapsibleTrigger className={cn(
      "flex items-center gap-2 w-full px-3 py-2 text-left font-medium hover:bg-muted cursor-pointer",
      isError ? "text-destructive" : "text-foreground"
    )}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-mono flex-1 truncate">{toolName}</span>
      <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <pre className="max-h-80 overflow-y-auto p-3 font-mono text-xs whitespace-pre-wrap break-all bg-muted border-t border-border">
        {serialized}
      </pre>
    </CollapsibleContent>
  </div>
</Collapsible>
```

---

### Fase 4 — Display Renderers Simples (6 componentes)

#### 4.1 `AlertRenderer.tsx`

Antes: classes `ai-chat-display-alert`, variantes por classe CSS

Depois: usa `Alert` do shadcn:
```tsx
<Alert variant={variant === "error" ? "destructive" : "default"} className={variant === "success" ? "border-green-500/50" : undefined}>
  <Icon className="h-4 w-4" />
  {title && <AlertTitle>{title}</AlertTitle>}
  <AlertDescription>{message}</AlertDescription>
</Alert>
```

#### 4.2 `MetricCardRenderer.tsx`

Antes: classes `ai-chat-display-metric-*`

Depois: usa `Card` do shadcn:
```tsx
<Card className="p-4">
  <p className="text-sm text-muted-foreground">{label}</p>
  <div className="flex items-baseline gap-2 mt-1">
    <span className="text-2xl font-bold text-foreground">{value}</span>
    {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
  </div>
  {trend && <TrendIndicator trend={trend} />}
</Card>
```

#### 4.3 `FileCardRenderer.tsx`

Antes: classes `ai-chat-display-file-*`

Depois: usa `Card` do shadcn:
```tsx
<Card className="flex items-center gap-3 p-3">
  <div className="shrink-0 text-primary"><FileIcon className="h-8 w-8" /></div>
  <div className="flex-1 min-w-0">
    <p className="font-medium text-sm truncate">{name}</p>
    <p className="text-xs text-muted-foreground">{type} · {size}</p>
  </div>
  {url && <Button variant="ghost" size="icon" asChild><a href={url} download><Download className="h-4 w-4" /></a></Button>}
</Card>
```

#### 4.4 `PriceHighlightRenderer.tsx`

Antes: classes `ai-chat-display-price-*`

Depois: usa `Card` + `Badge` do shadcn.

#### 4.5 `SourcesListRenderer.tsx`

Antes: classes `ai-chat-display-sources-*`

Depois: lista simples com `Separator`:
```tsx
<div className="space-y-2">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
  {sources.map((s, i) => (
    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
       className="flex items-start gap-2 p-2 rounded-md hover:bg-muted text-sm">
      <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">{i + 1}</span>
      <div className="min-w-0">
        <p className="font-medium text-primary truncate">{s.title}</p>
        {s.snippet && <p className="text-xs text-muted-foreground line-clamp-2">{s.snippet}</p>}
      </div>
    </a>
  ))}
</div>
```

#### 4.6 `CodeBlockRenderer.tsx`

Antes: classes `ai-chat-display-code-*`

Depois:
```tsx
<div className="rounded-md border border-border bg-muted overflow-hidden">
  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
    <span className="text-xs text-muted-foreground font-mono">{language}</span>
    <Button variant="ghost" size="sm" onClick={copyToClipboard}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  </div>
  <pre className="p-4 overflow-x-auto font-mono text-sm">{...}</pre>
</div>
```

---

### Fase 5 — Display Renderers Medios (7 componentes)

#### 5.1 `LinkPreviewRenderer.tsx` → `Card`

#### 5.2 `ChoiceButtonsRenderer.tsx` → `Button` (variant "outline") + `Card` (para cards layout)

#### 5.3 `ComparisonTableRenderer.tsx` → `Table` + `ScrollArea`

#### 5.4 `SpreadsheetRenderer.tsx` → `Table` + `ScrollArea`

#### 5.5 `StepTimelineRenderer.tsx` → composicao com `Badge` para status icons

#### 5.6 `ProgressStepsRenderer.tsx` → shadcn nao tem Progress built-in com steps; usar div com `bg-primary` para barra + lista com `Badge`

#### 5.7 `MapViewRenderer.tsx` → `Card` wrapper + lista com `Separator`

Cada um segue o mesmo padrao: substituir classes `ai-chat-display-*` por componentes shadcn + tokens Tailwind semanticos.

---

### Fase 6 — Display Renderers Complexos (5 componentes)

#### 6.1 `DataTableRenderer.tsx`

Usa `Table` + `ScrollArea` do shadcn. Headers sortable com `Button variant="ghost"`. Celulas tipadas:
- `money` → formatacao BRL
- `image` → `<img>` com `rounded-sm`
- `link` → `text-primary underline`
- `badge` → `Badge` do shadcn

#### 6.2 `CarouselRenderer.tsx`

Mantem `embla-carousel-react` para logica de scroll. UI refatorada:
- Container: `Card`
- Slides: `Card` internos
- Arrows: `Button variant="outline" size="icon"`
- Dots: `bg-primary` (ativo) / `bg-muted` (inativo)
- Badges dentro dos slides: `Badge` do shadcn

#### 6.3 `ProductCardRenderer.tsx`

Usa `Card` + `Badge` + `Button`:
```tsx
<Card className="overflow-hidden">
  <div className="relative">
    <img ... />
    {discount && <Badge className="absolute top-2 right-2" variant="destructive">-{discount}%</Badge>}
  </div>
  <CardContent className="p-4 space-y-2">
    <CardTitle className="text-sm">{title}</CardTitle>
    <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-bold">{price}</span>
      {originalPrice && <span className="text-sm text-muted-foreground line-through">{originalPrice}</span>}
    </div>
    {url && <Button className="w-full" size="sm" asChild><a href={url}>Ver produto</a></Button>}
  </CardContent>
</Card>
```

#### 6.4 `ChartRenderer.tsx`

Mantem `recharts` para renderizacao. Wrapper:
```tsx
<Card className="p-4">
  {title && <p className="text-sm font-medium mb-4">{title}</p>}
  <div className="min-h-[200px]">
    <ResponsiveContainer ...>
      {/* recharts components — cores via --chart-1..5 tokens do shadcn */}
    </ResponsiveContainer>
  </div>
</Card>
```

Cores dos graficos: usar tokens `--chart-1` a `--chart-5` do shadcn (ja existem no Hub). Fallback com CSS `var()`:
```tsx
const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
];
```

#### 6.5 `GalleryRenderer.tsx` e `ImageViewerRenderer.tsx`

Usam `Dialog` do shadcn para lightbox:
```tsx
<Dialog>
  <DialogTrigger asChild>
    <button className="relative group cursor-pointer rounded-md overflow-hidden">
      <img ... />
      <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
        <ZoomIn className="h-5 w-5 text-foreground" />
      </div>
    </button>
  </DialogTrigger>
  <DialogContent className="max-w-4xl p-0 bg-background/95">
    <img ... />
    <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={close}>
      <X className="h-4 w-4" />
    </Button>
  </DialogContent>
</Dialog>
```

Gallery grid: `grid grid-cols-2 md:grid-cols-3 gap-2` (Tailwind layout, sem cor).

ImageViewer zoom: mantem logica de zoom (0.25x-4x) com state interno. Toolbar com `Button variant="ghost"`.

---

### Fase 7 — Limpeza e integracao

#### 7.1 Deletar `src/styles.css`

Arquivo completo (2346 linhas).

#### 7.2 Atualizar `package.json`

Remover:
```json
{
  "exports": {
    "./styles.css": "./src/styles.css"  // REMOVER
  }
}
```

Adicionar (se nao existirem):
```json
{
  "dependencies": {
    "@radix-ui/react-collapsible": "^1",
    "@radix-ui/react-dialog": "^1",
    "@radix-ui/react-scroll-area": "^1",
    "@radix-ui/react-separator": "^1",
    "class-variance-authority": "^0.7",
    "tailwind-merge": "^3"
  }
}
```

Remover `clsx` standalone (fica via `tailwind-merge` no `cn()`). Na verdade, `clsx` continua como dep de `cva`, entao pode manter.

#### 7.3 Atualizar Hub

No Hub, remover o import do stylesheet em `main.tsx`:
```tsx
// REMOVER esta linha:
import "@agentic-backbone/ai-chat/styles.css";
```

Nenhuma outra mudanca no Hub — o `<Chat />` continua funcionando com as mesmas props.

#### 7.4 Atualizar `CHANGELOG.md`

```
## 0.2.0 — Reescrita shadcn/ui

- Reescrita completa da camada visual com componentes shadcn/ui
- Eliminado styles.css (2346 linhas) — zero CSS proprio
- Zero cor hardcoded — herda 100% do tema shadcn do host
- Removido export ./styles.css (breaking para quem importava)
- Adicionado deps: @radix-ui/react-collapsible, dialog, scroll-area, separator
- API publica (ChatProps, hooks, exports) inalterada
```

---

## Limites

### NAO fazer

- NAO criar Tailwind config no pacote — o pacote nao tem `tailwind.config`; depende do config do host
- NAO exportar os componentes `src/ui/` — sao internos do pacote
- NAO adicionar `@tailwindcss/typography` (prose) — os estilos de markdown sao aplicados via components override
- NAO mudar a API publica (`ChatProps`, `useBackboneChat`, exports de display renderers)
- NAO mudar a logica dos hooks (`ChatProvider`, `useBackboneChat`) — sao puros, sem visual
- NAO mudar a logica do `PartRenderer` — eh roteamento puro
- NAO mudar os schemas Zod no ai-sdk — o data contract nao muda
- NAO tentar fazer o pacote funcionar sem shadcn/Tailwind no host — este pacote assume que o consumidor usa shadcn

### Observacoes

- O pacote passa a assumir que o host tem Tailwind CSS + tokens shadcn no `:root`. Sem isso, nenhum estilo sera aplicado. Isso eh intencional — o pacote eh para apps shadcn.
- `embla-carousel-react` e `recharts` continuam como deps — sao libs de comportamento, nao de estilo.
- `react-markdown`, `remark-gfm`, `rehype-highlight` continuam — sao renderizacao de conteudo.
- `lucide-react` continua — icones sao agnosticos de tema.

---

## Ordem de Execucao

| Fase | O que | Componentes | Depende de |
|---|---|---|---|
| 1 | Infraestrutura: copiar shadcn ui components, `cn()`, deps | `src/ui/*`, `src/lib/utils.ts` | nada |
| 2 | Core do chat | Chat, MessageList, MessageBubble, MessageInput, Markdown, StreamingIndicator | fase 1 |
| 3 | Parts | ReasoningBlock, ToolActivity, ToolResult | fase 1 |
| 4 | Display simples | Alert, MetricCard, FileCard, PriceHighlight, SourcesList, CodeBlock | fase 1 |
| 5 | Display medios | LinkPreview, ChoiceButtons, ComparisonTable, Spreadsheet, StepTimeline, ProgressSteps, MapView | fase 1 |
| 6 | Display complexos | DataTable, Carousel, ProductCard, Chart, Gallery, ImageViewer | fase 1 |
| 7 | Limpeza | Deletar styles.css, atualizar package.json, atualizar Hub imports, CHANGELOG | fases 2-6 |

Fases 2, 3, 4, 5, 6 sao paralelas entre si (todas dependem so da fase 1).

---

## Validacao

### Checklist visual

- [ ] Abrir Hub com tema copper — chat deve usar cores copper
- [ ] Trocar tema para azul (via tweakcn/index.css) — chat deve mudar junto automaticamente
- [ ] Dark mode — chat deve seguir `.dark` do host
- [ ] Todas as 19 display tools renderizam corretamente
- [ ] Bubbles user/assistant com cores do tema
- [ ] Input com borda, focus ring, placeholder — tudo do tema
- [ ] ReasoningBlock colapsavel funciona
- [ ] ToolActivity spinner/check funciona
- [ ] ToolResult colapsavel funciona
- [ ] Markdown: headings, lists, links, code blocks, tables, blockquotes
- [ ] Charts com cores `--chart-1..5` do tema
- [ ] Gallery/ImageViewer lightbox funciona (Dialog)
- [ ] Carousel arrows/dots funciona
- [ ] Zero `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo `.tsx`
- [ ] Zero arquivo `.css` no pacote
- [ ] `npm run build` compila sem erro
