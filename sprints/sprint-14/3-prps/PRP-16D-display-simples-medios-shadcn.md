# PRP-16D — Display Renderers Simples e Medios com shadcn/ui

Reescrever os 13 display renderers de complexidade simples e media para usar componentes shadcn internos e tokens Tailwind semanticos.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Os 13 display renderers usam classes CSS BEM (`ai-chat-display-*`) para estilizacao, com cores resolvidas via CSS variables proprias do `styles.css`. Nenhum usa componentes shadcn.

### Estado desejado

1. Todos os 13 renderers usam componentes shadcn internos (`Alert`, `Card`, `Badge`, `Button`, `Table`, `ScrollArea`, `Separator`, `Progress`)
2. Zero classe `ai-chat-display-*`
3. Zero cor hardcoded — apenas tokens semanticos shadcn
4. API publica e data contract identicos

### Dependencias

- **PRP-16A** — `src/ui/` com todos os componentes shadcn internos

## Especificacao

### Feature F-212: AlertRenderer.tsx

**Spec:** S-076

Usar `Alert` do shadcn com mapeamento de variantes:
- `error` → `variant="destructive"`
- `success`, `info`, `warning`, `default` → `variant="default"`

```tsx
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";

<Alert variant={variant === "error" ? "destructive" : "default"}>
  <Icon className="h-4 w-4" />
  {title && <AlertTitle>{title}</AlertTitle>}
  <AlertDescription>{message}</AlertDescription>
</Alert>
```

**Decisao D-011:** A variante `success` usa Alert `default` sem cor adicional. O icone `CheckCircle` comunica semantica de sucesso.

### Feature F-213: MetricCardRenderer.tsx

**Spec:** S-076

Usar `Card` do shadcn:

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

TrendIndicator interno: `text-primary` (positivo), `text-destructive` (negativo), `text-muted-foreground` (neutro).

### Feature F-214: FileCardRenderer.tsx

**Spec:** S-076

Usar `Card` + `Button` do shadcn:

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

### Feature F-215: PriceHighlightRenderer.tsx

**Spec:** S-076

Usar `Card` + `Badge` do shadcn:

```tsx
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

<Card className="p-4">
  <p className="text-sm text-muted-foreground">{label}</p>
  <div className="flex items-baseline gap-2 mt-1">
    <span className="text-2xl font-bold text-foreground">{formattedPrice}</span>
    {discount && <Badge variant="destructive">-{discount}%</Badge>}
  </div>
  {originalPrice && <p className="text-sm text-muted-foreground line-through">{formattedOriginal}</p>}
</Card>
```

### Feature F-216: SourcesListRenderer.tsx

**Spec:** S-076

Lista simples com tokens Tailwind:

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

### Feature F-217: CodeBlockRenderer.tsx

**Spec:** S-076

Usar `Button` do shadcn para copy-to-clipboard:

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

### Feature F-218: LinkPreviewRenderer.tsx

**Spec:** S-077

Usar `Card` do shadcn:

```tsx
import { Card } from "../ui/card";

<a href={url} target="_blank" rel="noopener noreferrer" className="block no-underline">
  <Card className="overflow-hidden hover:bg-muted/50 transition-colors">
    {image && (
      <div className="aspect-video overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>
    )}
    <div className="p-3 space-y-1">
      <p className="font-medium text-sm text-foreground truncate">{title}</p>
      {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
      <p className="text-xs text-muted-foreground truncate">{hostname}</p>
    </div>
  </Card>
</a>
```

### Feature F-219: ChoiceButtonsRenderer.tsx

**Spec:** S-077

Usar `Button` variant outline + `Card` para layout com descricao:

```tsx
import { Button } from "../ui/button";
import { Card } from "../ui/card";

// Layout de botoes
<div className="flex flex-wrap gap-2">
  {choices.map((choice, i) => (
    <Button key={i} variant="outline" size="sm" onClick={() => onSelect?.(choice.value)}>
      {choice.label}
    </Button>
  ))}
</div>

// Layout de cards (quando choices tem description)
<div className="grid gap-2">
  {choices.map((choice, i) => (
    <Card key={i} className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onSelect?.(choice.value)}>
      <p className="font-medium text-sm">{choice.label}</p>
      {choice.description && <p className="text-xs text-muted-foreground mt-1">{choice.description}</p>}
    </Card>
  ))}
</div>
```

### Feature F-220: ComparisonTableRenderer.tsx

**Spec:** S-077

Usar `Table` + `ScrollArea` do shadcn:

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";

