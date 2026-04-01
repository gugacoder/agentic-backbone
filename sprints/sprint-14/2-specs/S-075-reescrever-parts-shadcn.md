# S-075 — Reescrever Parts com shadcn/ui

Reescrever os 3 componentes visuais de parts (ReasoningBlock, ToolActivity, ToolResult) usando Collapsible do shadcn e tokens Tailwind semanticos.

**Resolve:** D-005 (reescrever 3 parts), D-010 (decisao text-green-500 no ToolActivity)
**Score de prioridade:** 8
**Dependencia:** S-073 (infraestrutura src/ui/ e cn())
**PRP:** 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)

---

## 1. Objetivo

- Reescrever `ReasoningBlock.tsx`, `ToolActivity.tsx` e `ToolResult.tsx`
- Usar `Collapsible` do shadcn para blocos colapsaveis (ReasoningBlock, ToolResult)
- Substituir todas as classes `ai-chat-*` por tokens Tailwind semanticos
- `PartRenderer.tsx` NAO eh alterado — eh logica pura de roteamento

---

## 2. Alteracoes

### 2.1 Arquivo: `apps/packages/ai-chat/src/parts/ReasoningBlock.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-reasoning`, `ai-chat-reasoning-header`, `ai-chat-reasoning-body`

**Depois:** Usar `Collapsible` do shadcn:

```tsx
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible";
import { cn } from "../lib/utils";

<Collapsible open={expanded} onOpenChange={setExpanded}>
  <div className="bg-muted/50 border border-border rounded-md text-sm overflow-hidden">
    <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full text-left font-medium text-muted-foreground hover:bg-muted cursor-pointer">
      <Brain className="h-3.5 w-3.5" />
      <span>Raciocinio</span>
      {expanded
        ? <ChevronDown className="h-3.5 w-3.5 ml-auto" />
        : <ChevronRight className="h-3.5 w-3.5 ml-auto" />
      }
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="max-h-96 overflow-y-auto px-3 py-3 text-muted-foreground whitespace-pre-wrap break-words border-t border-border">
        {content}
      </div>
    </CollapsibleContent>
  </div>
</Collapsible>
```

- Manter logica de `expanded` state
- Icones: `Brain`, `ChevronDown`, `ChevronRight` de lucide-react

### 2.2 Arquivo: `apps/packages/ai-chat/src/parts/ToolActivity.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-tool-activity`, `ai-chat-tool-activity-icon`, etc.

**Depois:**
```tsx
import { cn } from "../lib/utils";

<div className={cn("flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm", className)}>
  <span className="text-primary shrink-0">
    <Icon className="h-3.5 w-3.5" />
  </span>
  <span className="font-medium font-mono">{displayName}</span>
  <span className="ml-auto text-muted-foreground">
    {isActive
      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
      : <Check className="h-3.5 w-3.5 text-primary" />
    }
  </span>
</div>
```

**Decisao de design (D-010):** O check de ferramenta concluida usa `text-primary` em vez de `text-green-500`. Motivo: manter zero cor hardcoded. O token `text-primary` adapta ao tema do host, e o icone `Check` ja comunica semantica de sucesso visualmente. O `animate-spin` substitui a animacao CSS `ai-chat-spin`.

### 2.3 Arquivo: `apps/packages/ai-chat/src/parts/ToolResult.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-tool-result`, `ai-chat-tool-result--error`, etc.

**Depois:** Usar `Collapsible` do shadcn:
```tsx
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible";
import { cn } from "../lib/utils";

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

- Erros: `text-destructive` (token shadcn para vermelho semantico)
- Sucesso: `text-foreground` (cor padrao)
- Manter logica de `expanded` state e serializacao do resultado

### 2.4 Arquivo: `apps/packages/ai-chat/src/parts/PartRenderer.tsx` (NAO MODIFICAR)

PartRenderer eh logica pura de roteamento — nao tem UI propria. Nenhuma alteracao necessaria.

---

## 3. Regras de Implementacao

- **Substituir `clsx()` por `cn()`** em todos os componentes
- **Zero classe `ai-chat-*`** — todas removidas
- **Zero cor hardcoded** — usar tokens semanticos
- **Animacoes:** `animate-spin` (Tailwind built-in) substitui `ai-chat-spin`
- **Manter API publica** — props e exports identicos
- **Manter logica de state** — expanded/collapsed, isActive/isError

---

## 4. Criterios de Aceite

- [ ] ReasoningBlock usa `Collapsible` do shadcn — zero classe `ai-chat-reasoning`
- [ ] ReasoningBlock colapsa/expande corretamente
- [ ] ToolActivity usa tokens semanticos — zero classe `ai-chat-tool-activity`
- [ ] ToolActivity spinner funciona (`animate-spin`)
- [ ] ToolActivity check usa `text-primary` (zero cor hardcoded)
- [ ] ToolResult usa `Collapsible` do shadcn — zero classe `ai-chat-tool-result`
- [ ] ToolResult diferencia erro (`text-destructive`) de sucesso (`text-foreground`)
- [ ] ToolResult colapsa/expande corretamente
- [ ] PartRenderer NAO foi alterado
- [ ] Zero `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo
- [ ] API publica (props, exports) inalterada
