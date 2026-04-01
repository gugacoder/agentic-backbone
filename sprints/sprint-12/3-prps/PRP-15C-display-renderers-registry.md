# PRP-15C — Display Renderers e Registry

Criar os 19 componentes React que renderizam dados das display tools do ai-sdk e o registry que mapeia `toolName → componente`.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O ai-sdk (PRP-14A) emite 19 display tools com dados JSON tipados, mas nenhum app renderiza esses dados como componentes ricos:

- Nenhum dos 19 renderers existe como componente React portavel
- Nao existe mapa `toolName → componente` para resolucao dinamica
- Nao ha infraestrutura de override para consumidores customizarem renderers individuais

### Estado desejado

1. 8 renderers simples (Alert, Metric, Price, File, Code, Sources, Steps, Progress) — sem deps externas
2. 2 renderers com lib (Chart via recharts, Carousel via embla-carousel-react)
3. 9 renderers compostos (Product, Comparison, DataTable, Spreadsheet, Gallery, Image, Link, Map, Choices)
4. Registry `defaultDisplayRenderers` com mapa completo e `resolveDisplayRenderer()` com suporte a overrides

### Dependencias

- **PRP-15A** — scaffold, styles.css (CSS variables) devem existir
- **PRP-14A (ai-sdk)** — schemas Zod e tipos inferidos das 19 display tools

## Especificacao

### Feature F-187: 8 Display Renderers Simples

**Spec:** S-063

Criar 8 componentes em `apps/packages/ai-chat/src/display/`:

| Renderer | Tool | Descricao |
|----------|------|-----------|
| `AlertRenderer.tsx` | display_alert | Banner com icone por variante (info, warning, error, success), titulo e mensagem |
| `MetricCardRenderer.tsx` | display_metric | Card com label, value grande, unit, trend (seta + cor), icone opcional |
| `PriceHighlightRenderer.tsx` | display_price | Preco em destaque com `Intl.NumberFormat("pt-BR")`, label e fonte |
| `FileCardRenderer.tsx` | display_file | Card com icone por tipo, nome, tamanho formatado (KB/MB), link download |
| `CodeBlockRenderer.tsx` | display_code | Bloco de codigo com header (language + botao copiar), syntax highlighting |
| `SourcesListRenderer.tsx` | display_sources | Lista numerada com favicon, titulo clicavel e snippet |
| `StepTimelineRenderer.tsx` | display_steps | Timeline vertical com etapas e icones de status |
| `ProgressStepsRenderer.tsx` | display_progress | Barra de progresso com steps nomeados e percentual calculado |

Cada renderer:
- Props = tipo Zod inferido do schema correspondente (`DisplayAlert`, `DisplayMetric`, etc.) importado de `@agentic-backbone/ai-sdk`
- Deps: apenas React, lucide-react, clsx — nenhuma lib externa
- Classes CSS: `.ai-chat-display-{tipo}`
- Formatacao monetaria: `Intl.NumberFormat("pt-BR", { style: "currency", currency })` — nunca hardcodar

#### Regras

- Um componente por arquivo em `src/display/`
- Icones via lucide-react — nao instalar libs de icones adicionais

### Feature F-188: Display Renderers com Lib (Chart + Carousel)

**Spec:** S-064

**`ChartRenderer.tsx`** — display_chart:
- 5 tipos de grafico: bar, line, pie, area, donut (PieChart com innerRadius)
- `ResponsiveContainer` obrigatorio — nunca hardcodar width
- Height via CSS variable `--ai-chat-chart-height` (default 300px)
- Tooltip com formatacao (monetario, percentual, numerico) baseada em `format`
- Array de 8 cores padrao harmonizadas; `color` no data point tem prioridade
- Props: `DisplayChart`

**`CarouselRenderer.tsx`** — display_carousel:
- Embla carousel com drag/touch nativo
- Setas prev/next (escondidas mobile, visiveis desktop)
- Cards: imagem + titulo + subtitulo + preco opcional (BRL)
- Dots indicadores
- Responsivo: 1 card mobile, 2 tablet, 3 desktop
- Props: `DisplayCarousel`

#### Regras

- recharts e embla-carousel-react sao deps do pacote (declaradas no scaffold)
- Classes CSS `.ai-chat-display-chart-*` e `.ai-chat-display-carousel-*`
- Precos via `Intl.NumberFormat("pt-BR")` — consistente com F-187

### Feature F-189: 9 Display Renderers Compostos

**Spec:** S-065

Criar 9 componentes em `apps/packages/ai-chat/src/display/`:

