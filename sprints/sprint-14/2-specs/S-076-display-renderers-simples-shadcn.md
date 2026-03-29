# S-076 — Reescrever Display Renderers Simples com shadcn/ui

Reescrever os 6 display renderers simples para usar componentes shadcn internos e tokens Tailwind semanticos.

**Resolve:** D-006 (6 display renderers simples), D-011 (decisao AlertRenderer success variant)
**Score de prioridade:** 7
**Dependencia:** S-073 (infraestrutura src/ui/ e cn())
**PRP:** 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)

---

## 1. Objetivo

- Reescrever `AlertRenderer.tsx`, `MetricCardRenderer.tsx`, `FileCardRenderer.tsx`, `PriceHighlightRenderer.tsx`, `SourcesListRenderer.tsx` e `CodeBlockRenderer.tsx`
- Usar componentes shadcn: `Alert`, `Card`, `Badge`, `Button`, `Separator`
- Eliminar todas as classes `ai-chat-display-*`

---

## 2. Alteracoes

### 2.1 Arquivo: `apps/packages/ai-chat/src/display/AlertRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-alert`, variantes por classe CSS

**Depois:** Usar `Alert` do shadcn:
```tsx
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";

<Alert variant={variant === "error" ? "destructive" : "default"}>
  <Icon className="h-4 w-4" />
  {title && <AlertTitle>{title}</AlertTitle>}
  <AlertDescription>{message}</AlertDescription>
</Alert>
```

**Decisao de design (D-011):** A variante `success` usa o Alert `default` sem classe de cor adicional. Motivo: manter zero cor hardcoded — a alternativa `border-green-500/50` seria uma excecao. O icone `CheckCircle` ja comunica semantica de sucesso. Variantes `info` e `warning` tambem usam `default`.

Mapeamento de variantes:
- `error` → `variant="destructive"`
- `success`, `info`, `warning`, `default` → `variant="default"`

### 2.2 Arquivo: `apps/packages/ai-chat/src/display/MetricCardRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-metric-*`

**Depois:** Usar `Card` do shadcn:
```tsx
import { Card } from "../ui/card";

<Card className="p-4">
  <p className="text-sm text-muted-foreground">{label}</p>
  <div className="flex items-baseline gap-2 mt-1">
    <span className="text-2xl font-bold text-foreground">{value}</span>
    {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
  </div>
  {trend && <TrendIndicator trend={trend} />}
</Card>
```

O `TrendIndicator` interno usa apenas tokens: `text-primary` para positivo, `text-destructive` para negativo, `text-muted-foreground` para neutro.

### 2.3 Arquivo: `apps/packages/ai-chat/src/display/FileCardRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-file-*`

**Depois:** Usar `Card` + `Button` do shadcn:
```tsx
import { Card } from "../ui/card";
import { Button } from "../ui/button";

<Card className="flex items-center gap-3 p-3">
  <div className="shrink-0 text-primary"><FileIcon className="h-8 w-8" /></div>
  <div className="flex-1 min-w-0">
    <p className="font-medium text-sm truncate">{name}</p>
    <p className="text-xs text-muted-foreground">{type} · {size}</p>
  </div>
  {url && (
    <Button variant="ghost" size="icon" asChild>
      <a href={url} download><Download className="h-4 w-4" /></a>
    </Button>
  )}
</Card>
```

### 2.4 Arquivo: `apps/packages/ai-chat/src/display/PriceHighlightRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-price-*`

**Depois:** Usar `Card` + `Badge` do shadcn:
```tsx
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

<Card className="p-4">
  <p className="text-sm text-muted-foreground">{label}</p>
  <div className="flex items-baseline gap-2 mt-1">
    <span className="text-2xl font-bold text-foreground">{formattedPrice}</span>
    {discount && <Badge variant="destructive">-{discount}%</Badge>}
  </div>
  {originalPrice && (
    <p className="text-sm text-muted-foreground line-through">{formattedOriginal}</p>
  )}
</Card>
```

### 2.5 Arquivo: `apps/packages/ai-chat/src/display/SourcesListRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-sources-*`

**Depois:** Lista simples com tokens Tailwind:
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

### 2.6 Arquivo: `apps/packages/ai-chat/src/display/CodeBlockRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-code-*`

**Depois:** Usar `Button` do shadcn:
```tsx
import { Button } from "../ui/button";

<div className="rounded-md border border-border bg-muted overflow-hidden">
  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
    <span className="text-xs text-muted-foreground font-mono">{language}</span>
    <Button variant="ghost" size="sm" onClick={copyToClipboard}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  </div>
  <pre className="p-4 overflow-x-auto font-mono text-sm">{code}</pre>
</div>
```

- Manter logica de copy-to-clipboard com feedback visual

---

## 3. Regras de Implementacao

- **Substituir `clsx()` por `cn()`** onde necessario
- **Zero classe `ai-chat-display-*`** — todas removidas
- **Zero cor hardcoded** — usar tokens semanticos
- **Manter API publica** — props e data contract identicos
- **Manter logica** — copy-to-clipboard, formatacao de precos, etc.
- **Nao alterar `registry.ts`** — mapeamento puro, sem UI

---

## 4. Criterios de Aceite

- [ ] AlertRenderer usa `Alert` do shadcn — zero classe `ai-chat-display-alert`
- [ ] AlertRenderer mapeia `error` para `destructive`, demais para `default`
- [ ] MetricCardRenderer usa `Card` do shadcn — zero classe `ai-chat-display-metric`
- [ ] FileCardRenderer usa `Card` + `Button` do shadcn — zero classe `ai-chat-display-file`
- [ ] PriceHighlightRenderer usa `Card` + `Badge` — zero classe `ai-chat-display-price`
- [ ] SourcesListRenderer usa tokens Tailwind — zero classe `ai-chat-display-sources`
- [ ] CodeBlockRenderer usa `Button` do shadcn — zero classe `ai-chat-display-code`
- [ ] Copy-to-clipboard funciona no CodeBlockRenderer
- [ ] Zero `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo
- [ ] API publica (props, exports) inalterada
