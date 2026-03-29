# PRP-16A — Infraestrutura shadcn Interna

Criar os componentes shadcn/ui internos em `src/ui/`, a utilidade `cn()`, adicionar dependencias Radix ao package.json e remover o export de `styles.css`.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O `@agentic-backbone/ai-chat` (PRP 15) usa classes CSS BEM puras (`ai-chat-*`) e um `styles.css` de 2345 linhas com 77 CSS variables proprias (`--ai-chat-*`). O pacote nao possui nenhum componente shadcn/ui interno, nem a utilidade `cn()` necessaria para composicao de classes Tailwind.

### Estado desejado

1. `src/lib/utils.ts` com funcao `cn()` (clsx + tailwind-merge)
2. `src/ui/` com 10 componentes shadcn internos: alert, badge, button, card, collapsible, dialog, progress, scroll-area, separator, table
3. Dependencias Radix e utilitarias declaradas no `package.json`
4. Export `"./styles.css"` removido do `package.json`

### Dependencias

- **Nenhuma** — este PRP eh pre-requisito absoluto de todos os demais PRPs do sprint-14

## Especificacao

### Feature F-200: Utilidade cn() e dependencias

**Spec:** S-073

Criar `apps/packages/ai-chat/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Atualizar `apps/packages/ai-chat/package.json`:

**Adicionar** dependencias:
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

**Remover** do campo `exports`:
```json
"./styles.css": "./src/styles.css"
```

#### Regras

- `clsx` ja eh dependencia existente — mantida
- Nao executar `npm install` — apenas declarar deps
- Versoes Radix devem ser alinhadas as ja usadas no monorepo

### Feature F-201: Componentes shadcn copiados do Hub

**Spec:** S-073

Copiar de `apps/hub/src/components/ui/` para `apps/packages/ai-chat/src/ui/`, ajustando o import de `cn` de `@/lib/utils` para `../lib/utils`:

| Arquivo | Usado por |
|---|---|
| `badge.tsx` | ProductCard, PriceHighlight, DataTable, Carousel, StepTimeline, ProgressSteps |
| `button.tsx` | MessageInput, CodeBlock, ChoiceButtons, ImageViewer, Gallery, Carousel, DataTable |
| `card.tsx` | MetricCard, FileCard, LinkPreview, ProductCard, PriceHighlight, MapView, Chart, Carousel |
| `dialog.tsx` | Gallery, ImageViewer |
| `scroll-area.tsx` | MessageList, DataTable, ComparisonTable, Spreadsheet |
| `separator.tsx` | SourcesList, MapView |
| `table.tsx` | DataTable, ComparisonTable, Spreadsheet |

#### Regras

- Manter a mesma implementacao do Hub — mudar apenas o path do import de `cn`
- Componentes `src/ui/` sao internos — NAO exportar no `src/index.ts`

### Feature F-202: Componentes shadcn criados do zero

**Spec:** S-073

O Hub nao possui `alert.tsx`, `collapsible.tsx` nem `progress.tsx`. Criar do zero em `apps/packages/ai-chat/src/ui/`:

**`alert.tsx`** — Alert com variantes `default` e `destructive` via CVA:

```typescript
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  )
);

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  )
);

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  )
);

export { Alert, AlertTitle, AlertDescription };
```

**`collapsible.tsx`** — Re-export dos primitives Radix:

```typescript
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
```

**`progress.tsx`** — Barra de progresso com `bg-primary`:

```typescript
import * as React from "react";
import { cn } from "../lib/utils";

const Progress = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value?: number }>(
  ({ className, value = 0, ...props }, ref) => (
    <div ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)} {...props}>
      <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
);
Progress.displayName = "Progress";

export { Progress };
```

#### Regras

- Componentes `src/ui/` sao internos — NAO exportar no `src/index.ts`
- Imports de `cn` usam path relativo (`../lib/utils`), nunca alias `@/`

## Limites

- **NAO** instalar dependencias (`npm install`) — apenas declarar no package.json
- **NAO** exportar componentes `src/ui/` no `src/index.ts`
- **NAO** modificar componentes existentes do chat — apenas criar infraestrutura
- **NAO** deletar `styles.css` ainda — sera feito no PRP-16F apos todos os componentes serem reescritos

## Validacao

- [ ] `src/lib/utils.ts` existe com funcao `cn()` exportada
- [ ] `src/ui/` contem: alert.tsx, badge.tsx, button.tsx, card.tsx, collapsible.tsx, dialog.tsx, progress.tsx, scroll-area.tsx, separator.tsx, table.tsx
- [ ] Todos os componentes `src/ui/` importam `cn` de `../lib/utils`
- [ ] alert.tsx tem variantes `default` e `destructive` via CVA
- [ ] collapsible.tsx re-exporta Radix primitives
- [ ] progress.tsx renderiza barra com `bg-primary` proporcional ao `value`
- [ ] package.json declara deps Radix e utilitarias
- [ ] Export `"./styles.css"` removido do package.json
- [ ] Nenhum componente `src/ui/` eh exportado no `src/index.ts`

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-200 Utilidade cn() e dependencias | S-073 | D-001, D-002 |
| F-201 Componentes shadcn copiados do Hub | S-073 | D-001 |
| F-202 Componentes shadcn criados do zero | S-073 | D-004, D-013 |
