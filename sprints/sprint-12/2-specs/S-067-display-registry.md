# S-067 — Display Registry

Mapa `toolName → componente React` com todos os 19 renderers registrados e suporte a override.

**Resolve:** AC-012 (registry.ts + display/index.ts ausentes)
**Score de prioridade:** 8
**Dependência:** S-063 (renderers simples), S-064 (renderers lib), S-065 (renderers compostos)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `registry.ts` — mapa `defaultDisplayRenderers` que associa cada `DisplayToolName` ao componente React
- Criar `display/index.ts` — barrel export de todos os renderers
- Exportar tipo `DisplayRendererMap` para que consumidores possam definir overrides parciais
- Função `resolveDisplayRenderer(toolName, overrides?)` que retorna o componente correto

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/display/index.ts` (NOVO)

Barrel export de todos os 19 renderers:

```typescript
export { AlertRenderer } from "./AlertRenderer.js";
export { MetricCardRenderer } from "./MetricCardRenderer.js";
export { PriceHighlightRenderer } from "./PriceHighlightRenderer.js";
// ... todos os 19
```

### 2.2 Arquivo: `apps/packages/ai-chat/src/display/registry.ts` (NOVO)

```typescript
import type { ComponentType } from "react";
import type { DisplayToolName } from "@agentic-backbone/ai-sdk";

export type DisplayRendererMap = Partial<Record<DisplayToolName, ComponentType<any>>>;

export const defaultDisplayRenderers: Record<DisplayToolName, ComponentType<any>> = {
  display_alert: AlertRenderer,
  display_metric: MetricCardRenderer,
  display_price: PriceHighlightRenderer,
  display_file: FileCardRenderer,
  display_code: CodeBlockRenderer,
  display_sources: SourcesListRenderer,
  display_steps: StepTimelineRenderer,
  display_progress: ProgressStepsRenderer,
  display_chart: ChartRenderer,
  display_carousel: CarouselRenderer,
  display_product: ProductCardRenderer,
  display_comparison: ComparisonTableRenderer,
  display_table: DataTableRenderer,
  display_spreadsheet: SpreadsheetRenderer,
  display_gallery: GalleryRenderer,
  display_image: ImageViewerRenderer,
  display_link: LinkPreviewRenderer,
  display_map: MapViewRenderer,
  display_choices: ChoiceButtonsRenderer,
};

export function resolveDisplayRenderer(
  toolName: string,
  overrides?: DisplayRendererMap
): ComponentType<any> | undefined {
  return overrides?.[toolName as DisplayToolName] ?? defaultDisplayRenderers[toolName as DisplayToolName];
}
```

### 2.3 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `defaultDisplayRenderers`, `resolveDisplayRenderer`, `DisplayRendererMap`.

---

## 3. Regras de Implementação

- **Chaves do registry = chaves do `DisplayToolRegistry`** do ai-sdk — correspondência 1:1
- **`ComponentType<any>`** — renderers são genéricos, props validados nos próprios componentes
- **Override é parcial** — consumidor só precisa definir os renderers que quer customizar
- **`resolveDisplayRenderer`** retorna `undefined` se não encontrado (caller decide fallback)

---

## 4. Critérios de Aceite

- [ ] `defaultDisplayRenderers` mapeia todas as 19 `DisplayToolName` para componentes React
- [ ] `resolveDisplayRenderer` prioriza overrides sobre defaults
- [ ] `DisplayRendererMap` é `Partial` — permite override de subset
- [ ] `display/index.ts` reexporta todos os 19 renderers
- [ ] Correspondência 1:1 entre chaves do registry e `DisplayToolRegistry` do ai-sdk
- [ ] Exports no `index.ts` do pacote