<ScrollArea className="w-full">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="font-semibold">{featureLabel}</TableHead>
        {items.map((item, i) => (
          <TableHead key={i} className="font-semibold text-center">{item.name}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {features.map((feature, fi) => (
        <TableRow key={fi}>
          <TableCell className="font-medium">{feature.label}</TableCell>
          {items.map((item, ii) => (
            <TableCell key={ii} className="text-center">{item.values[fi]}</TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
</ScrollArea>
```

### Feature F-221: SpreadsheetRenderer.tsx

**Spec:** S-077

Usar `Table` + `ScrollArea` do shadcn — mesmo padrao do ComparisonTable:

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";

<ScrollArea className="w-full">
  <Table>
    <TableHeader>
      <TableRow>{headers.map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row, ri) => (
        <TableRow key={ri}>
          {row.map((cell, ci) => <TableCell key={ci}>{cell}</TableCell>)}
        </TableRow>
      ))}
    </TableBody>
  </Table>
</ScrollArea>
```

### Feature F-222: StepTimelineRenderer.tsx

**Spec:** S-077

Composicao com `Badge` para status:

```tsx
import { Badge } from "../ui/badge";
import { cn } from "../lib/utils";

<div className="space-y-3">
  {steps.map((step, i) => (
    <div key={i} className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
          step.status === "completed" ? "bg-primary text-primary-foreground" :
          step.status === "active" ? "bg-primary/20 text-primary border border-primary" :
          "bg-muted text-muted-foreground"
        )}>
          {step.status === "completed" ? <Check className="h-3 w-3" /> : i + 1}
        </div>
        {i < steps.length - 1 && <div className="w-px h-6 bg-border" />}
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <p className={cn("text-sm font-medium",
          step.status === "completed" ? "text-foreground" :
          step.status === "active" ? "text-primary" : "text-muted-foreground"
        )}>{step.title}</p>
        {step.description && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
        {step.badge && <Badge variant="secondary" className="mt-1">{step.badge}</Badge>}
      </div>
    </div>
  ))}
</div>
```

### Feature F-223: ProgressStepsRenderer.tsx

**Spec:** S-077

Usar `Progress` do shadcn interno + `Badge`:

```tsx
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";

<div className="space-y-3">
  <div className="flex items-center justify-between text-sm">
    <span className="font-medium text-foreground">{title}</span>
    <span className="text-muted-foreground">{completedCount}/{totalCount}</span>
  </div>
  <Progress value={(completedCount / totalCount) * 100} />
  <div className="space-y-1.5">
    {steps.map((step, i) => (
      <div key={i} className="flex items-center gap-2 text-sm">
        {step.completed
          ? <Check className="h-3.5 w-3.5 text-primary shrink-0" />
          : <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        }
        <span className={step.completed ? "text-foreground" : "text-muted-foreground"}>
          {step.label}
        </span>
      </div>
    ))}
  </div>
</div>
```

### Feature F-224: MapViewRenderer.tsx

**Spec:** S-077

Usar `Card` + `Separator`:

```tsx
import { Card } from "../ui/card";
import { Separator } from "../ui/separator";

<Card className="overflow-hidden">
  <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground text-sm">
    <MapPin className="h-5 w-5 mr-2" />
    Mapa (lat: {lat}, lng: {lng})
  </div>
  {locations && locations.length > 0 && (
    <>
      <Separator />
      <div className="p-3 space-y-2">
        {locations.map((loc, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{loc.name}</p>
              {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  )}
</Card>
```

## Limites

- **NAO** alterar `registry.ts` — mapeamento puro, sem UI
- **NAO** alterar data contracts (schemas Zod no ai-sdk)
- **NAO** deletar `styles.css` — sera feito no PRP-16F

## Validacao

- [ ] AlertRenderer usa `Alert` do shadcn — zero classe `ai-chat-display-alert`
- [ ] MetricCardRenderer usa `Card` — zero classe `ai-chat-display-metric`
- [ ] FileCardRenderer usa `Card` + `Button` — zero classe `ai-chat-display-file`
- [ ] PriceHighlightRenderer usa `Card` + `Badge` — zero classe `ai-chat-display-price`
- [ ] SourcesListRenderer usa tokens Tailwind — zero classe `ai-chat-display-sources`
- [ ] CodeBlockRenderer usa `Button` — zero classe `ai-chat-display-code`
- [ ] LinkPreviewRenderer usa `Card` — zero classe `ai-chat-display-link-preview`
- [ ] ChoiceButtonsRenderer usa `Button` variant outline — zero classe `ai-chat-display-choice`
- [ ] ComparisonTableRenderer usa `Table` + `ScrollArea` — zero classe `ai-chat-display-comparison`
- [ ] SpreadsheetRenderer usa `Table` + `ScrollArea` — zero classe `ai-chat-display-spreadsheet`
- [ ] StepTimelineRenderer usa `Badge` + tokens — zero classe `ai-chat-display-timeline`
- [ ] ProgressStepsRenderer usa `Progress` + `Badge` — zero classe `ai-chat-display-progress`
- [ ] MapViewRenderer usa `Card` + `Separator` — zero classe `ai-chat-display-map`
- [ ] Copy-to-clipboard funciona no CodeBlockRenderer
- [ ] Zero `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo
- [ ] API publica (props, exports) inalterada

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-212 AlertRenderer | S-076 | D-006, D-011 |
| F-213 MetricCardRenderer | S-076 | D-006 |
| F-214 FileCardRenderer | S-076 | D-006 |
| F-215 PriceHighlightRenderer | S-076 | D-006 |
| F-216 SourcesListRenderer | S-076 | D-006 |
| F-217 CodeBlockRenderer | S-076 | D-006 |
| F-218 LinkPreviewRenderer | S-077 | D-008 |
| F-219 ChoiceButtonsRenderer | S-077 | D-008 |
| F-220 ComparisonTableRenderer | S-077 | D-008 |
| F-221 SpreadsheetRenderer | S-077 | D-008 |
| F-222 StepTimelineRenderer | S-077 | D-008 |
| F-223 ProgressStepsRenderer | S-077 | D-008, D-013 |
| F-224 MapViewRenderer | S-077 | D-008 |
