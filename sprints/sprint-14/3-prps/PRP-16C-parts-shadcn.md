# PRP-16C — Parts com shadcn/ui

Reescrever os 3 componentes visuais de parts (ReasoningBlock, ToolActivity, ToolResult) usando Collapsible do shadcn e tokens Tailwind semanticos.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Os 3 componentes visuais de parts usam classes CSS BEM (`ai-chat-reasoning-*`, `ai-chat-tool-activity-*`, `ai-chat-tool-result-*`) e animacoes CSS customizadas (`ai-chat-spin`). Blocos colapsaveis sao implementados com HTML/CSS puro.

### Estado desejado

1. `ReasoningBlock` e `ToolResult` usam `Collapsible` do shadcn para colapse/expande
2. `ToolActivity` usa tokens semanticos — spinner via `animate-spin` do Tailwind
3. Zero classe `ai-chat-*`, zero animacao CSS customizada
4. Decisao D-010: check de tool concluida usa `text-primary` (zero cor hardcoded)

### Dependencias

- **PRP-16A** — `src/ui/collapsible.tsx` e `src/lib/utils.ts` devem existir

## Especificacao

### Feature F-209: ReasoningBlock.tsx

**Spec:** S-075

Substituir classes `ai-chat-reasoning-*` por `Collapsible` do shadcn:

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

#### Regras

- Manter logica de `expanded` state e auto-colapso apos streaming
- Icones: `Brain`, `ChevronDown`, `ChevronRight` de lucide-react

### Feature F-210: ToolActivity.tsx

**Spec:** S-075

Substituir classes `ai-chat-tool-activity-*` por tokens semanticos:

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

**Decisao D-010:** O check de ferramenta concluida usa `text-primary` em vez de `text-green-500`. O token `text-primary` adapta ao tema do host, e o icone `Check` ja comunica semantica de sucesso visualmente. `animate-spin` substitui `ai-chat-spin`.

### Feature F-211: ToolResult.tsx

**Spec:** S-075

Substituir classes `ai-chat-tool-result-*` por `Collapsible` do shadcn:

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

#### Regras

- Manter logica de `expanded` state e serializacao do resultado

## Limites

- **NAO** alterar `PartRenderer.tsx` — eh logica pura de roteamento, sem UI
- **NAO** deletar `styles.css` — sera feito no PRP-16F

## Validacao

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

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-209 ReasoningBlock.tsx | S-075 | D-005 |
| F-210 ToolActivity.tsx | S-075 | D-005, D-010 |
| F-211 ToolResult.tsx | S-075 | D-005 |
