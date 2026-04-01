# Mapa de Componentes — Display Tools

Referência para implementadores de frontend: mapeamento de cada display tool ao componente React sugerido e às libs recomendadas.

> **Nota:** Os componentes listados são **sugestões de nomeação**, não implementações. O app consumidor é responsável por criar ou importar esses componentes. A coluna "Libs recomendadas" indica bibliotecas que facilitam a implementação.

---

## Tabela de referência

| Display Tool | Componente sugerido | Libs recomendadas |
|---|---|---|
| `display_metric` | `<MetricCard />` | — |
| `display_chart` | `<Chart />` | recharts |
| `display_table` | `<DataTable />` | @tanstack/react-table |
| `display_progress` | `<ProgressSteps />` | — |
| `display_product` | `<ProductCard />` | — |
| `display_comparison` | `<ComparisonTable />` | — |
| `display_price` | `<PriceHighlight />` | — |
| `display_image` | `<ImageViewer />` | — |
| `display_gallery` | `<ImageGallery />` | — |
| `display_carousel` | `<Carousel />` | embla-carousel-react |
| `display_sources` | `<SourcesList />` | — |
| `display_link` | `<LinkPreview />` | — |
| `display_map` | `<MapView />` | react-leaflet |
| `display_file` | `<FileCard />` | — |
| `display_code` | `<CodeBlock />` | shiki, react-syntax-highlighter |
| `display_spreadsheet` | `<Spreadsheet />` | @tanstack/react-table |
| `display_steps` | `<StepTimeline />` | — |
| `display_alert` | `<Alert />` | shadcn/ui Alert |
| `display_choices` | `<ChoiceButtons />` | shadcn/ui Button, shadcn/ui Card |

---

## Notas de implementação por componente

### `<MetricCard />` — `display_metric`

Props mínimas: `label`, `value`. Opcionais: `unit`, `trend`, `icon`.

Para `trend.direction`:
- `"up"` → seta verde para cima
- `"down"` → seta vermelha para baixo
- `"neutral"` → traço cinza

```tsx
<MetricCard
  label="Receita mensal"
  value={128500}
  unit="BRL"
  trend={{ direction: "up", value: "+12,3%" }}
/>
```

---

### `<Chart />` — `display_chart`

Encapsula um dos tipos de gráfico Recharts conforme `type`. Tipos suportados: `bar`, `line`, `pie`, `area`, `donut`.

Lib recomendada: **recharts** (`npm install recharts`)

```tsx
import { BarChart, Bar, LineChart, PieChart } from "recharts";
```

---

### `<DataTable />` — `display_table`

Suporte a tipos de coluna: `text`, `number`, `money`, `image`, `link`, `badge`. O campo `sortable: true` habilita ordenação por coluna.

Lib recomendada: **@tanstack/react-table** (`npm install @tanstack/react-table`)

---

### `<ProgressSteps />` — `display_progress`

Exibe passos com ícone de status. Status `completed` → check verde, `current` → círculo preenchido, `pending` → círculo vazio.

Sem lib externa necessária.

---

### `<ProductCard />` — `display_product`

Card vertical com imagem no topo, badges sobrepostos, preço com tachado para `originalPrice`, estrelas para `rating`, e link externo.

Sem lib externa necessária.

---

### `<ComparisonTable />` — `display_comparison`

Cada `item` em `items` vira uma coluna. Os `attributes` listam as linhas comparadas. Renderiza `<ProductCard />` compacto no header de cada coluna.

---

### `<PriceHighlight />` — `display_price`

Destaque grande do valor, com `label` abaixo, `context` como subtexto, `source` como link e `badge` como chip colorido.

---

### `<ImageViewer />` — `display_image`

Imagem com `object-fit: cover`, `alt` para acessibilidade e `caption` abaixo em texto menor.

---

### `<ImageGallery />` — `display_gallery`

`layout: "grid"` → CSS Grid com `columns` colunas. `layout: "masonry"` → CSS Columns ou masonry grid.

---

### `<Carousel />` — `display_carousel`

Scroll horizontal com snap. Cada `item` renderiza `<ProductCard />` compacto.

Lib recomendada: **embla-carousel-react** (`npm install embla-carousel-react`)

---

### `<SourcesList />` — `display_sources`

Lista de links com favicon (via `<img>` ou emoji de fallback), título clicável e snippet em texto menor.

---

