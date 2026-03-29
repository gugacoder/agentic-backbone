# PRP-14A — Display Tools: Schemas, Tools e Exports no ai-sdk

Criar os 19 schemas Zod das display tools, registra-las como Vercel AI SDK `tool()` no agente, e exportar schemas/tipos no barrel export do ai-sdk.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Apos PRP 13 (Rich Stream), o ai-sdk emite eventos tipados (`reasoning`, `tool-call`, `tool-result`, `text`, `step_finish`) via `fullStream`. Porem:

- `display-schemas.ts` nao existe — nenhum schema Zod de display tool
- `tools/display.ts` nao existe — nenhuma display tool registrada como AI SDK `tool()`
- `index.ts` nao exporta schemas/tipos de display — apps consumidores nao conseguem importar
- `agent.ts` so tem `codingTools` e `mcpTools` — o modelo nao tem como emitir conteudo estruturado

### Estado desejado

1. Arquivo `display-schemas.ts` com 4 primitivos e 19 schemas Zod, registry e tipos inferidos
2. Arquivo `tools/display.ts` com `createDisplayTools()` retornando 19 tools Vercel AI SDK
3. `agent.ts` mergeia display tools em `allTools` — modelo ve as 19 tools no system prompt
4. `index.ts` re-exporta todos os schemas, tipos e o registry para apps consumidores

### Dependencias

- **PRP 13 (Rich Stream)** — ja implementado (F-171, F-173). Stream rico com `tool-call`/`tool-result` funciona
- **Nenhuma dependencia de PRP-14B** — este PRP eh auto-contido no pacote ai-sdk

## Especificacao

### Feature F-174: Display Schemas Zod

**Spec:** S-050

Criar `apps/packages/ai-sdk/src/display-schemas.ts` com:

#### Primitivos reutilizaveis (const, nao exportados)

```typescript
import { z } from "zod";

const MoneySchema = z.object({
  value: z.number(),
  currency: z.string().default("BRL"),
});

const SourceRefSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  favicon: z.string().url().optional(),
});

const ImageItemSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

const BadgeSchema = z.object({
  label: z.string(),
  variant: z.enum(["default", "success", "warning", "error", "info"]).default("default"),
});
```

#### 19 Display Tool Schemas (6 categorias)

**Categoria 1 — Metricas e Dados:**

| Schema | Descricao |
|--------|-----------|
| `DisplayMetricSchema` | KPI com label, value, unit, trend (direction + value), icon |
| `DisplayChartSchema` | Grafico (bar, line, pie, area, donut) com data points e format |
| `DisplayTableSchema` | Tabela rica com colunas tipadas (text, number, money, image, link, badge) |
| `DisplayProgressSchema` | Barra de progresso com steps nomeados e status |

**Categoria 2 — Produtos e Comercio:**

| Schema | Descricao |
|--------|-----------|
| `DisplayProductSchema` | Card de produto com image, price, rating, source, badges |
| `DisplayComparisonSchema` | Comparacao lado a lado de produtos com atributos |
| `DisplayPriceSchema` | Preco em destaque com label, contexto e fonte |

**Categoria 3 — Midia:**

| Schema | Descricao |
|--------|-----------|
| `DisplayImageSchema` | Imagem unica com caption, width, height |
| `DisplayGallerySchema` | Grid de imagens com layout (grid/masonry) e colunas |
| `DisplayCarouselSchema` | Carrossel horizontal de cards com image, title, subtitle, price |

**Categoria 4 — Referencias e Navegacao:**

| Schema | Descricao |
|--------|-----------|
| `DisplaySourcesSchema` | Lista de fontes consultadas com favicon e snippet |
| `DisplayLinkSchema` | Preview de link com OG image, title, description |
| `DisplayMapSchema` | Mapa com pins geolocalizados (lat, lng, label, address) |

**Categoria 5 — Documentos e Arquivos:**

| Schema | Descricao |
|--------|-----------|
| `DisplayFileSchema` | Card de arquivo com name, type, size, url, preview |
| `DisplayCodeSchema` | Bloco de codigo com language, syntax highlighting |
| `DisplaySpreadsheetSchema` | Planilha com headers, rows, formatacao monetaria/percentual |

**Categoria 6 — Interativo:**

| Schema | Descricao |
|--------|-----------|
| `DisplayStepsSchema` | Timeline/checklist com etapas e orientacao (vertical/horizontal) |
| `DisplayAlertSchema` | Banner de alerta (info, warning, error, success) |
| `DisplayChoicesSchema` | Opcoes clicaveis (buttons, cards, list) |

Os schemas completos estao definidos no PRP-14 milestone (`sprints/milestones/14-rich-content/PRP.md`, secao 1.1). Implementar exatamente como especificado.

#### Registry e tipos

```typescript
export const DisplayToolRegistry = {
  display_metric: DisplayMetricSchema,
  display_chart: DisplayChartSchema,
  // ...19 entries com prefixo display_
} as const;

export type DisplayToolName = keyof typeof DisplayToolRegistry;

// Tipos inferidos — um por schema
export type DisplayMetric = z.infer<typeof DisplayMetricSchema>;
// ...19 tipos
```

#### Regras

