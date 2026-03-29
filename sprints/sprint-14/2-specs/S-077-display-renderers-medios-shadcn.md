# S-077 — Reescrever Display Renderers Medios com shadcn/ui

Reescrever os 7 display renderers de complexidade media para usar componentes shadcn internos e tokens Tailwind semanticos.

**Resolve:** D-008 (7 display renderers medios)
**Score de prioridade:** 6
**Dependencia:** S-073 (infraestrutura src/ui/ e cn())
**PRP:** 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)

---

## 1. Objetivo

- Reescrever `LinkPreviewRenderer.tsx`, `ChoiceButtonsRenderer.tsx`, `ComparisonTableRenderer.tsx`, `SpreadsheetRenderer.tsx`, `StepTimelineRenderer.tsx`, `ProgressStepsRenderer.tsx` e `MapViewRenderer.tsx`
- Usar componentes shadcn: `Card`, `Button`, `Table`, `ScrollArea`, `Badge`, `Separator`, `Progress`
- Eliminar todas as classes `ai-chat-display-*`

---

## 2. Alteracoes

### 2.1 Arquivo: `apps/packages/ai-chat/src/display/LinkPreviewRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-link-preview-*`

**Depois:** Usar `Card` do shadcn:
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

### 2.2 Arquivo: `apps/packages/ai-chat/src/display/ChoiceButtonsRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-choice-*`

**Depois:** Usar `Button` do shadcn:
```tsx
import { Button } from "../ui/button";

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
    <Card key={i}
      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onSelect?.(choice.value)}>
      <p className="font-medium text-sm">{choice.label}</p>
      {choice.description && <p className="text-xs text-muted-foreground mt-1">{choice.description}</p>}
    </Card>
  ))}
</div>
```

### 2.3 Arquivo: `apps/packages/ai-chat/src/display/ComparisonTableRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-comparison-*`

**Depois:** Usar `Table` + `ScrollArea` do shadcn:
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

### 2.4 Arquivo: `apps/packages/ai-chat/src/display/SpreadsheetRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-spreadsheet-*`

**Depois:** Usar `Table` + `ScrollArea` do shadcn:
```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";

<ScrollArea className="w-full">
  <Table>
    <TableHeader>
      <TableRow>
        {headers.map((h, i) => (
          <TableHead key={i}>{h}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row, ri) => (
        <TableRow key={ri}>
          {row.map((cell, ci) => (
            <TableCell key={ci}>{cell}</TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
</ScrollArea>
```

### 2.5 Arquivo: `apps/packages/ai-chat/src/display/StepTimelineRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-timeline-*`

**Depois:** Composicao com `Badge` para status:
```tsx
import { Badge } from "../ui/badge";

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
        <p className={cn(
          "text-sm font-medium",
          step.status === "completed" ? "text-foreground" :
          step.status === "active" ? "text-primary" :
          "text-muted-foreground"
        )}>
          {step.title}
        </p>
        {step.description && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
        {step.badge && <Badge variant="secondary" className="mt-1">{step.badge}</Badge>}
      </div>
    </div>
  ))}
</div>
```

### 2.6 Arquivo: `apps/packages/ai-chat/src/display/ProgressStepsRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-progress-*`

**Depois:** Usar `Progress` do shadcn interno + `Badge`:
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

### 2.7 Arquivo: `apps/packages/ai-chat/src/display/MapViewRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-map-*`

**Depois:** Usar `Card` + `Separator`:
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

---

## 3. Regras de Implementacao

- **Substituir `clsx()` por `cn()`** onde necessario
- **Zero classe `ai-chat-display-*`** — todas removidas
- **Zero cor hardcoded** — usar tokens semanticos
- **Manter API publica** — props e data contract identicos
- **Manter logica** — selecao de choices, sort de tabelas, etc.
- **Nao alterar `registry.ts`** — mapeamento puro

---

## 4. Criterios de Aceite

- [ ] LinkPreviewRenderer usa `Card` — zero classe `ai-chat-display-link-preview`
- [ ] ChoiceButtonsRenderer usa `Button` variant outline — zero classe `ai-chat-display-choice`
- [ ] ComparisonTableRenderer usa `Table` + `ScrollArea` — zero classe `ai-chat-display-comparison`
- [ ] SpreadsheetRenderer usa `Table` + `ScrollArea` — zero classe `ai-chat-display-spreadsheet`
- [ ] StepTimelineRenderer usa `Badge` + tokens — zero classe `ai-chat-display-timeline`
- [ ] ProgressStepsRenderer usa `Progress` + `Badge` — zero classe `ai-chat-display-progress`
- [ ] MapViewRenderer usa `Card` + `Separator` — zero classe `ai-chat-display-map`
- [ ] Zero `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo
- [ ] API publica (props, exports) inalterada