### `<LinkPreview />` — `display_link`

Card horizontal: imagem à esquerda (opcional), título em negrito, descrição, domínio em cinza.

---

### `<MapView />` — `display_map`

Mapa interativo com pins. `zoom` configura o nível inicial. Cada pin exibe `label` e `address` em tooltip.

Lib recomendada: **react-leaflet** (`npm install react-leaflet leaflet`)

> Alternativa sem lib: embed de Google Maps Static API (somente visualização).

---

### `<FileCard />` — `display_file`

Card horizontal com ícone de tipo de arquivo, `name`, `size` formatado (KB/MB) e botão de download se `url` disponível. `preview` exibe trecho de texto se presente.

---

### `<CodeBlock />` — `display_code`

Bloco com barra de título, botão de copiar, syntax highlighting por `language` e números de linha se `lineNumbers: true`.

Libs recomendadas:
- **shiki** (`npm install shiki`) — highlighting server-side/SSR
- **react-syntax-highlighter** (`npm install react-syntax-highlighter`) — alternativa client-side

---

### `<Spreadsheet />` — `display_spreadsheet`

Tabela com headers fixos e cells formatadas conforme `format.moneyColumns` (R$ x.xxx,xx) e `format.percentColumns` (xx,x%).

Lib recomendada: **@tanstack/react-table** (`npm install @tanstack/react-table`)

---

### `<StepTimeline />` — `display_steps`

`orientation: "vertical"` → lista com linha conectora. `orientation: "horizontal"` → barra de progresso com steps numerados.

Status: `completed` → check, `current` → spinner ou ponto pulsante, `pending` → círculo vazio.

---

### `<Alert />` — `display_alert`

Componente nativo do shadcn/ui. Mapeamento de variante:

| `variant` | shadcn variant | Cor |
|---|---|---|
| `info` | `default` | Azul/neutro |
| `warning` | `destructive` ou custom | Amarelo |
| `error` | `destructive` | Vermelho |
| `success` | custom | Verde |

Lib recomendada: **shadcn/ui Alert** — `npx shadcn@latest add alert`

---

### `<ChoiceButtons />` — `display_choices`

`layout: "buttons"` → botões horizontais. `layout: "cards"` → cards clicáveis com `description`. `layout: "list"` → lista vertical.

Ao clicar, enviar o `id` da escolha ao backend via `append({ role: "user", content: choice.label })`.

Libs recomendadas: **shadcn/ui Button**, **shadcn/ui Card** — `npx shadcn@latest add button card`

---

## Dispatcher central

Padrão recomendado para despachar display tools para o renderer correto:

```tsx
import type { ToolInvocation } from "ai";

const DISPLAY_RENDERERS: Record<string, React.ComponentType<any>> = {
  display_metric: MetricCard,
  display_chart: Chart,
  display_table: DataTable,
  display_progress: ProgressSteps,
  display_product: ProductCard,
  display_comparison: ComparisonTable,
  display_price: PriceHighlight,
  display_image: ImageViewer,
  display_gallery: ImageGallery,
  display_carousel: Carousel,
  display_sources: SourcesList,
  display_link: LinkPreview,
  display_map: MapView,
  display_file: FileCard,
  display_code: CodeBlock,
  display_spreadsheet: Spreadsheet,
  display_steps: StepTimeline,
  display_alert: Alert,
  display_choices: ChoiceButtons,
};

export function DisplayToolDispatcher({ invocation }: { invocation: ToolInvocation }) {
  if (invocation.state !== "result") return null;

  const { toolName, result } = invocation;
  const { _display, ...props } = result as Record<string, unknown>;

  if (!toolName.startsWith("display_") || !_display) return null;

  const Component = DISPLAY_RENDERERS[toolName];

  if (!Component) {
    // Fallback: JSON formatado
    return (
      <div className="rounded border p-3 text-sm font-mono bg-muted">
        <p className="text-xs text-muted-foreground mb-2">{toolName}</p>
        <pre>{JSON.stringify(props, null, 2)}</pre>
      </div>
    );
  }

  return <Component {...props} />;
}
```

---

## Referências

- **Schemas Zod:** `apps/packages/ai-sdk/src/display-schemas.ts`
- **JSON Schema completo:** `guides/rich-content/schemas.json`
- **Exemplos canônicos:** `guides/rich-content/examples.json`
- **Guia de integração:** `guides/rich-content/GUIDE.md`
