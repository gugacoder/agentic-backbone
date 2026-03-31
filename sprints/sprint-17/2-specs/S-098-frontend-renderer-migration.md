# S-098 — Frontend: Migrar Renderer de `toolName` para `action`

Atualizar o registry de renderers e o PartRenderer para resolver componentes pelo campo `action` do result (em vez de `toolName`), compatibilizando o frontend com as 4 domain tools.

**Resolve:** D-007 (registry.ts por action), D-008 (PartRenderer por action)
**Score de prioridade:** 7
**Dependência:** S-095 (domain tools consolidados)
**PRP:** 23 — Rich Response: Display Domain Tools + Ativação por Cliente

---

## 1. Objetivo

Após S-095, os nomes de tool passam de 19 individuais (`display_metric`, `display_chart`, etc.) para 4 domain tools (`display_highlight`, `display_collection`, `display_card`, `display_visual`). O componente correto para renderizar o resultado é determinado pelo campo `action` dentro do `result`, não mais pelo `toolName`.

O frontend atual mapeia `toolName → Renderer`. Esta spec migra para `action → Renderer`.

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/display/registry.ts` (REESCREVER mapeamento)

#### 2.1.1 Novo tipo `DisplayActionName`

Substituir o tipo de chave do mapa de renderers:

**Antes:**
```typescript
// Mapa usa DisplayToolName (display_metric, display_chart, etc.)
```

**Depois:**
```typescript
/** Nomes das actions dos display domain tools */
export type DisplayActionName =
  | "metric" | "price" | "alert" | "choices"
  | "table" | "spreadsheet" | "comparison" | "carousel" | "gallery" | "sources"
  | "product" | "link" | "file" | "image"
  | "chart" | "map" | "code" | "progress" | "steps";
```

#### 2.1.2 Novo `defaultDisplayRenderers`

O mapa passa a usar action names como chave:

```typescript
export const defaultDisplayRenderers: Record<DisplayActionName, ComponentType<any>> = {
  // highlight
  metric: MetricCard,
  price: PriceHighlight,
  alert: Alert,
  choices: ChoiceButtons,
  // collection
  table: DataTable,
  spreadsheet: Spreadsheet,
  comparison: ComparisonTable,
  carousel: Carousel,
  gallery: Gallery,
  sources: SourcesList,
  // card
  product: ProductCard,
  link: LinkPreview,
  file: FileCard,
  image: ImageViewer,
  // visual
  chart: Chart,
  map: MapView,
  code: CodeBlock,
  progress: ProgressSteps,
  steps: StepTimeline,
};
```

**Nota:** Os componentes importados (MetricCard, PriceHighlight, etc.) **não mudam** — apenas as chaves do mapa mudam.

#### 2.1.3 Atualizar `resolveDisplayRenderer()`

**Antes:**
```typescript
export function resolveDisplayRenderer(
  toolName: string,
  overrides?: Partial<Record<string, ComponentType<any>>>
): ComponentType<any> | null {
  // Busca por toolName (ex: "display_metric")
}
```

**Depois:**
```typescript
export function resolveDisplayRenderer(
  action: string,
  overrides?: Partial<Record<string, ComponentType<any>>>
): ComponentType<any> | null {
  if (overrides?.[action]) return overrides[action]!;
  return (defaultDisplayRenderers as Record<string, ComponentType<any>>)[action] ?? null;
}
```

O parâmetro muda de `toolName` para `action`. A lógica de lookup é a mesma — busca em overrides primeiro, depois no mapa default.

### 2.2 Arquivo: `apps/packages/ai-chat/src/parts/PartRenderer.tsx`

#### 2.2.1 Resolver renderer por `action`

Na lógica de display tool rendering (linhas ~140-152):

**Antes:**
```typescript
if (part.toolName.startsWith("display_") && ...) {
  const Renderer = resolveDisplayRenderer(part.toolName, displayRenderers);
  // ...
}
```

**Depois:**
```typescript
if (part.toolName.startsWith("display_") && part.state === "result" && part.result) {
  const action = (part.result as Record<string, unknown>).action as string;
  const Renderer = resolveDisplayRenderer(action, displayRenderers);
  if (Renderer) {
    // ...render com LazyRender se necessário...
    return <Renderer {...part.result} />;
  }
}
```

**Pontos-chave:**
- O check `toolName.startsWith("display_")` continua correto — as 4 domain tools mantêm o prefixo
- O `action` é extraído de `part.result.action` (string)
- Se `action` não tem renderer mapeado, retorna `null` (fallback existente do PartRenderer)

#### 2.2.2 Handling de estado `partial` / streaming

Durante streaming (`state !== "result"`), a tool invocation ainda não tem `result`. Manter o behavior existente para estados parciais — exibir indicador de loading/spinner. O renderer só é chamado quando `state === "result"`.

---

## 3. Regras de Implementação

- NÃO alterar os componentes de renderer (MetricCard, DataTable, etc.) — eles continuam recebendo as mesmas props
- NÃO remover o tipo `DisplayToolName` de `display-schemas.ts` — ele permanece para tipagem dos schemas
- O tipo `DisplayActionName` é exportado de `registry.ts` para uso em overrides tipados
- O `resolveDisplayRenderer` deve aceitar qualquer string (para suportar overrides customizados), mas o mapa default só contém as 19 actions

---

## 4. Critérios de Aceite

- [ ] `defaultDisplayRenderers` mapeia 19 action names para os 19 componentes existentes
- [ ] `resolveDisplayRenderer(action, overrides)` aceita action name (não toolName)
- [ ] `PartRenderer` extrai `action` de `part.result.action` para resolver o renderer
- [ ] Prefixo `display_` continua sendo usado para identificar display tools
- [ ] Componentes de renderer não foram alterados
- [ ] Build do ai-chat compila sem erros
- [ ] Tipo `DisplayActionName` é exportado de `registry.ts`