- Arquivo unico — todos os 19 schemas no mesmo arquivo
- Primitivos sao `const` nao exportados — usados internamente
- Nomes seguem `Display{Tipo}Schema`
- Registry usa prefixo `display_` — permite identificacao no stream sem lista hardcoded

### Feature F-175: Display Tools como Vercel AI SDK tool()

**Spec:** S-051

Criar `apps/packages/ai-sdk/src/tools/display.ts` com `createDisplayTools()`:

```typescript
import { tool } from "ai";
import { DisplayMetricSchema, /* ...todos */ } from "../display-schemas.js";

export function createDisplayTools() {
  return {
    display_metric: tool({
      description: "Exibe um KPI/metrica em destaque com valor grande, label e tendencia opcional. Use para destacar um numero importante.",
      parameters: DisplayMetricSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    // ...demais 18 tools
  };
}
```

**Padrao de cada tool:**
- `description` — Frase em pt-BR descrevendo o que a tool exibe e quando usar
- `parameters` — Schema Zod importado de `display-schemas.ts`
- `execute` — `async (args) => ({ ...args, _display: true })` — retorna args validados com flag `_display: true`

Descriptions completas das 19 tools estao no PRP-14 milestone (secao 2.1). Implementar exatamente como especificado.

**Registro em `agent.ts`:**

Importar `createDisplayTools()` e mergear no `allTools`:

```typescript
import { createDisplayTools } from "./tools/display.js";

const displayTools = createDisplayTools();
const allTools = { ...codingTools, ...displayTools, ...mcpTools, ...options.tools };
```

- Display tools vem **depois** de `codingTools` e **antes** de `mcpTools` no spread
- Nenhum guard condicional por modo — display tools disponiveis em todos os modos
- Nao alterar assinatura de `runAiAgent()`

### Feature F-176: Display Exports no index.ts

**Spec:** S-052

Adicionar re-exports em `apps/packages/ai-sdk/src/index.ts`:

```typescript
export {
  DisplayToolRegistry,
  type DisplayToolName,
  // 19 Schemas
  DisplayMetricSchema, DisplayChartSchema, DisplayTableSchema,
  DisplayProgressSchema, DisplayProductSchema, DisplayComparisonSchema,
  DisplayPriceSchema, DisplayImageSchema, DisplayGallerySchema,
  DisplayCarouselSchema, DisplaySourcesSchema, DisplayLinkSchema,
  DisplayMapSchema, DisplayFileSchema, DisplayCodeSchema,
  DisplaySpreadsheetSchema, DisplayStepsSchema, DisplayAlertSchema,
  DisplayChoicesSchema,
  // 19 Tipos inferidos
  type DisplayMetric, type DisplayChart, type DisplayTable,
  type DisplayProgress, type DisplayProduct, type DisplayComparison,
  type DisplayPrice, type DisplayImage, type DisplayGallery,
  type DisplayCarousel, type DisplaySources, type DisplayLink,
  type DisplayMap, type DisplayFile, type DisplayCode,
  type DisplaySpreadsheet, type DisplaySteps, type DisplayAlert,
  type DisplayChoices,
} from "./display-schemas.js";

export { createDisplayTools } from "./tools/display.js";
```

- Nao alterar exports existentes — apenas adicionar
- Usar `type` keyword para re-export de tipos (isolatedModules)

## Limites

- **NAO** criar componentes React — display tools emitem dados JSON, o frontend renderiza
- **NAO** filtrar display tools por modo (conversation/heartbeat/cron) — o modelo decide
- **NAO** criar display tools que dependam de estado do frontend — display tools sao stateless
- **NAO** duplicar funcionalidade de markdown — se markdown resolve, nao precisa de display tool
- **NAO** criar rota DataStream neste PRP — responsabilidade do PRP-14B
- **NAO** criar documentacao/guias neste PRP — responsabilidade do PRP-14B

## Validacao

- [ ] Arquivo `display-schemas.ts` existe com 4 primitivos e 19 schemas Zod
- [ ] `DisplayToolRegistry` mapeia 19 nomes (prefixo `display_`) para schemas
- [ ] `DisplayToolName` eh type union das 19 chaves
- [ ] 19 tipos inferidos exportados
- [ ] `tools/display.ts` existe com `createDisplayTools()` retornando 19 tools
- [ ] Cada tool tem `description` (pt-BR), `parameters` (schema Zod) e `execute` com `_display: true`
- [ ] `agent.ts` importa e mergeia display tools em `allTools`
- [ ] `index.ts` re-exporta todos os schemas, tipos, registry e `createDisplayTools`
- [ ] `import { DisplayProductSchema, type DisplayProduct } from "@agentic-backbone/ai-sdk"` resolve
- [ ] Nenhum filtro por modo — display tools disponiveis em conversation, heartbeat e cron
- [ ] Typecheck passa: nenhum erro TypeScript no ai-sdk
- [ ] Build do ai-sdk (`npm run build:packages`) compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-174 Display Schemas Zod | S-050 | RC-001 |
| F-175 Display Tools + Registro | S-051 | RC-002, RC-003 |
| F-176 Display Exports index.ts | S-052 | RC-004 |
