# S-073 — Infraestrutura shadcn Interna

Criar os componentes shadcn/ui internos em `src/ui/`, a utilidade `cn()`, e adicionar dependencias Radix ao package.json.

**Resolve:** D-001 (infraestrutura base), D-004 (alert.tsx e collapsible.tsx ausentes no Hub), D-013 (progress.tsx)
**Score de prioridade:** 10
**Dependencia:** Nenhuma — pre-requisito absoluto de todas as demais specs do sprint-14
**PRP:** 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)

---

## 1. Objetivo

- Criar `src/lib/utils.ts` com funcao `cn()` (clsx + tailwind-merge)
- Copiar componentes shadcn/ui do Hub (`apps/hub/src/components/ui/`) para `src/ui/`, ajustando imports de `cn()` para `../../lib/utils` (ou path relativo correto)
- Criar `alert.tsx` e `collapsible.tsx` do zero usando Radix primitives (Hub nao os possui)
- Criar `progress.tsx` do zero (componente simples com `div` + `bg-primary`)
- Adicionar dependencias Radix e utilitarias ao `package.json`
- Remover export `"./styles.css"` do `package.json`

---

## 2. Alteracoes

### 2.1 Arquivo: `apps/packages/ai-chat/src/lib/utils.ts` (NOVO)

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 2.2 Componentes copiados do Hub para `src/ui/`

Copiar de `apps/hub/src/components/ui/` para `apps/packages/ai-chat/src/ui/`, ajustando o import de `cn`:

| Arquivo | Import original | Import ajustado |
|---|---|---|
| `badge.tsx` | `@/lib/utils` | `../lib/utils` |
| `button.tsx` | `@/lib/utils` | `../lib/utils` |
| `card.tsx` | `@/lib/utils` | `../lib/utils` |
| `dialog.tsx` | `@/lib/utils` | `../lib/utils` |
| `scroll-area.tsx` | `@/lib/utils` | `../lib/utils` |
| `separator.tsx` | `@/lib/utils` | `../lib/utils` |
| `table.tsx` | `@/lib/utils` | `../lib/utils` |

Cada arquivo deve manter a mesma implementacao do Hub, mudando apenas o path do import de `cn`.

### 2.3 Arquivo: `apps/packages/ai-chat/src/ui/alert.tsx` (NOVO — criado do zero)

Componente Alert com variantes via CVA (class-variance-authority):

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
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  )
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
```

### 2.4 Arquivo: `apps/packages/ai-chat/src/ui/collapsible.tsx` (NOVO — criado do zero)

Re-export dos primitives do Radix:

```typescript
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
```

### 2.5 Arquivo: `apps/packages/ai-chat/src/ui/progress.tsx` (NOVO — criado do zero)

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

### 2.6 Atualizar: `apps/packages/ai-chat/package.json`

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

> Nota: `clsx` ja eh dependencia existente — mantida.

---

## 3. Regras de Implementacao

- **Componentes `src/ui/` sao internos** — NAO exportar no `src/index.ts`
- **Imports de `cn`** devem usar path relativo (`../lib/utils`), nunca alias `@/`
- **alert.tsx e collapsible.tsx** sao criados do zero (nao existem no Hub para copiar)
- **progress.tsx** eh criado do zero (nao existe no Hub)
- **Versoes Radix** devem ser alinhadas as ja usadas no monorepo (verificar `apps/hub/package.json`)
- **Nao instalar** dependencias nesta spec — apenas declarar no package.json

---

## 4. Criterios de Aceite

- [ ] `src/lib/utils.ts` existe com funcao `cn()` exportada
- [ ] `src/ui/` contem: alert.tsx, badge.tsx, button.tsx, card.tsx, collapsible.tsx, dialog.tsx, progress.tsx, scroll-area.tsx, separator.tsx, table.tsx
- [ ] Todos os componentes `src/ui/` importam `cn` de `../lib/utils`
- [ ] alert.tsx tem variantes `default` e `destructive` via CVA
- [ ] collapsible.tsx re-exporta Radix primitives
- [ ] progress.tsx renderiza barra com `bg-primary` proporcional ao `value`
- [ ] package.json declara deps Radix e utilitarias
- [ ] Export `"./styles.css"` removido do package.json
- [ ] Nenhum componente `src/ui/` eh exportado no `src/index.ts`
