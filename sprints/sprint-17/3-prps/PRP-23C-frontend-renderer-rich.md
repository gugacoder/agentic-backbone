# PRP-23C — Frontend: Renderer por Action + enableRichContent

Migrar o registry de renderers e o PartRenderer para resolver componentes pelo campo `action` (em vez de `toolName`), e adicionar `enableRichContent` ao hook `useBackboneChat` para ativar rich content automaticamente.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O frontend mapeia `toolName → Renderer` no registry (`display/registry.ts`). Com as 19 tools individuais, cada `toolName` era único (ex: `display_metric` → `MetricCard`). Após PRP-23A, os toolNames passam a ser apenas 4 domain tools (`display_highlight`, etc.) — o componente correto depende do campo `action` dentro do `result`.

O hook `useBackboneChat` não envia `rich=true` — display tools nunca são ativadas pelo ai-chat.

### Estado desejado

- Registry mapeia `action → Renderer` (19 action names → 19 componentes)
- `PartRenderer` extrai `action` de `part.result.action` para resolver o renderer
- `useBackboneChat` envia `&rich=true` por default via opção `enableRichContent`

### Dependencias

- **PRP-23A** — domain tools consolidados (4 em vez de 19)

## Especificacao

### Feature F-347: Migrar registry para action-based

**Spec:** S-098 seção 2.1

Reescrever mapeamento em `apps/packages/ai-chat/src/display/registry.ts`.

#### 1. Novo tipo `DisplayActionName`

```typescript
export type DisplayActionName =
  | "metric" | "price" | "alert" | "choices"
  | "table" | "spreadsheet" | "comparison" | "carousel" | "gallery" | "sources"
  | "product" | "link" | "file" | "image"
  | "chart" | "map" | "code" | "progress" | "steps";
```

#### 2. Novo `defaultDisplayRenderers`

O mapa usa action names como chave:

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

Os componentes importados **não mudam** — apenas as chaves do mapa.

#### 3. Atualizar `resolveDisplayRenderer()`

```typescript
export function resolveDisplayRenderer(
  action: string,
  overrides?: Partial<Record<string, ComponentType<any>>>
): ComponentType<any> | null {
  if (overrides?.[action]) return overrides[action]!;
  return (defaultDisplayRenderers as Record<string, ComponentType<any>>)[action] ?? null;
}
```

Parâmetro muda de `toolName` para `action`. Lookup idêntico.

### Feature F-348: Atualizar PartRenderer para resolver por action

**Spec:** S-098 seção 2.2

Em `apps/packages/ai-chat/src/parts/PartRenderer.tsx`, na lógica de display tool rendering (linhas ~140-152):

**Antes:**
```typescript
if (part.toolName.startsWith("display_") && ...) {
  const Renderer = resolveDisplayRenderer(part.toolName, displayRenderers);
}
```

**Depois:**
```typescript
if (part.toolName.startsWith("display_") && part.state === "result" && part.result) {
  const action = (part.result as Record<string, unknown>).action as string;
  const Renderer = resolveDisplayRenderer(action, displayRenderers);
  if (Renderer) {
    return <Renderer {...part.result} />;
  }
}
```

- O check `toolName.startsWith("display_")` continua correto — as 4 domain tools mantêm o prefixo
- O `action` é extraído de `part.result.action`
- Se `action` não tem renderer mapeado, retorna `null` (fallback existente)
- Durante streaming (`state !== "result"`), manter behavior existente (loading/spinner)

### Feature F-349: enableRichContent no useBackboneChat

**Spec:** S-099

Em `apps/packages/ai-chat/src/hooks/useBackboneChat.ts`:

#### 1. Interface `UseBackboneChatOptions`

Adicionar campo:

```typescript
export interface UseBackboneChatOptions {
  endpoint: string;
  token: string;
  sessionId: string;
  initialMessages?: Message[];
  /** Habilita rich content (display tools). Default: true */
  enableRichContent?: boolean;
}
```

#### 2. Construção da URL

```typescript
api: `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/messages?format=datastream${options.enableRichContent !== false ? "&rich=true" : ""}`,
```

A lógica `!== false` garante default `true` — se o campo não for passado (undefined), rich content é habilitado.

#### Regras

- Default é `true` — rich content habilitado por padrão no ai-chat
- NÃO adicionar lógica de ativação em outros hooks (useSSE, etc.)
- NÃO alterar o `buildAttachmentUrl`
- NÃO alterar os componentes de renderer (MetricCard, DataTable, etc.)
- NÃO remover o tipo `DisplayToolName` de `display-schemas.ts`
- Tipo `DisplayActionName` deve ser exportado de `registry.ts`

## Limites

- **NÃO** alterar componentes de renderer — eles recebem as mesmas props
- **NÃO** remover `DisplayToolName` de `display-schemas.ts` — permanece para tipagem
- **NÃO** criar renderers novos — os 19 componentes existentes são reutilizados
- **NÃO** alterar o ai-sdk ou backbone — isso é responsabilidade dos PRPs 23A e 23B

## Validacao

- [ ] `defaultDisplayRenderers` mapeia 19 action names para os 19 componentes existentes
- [ ] `resolveDisplayRenderer(action, overrides)` aceita action name (não toolName)
- [ ] `PartRenderer` extrai `action` de `part.result.action` para resolver o renderer
- [ ] Prefixo `display_` continua sendo usado para identificar display tools
- [ ] Componentes de renderer não foram alterados
- [ ] Tipo `DisplayActionName` exportado de `registry.ts`
- [ ] `UseBackboneChatOptions` tem campo `enableRichContent?: boolean`
- [ ] URL inclui `&rich=true` quando `enableRichContent` é `true` ou `undefined`
- [ ] URL NÃO inclui `&rich=true` quando `enableRichContent` é `false`
- [ ] Nenhum caller existente de `useBackboneChat` quebra
- [ ] Build do ai-chat compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-347 registry action-based | S-098 | D-007 |
| F-348 PartRenderer por action | S-098 | D-008 |
| F-349 enableRichContent | S-099 | D-009 |