| Renderer | Tool | Descricao |
|----------|------|-----------|
| `ProductCardRenderer.tsx` | display_product | Card com imagem, preco BRL, rating estrelas, badges, botao acao |
| `ComparisonTableRenderer.tsx` | display_comparison | Tabela lado a lado com destaque no melhor valor |
| `DataTableRenderer.tsx` | display_table | Tabela com colunas tipadas, sortavel por click no header |
| `SpreadsheetRenderer.tsx` | display_spreadsheet | Grid planilha readonly com formatacao monetaria/percentual |
| `GalleryRenderer.tsx` | display_gallery | Grid de imagens (grid/masonry), click abre ampliado |
| `ImageViewerRenderer.tsx` | display_image | Imagem unica com caption, dialog com zoom |
| `LinkPreviewRenderer.tsx` | display_link | Card preview de link com OG image, titulo, dominio |
| `MapViewRenderer.tsx` | display_map | Mapa via iframe OpenStreetMap com pins e lista |
| `ChoiceButtonsRenderer.tsx` | display_choices | Botoes/cards clicaveis, 3 variantes (buttons, cards, list) |

Detalhes de implementacao:
- **DataTable sort:** estado local, sem lib de tabela
- **MapView:** iframe OSM — sem Google Maps ou Mapbox
- **ImageViewer/Gallery:** dialog nativo com `<dialog>` — sem lib de modal
- **ChoiceButtons:** callback `onChoiceSelect(value)` como prop opcional; decorativo quando ausente
- **Formatacao monetaria** consistente via `Intl.NumberFormat("pt-BR")`

#### Regras

- Props = tipo Zod inferido de `@agentic-backbone/ai-sdk`
- Nenhuma dependencia externa adicional (dialog nativo, iframe OSM)
- Classes CSS `.ai-chat-display-{tipo}-*`

### Feature F-190: Display Registry

**Spec:** S-067

**`src/display/index.ts`** — barrel export de todos os 19 renderers.

**`src/display/registry.ts`:**

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
  return overrides?.[toolName as DisplayToolName]
    ?? defaultDisplayRenderers[toolName as DisplayToolName];
}
```

#### Regras

- Chaves do registry = chaves do `DisplayToolRegistry` do ai-sdk — correspondencia 1:1
- `DisplayRendererMap` eh `Partial` — consumidor override de subset
- `resolveDisplayRenderer` retorna `undefined` se nao encontrado (caller decide fallback)

## Limites

- **NAO** criar componentes de chat (MessageBubble, PartRenderer, Chat) — responsabilidade dos PRP-15B e PRP-15D
- **NAO** instalar Google Maps, Mapbox ou qualquer provedor de mapas — usar iframe OSM
- **NAO** instalar libs de modal — usar dialog nativo
- **NAO** instalar react-table — sort local com estado interno
- **NAO** criar schemas Zod — usar os existentes no ai-sdk (PRP-14A)

## Validacao

- [ ] 19 arquivos de renderer existem em `src/display/`
- [ ] AlertRenderer diferencia 4 variantes visuais
- [ ] MetricCardRenderer exibe trend com seta e cor
- [ ] PriceHighlightRenderer formata BRL via Intl.NumberFormat
- [ ] CodeBlockRenderer tem botao copiar funcional
- [ ] SourcesListRenderer renderiza favicons e links clicaveis
- [ ] StepTimelineRenderer diferencia status das etapas
- [ ] ProgressStepsRenderer calcula percentual automaticamente
- [ ] ChartRenderer renderiza 5 tipos de grafico (bar, line, pie, area, donut)
- [ ] Charts responsivos via ResponsiveContainer
- [ ] CarouselRenderer funciona com drag/touch e setas
- [ ] ProductCardRenderer exibe preco BRL e rating estrelas
- [ ] ComparisonTableRenderer renderiza N produtos lado a lado
- [ ] DataTableRenderer sortavel por click no header
- [ ] GalleryRenderer suporta grid e masonry
- [ ] ImageViewerRenderer abre em dialog com zoom
- [ ] MapViewRenderer renderiza mapa OSM com pins
- [ ] ChoiceButtonsRenderer suporta 3 variantes de layout
- [ ] `defaultDisplayRenderers` mapeia todas as 19 `DisplayToolName`
- [ ] `resolveDisplayRenderer` prioriza overrides sobre defaults
- [ ] `display/index.ts` reexporta todos os 19 renderers
- [ ] Correspondencia 1:1 entre registry e `DisplayToolRegistry` do ai-sdk
- [ ] Nenhuma dep externa adicional alem de recharts e embla-carousel-react
- [ ] Exports no `index.ts` do pacote
- [ ] Typecheck passa

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-187 8 Display Renderers Simples | S-063 | AC-008 |
| F-188 Chart + Carousel | S-064 | AC-009 |
| F-189 9 Display Renderers Compostos | S-065 | AC-010 |
| F-190 Display Registry | S-067 | AC-012 |
