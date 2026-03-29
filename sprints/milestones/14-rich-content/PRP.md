# PRP 14 — Rich Content: Display Tools e Protocolo de Conteudo Rico

Criar um catalogo de display tools que permitem ao agente emitir conteudo estruturado (product cards, graficos, carrosseis, fontes, tabelas ricas) alem de markdown — com schemas Zod, guia de integracao para apps consumidores, e formato de entrega via Vercel AI SDK `DataStream` + `useChat`.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

Apos PRP 13 (Rich Stream), o `AgentEvent` emite eventos tipados: `reasoning`, `tool-call`, `tool-result`, `text`, `step_finish`. O stream permite que clientes ricos vejam a timeline de atividades do agente.

Porem, o **conteudo** da resposta continua sendo markdown puro. Markdown nao suporta:

- Carrosseis de imagens/produtos
- Cards de produto com preco, rating, imagem, badges
- Graficos interativos (bar, line, pie)
- KPIs com tendencia
- Preview de links com OG image
- Lista de fontes consultadas com favicon
- Tabelas ricas com imagens em celulas
- Mapas com pins
- Botoes de escolha

### Estado desejado

O agente possui **display tools** — ferramentas cujo unico proposito eh emitir conteudo estruturado no stream. O frontend mapeia cada display tool para um componente React. O resultado eh uma experiencia visual rica (estilo ChatGPT/Perplexity/Claude), sem inventar protocolo — usando Vercel AI SDK `DataStream` e `useChat`.

### Dependencias

- **PRP 13 (Rich Stream)** — necessario para que `tool-call` e `tool-result` aparecam como eventos discretos no stream

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Conteudo da resposta | Markdown puro | Markdown + display tools (conteudo estruturado) |
| Tools do agente | Apenas tools funcionais (WebSearch, Bash, etc.) | Tools funcionais + display tools |
| Entrega SSE | `AgentEvent` customizado | Vercel AI SDK `DataStream` (compativel com `useChat`) |
| Documentacao | Nenhuma | `guides/rich-content/GUIDE.md` + schemas + exemplos |

---

## Especificacao

### 1. Schemas Zod — display tools

#### 1.1 Arquivo: `apps/packages/ai-sdk/src/display-schemas.ts`

Arquivo unico com todos os schemas Zod das display tools. Exporta tambem os tipos TypeScript inferidos.

```typescript
import { z } from "zod";

// --- Primitivos reutilizaveis ---

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

// --- Display Tools ---

// 1. METRICAS E DADOS

export const DisplayMetricSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  trend: z.object({
    direction: z.enum(["up", "down", "neutral"]),
    value: z.string(),
  }).optional(),
  icon: z.string().optional(),
});

export const DisplayChartSchema = z.object({
  type: z.enum(["bar", "line", "pie", "area", "donut"]),
  title: z.string(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
  format: z.object({
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    locale: z.string().default("pt-BR"),
  }).optional(),
});

export const DisplayTableSchema = z.object({
  title: z.string().optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["text", "number", "money", "image", "link", "badge"]).default("text"),
    align: z.enum(["left", "center", "right"]).default("left"),
  })),
  rows: z.array(z.record(z.unknown())),
  sortable: z.boolean().default(false),
});

export const DisplayProgressSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.object({
    label: z.string(),
    status: z.enum(["completed", "current", "pending"]),
    description: z.string().optional(),
  })),
});

// 2. PRODUTOS E COMERCIO

export const DisplayProductSchema = z.object({
  title: z.string(),
  image: z.string().url().optional(),
  price: MoneySchema.optional(),
  originalPrice: MoneySchema.optional(),
  rating: z.object({
    score: z.number().min(0).max(5),
    count: z.number(),
  }).optional(),
  source: SourceRefSchema.optional(),
  badges: z.array(BadgeSchema).optional(),
  url: z.string().url().optional(),
  description: z.string().optional(),
});

export const DisplayComparisonSchema = z.object({
  title: z.string().optional(),
  items: z.array(DisplayProductSchema),
  attributes: z.array(z.object({
    key: z.string(),
    label: z.string(),
  })).optional(),
});

export const DisplayPriceSchema = z.object({
  value: MoneySchema,
  label: z.string(),
  context: z.string().optional(),
  source: SourceRefSchema.optional(),
  badge: BadgeSchema.optional(),
});

// 3. MIDIA

export const DisplayImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const DisplayGallerySchema = z.object({
  title: z.string().optional(),
  images: z.array(ImageItemSchema),
  layout: z.enum(["grid", "masonry"]).default("grid"),
  columns: z.number().min(2).max(5).default(3),
});

export const DisplayCarouselSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    image: z.string().url().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    price: MoneySchema.optional(),
    url: z.string().url().optional(),
    badges: z.array(BadgeSchema).optional(),
  })),
});

// 4. REFERENCIAS E NAVEGACAO

export const DisplaySourcesSchema = z.object({
  label: z.string().default("Fontes consultadas"),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    favicon: z.string().url().optional(),
    snippet: z.string().optional(),
  })),
});

export const DisplayLinkSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  favicon: z.string().url().optional(),
  domain: z.string().optional(),
});

export const DisplayMapSchema = z.object({
  title: z.string().optional(),
  pins: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    label: z.string().optional(),
    address: z.string().optional(),
  })),
  zoom: z.number().min(1).max(20).default(14),
});

// 5. DOCUMENTOS E ARQUIVOS

export const DisplayFileSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().optional(),
  url: z.string().url().optional(),
  preview: z.string().optional(),
});

export const DisplayCodeSchema = z.object({
  language: z.string(),
  code: z.string(),
  title: z.string().optional(),
  lineNumbers: z.boolean().default(true),
});

export const DisplaySpreadsheetSchema = z.object({
  title: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  format: z.object({
    moneyColumns: z.array(z.number()).optional(),
    percentColumns: z.array(z.number()).optional(),
  }).optional(),
});

// 6. INTERATIVO

export const DisplayStepsSchema = z.object({
  title: z.string().optional(),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(["completed", "current", "pending"]).default("pending"),
  })),
  orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
});

export const DisplayAlertSchema = z.object({
  variant: z.enum(["info", "warning", "error", "success"]),
  title: z.string().optional(),
  message: z.string(),
  icon: z.string().optional(),
});

export const DisplayChoicesSchema = z.object({
  question: z.string().optional(),
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
  })),
  layout: z.enum(["buttons", "cards", "list"]).default("buttons"),
});

// --- Registry (mapa nome → schema) ---

export const DisplayToolRegistry = {
  display_metric: DisplayMetricSchema,
  display_chart: DisplayChartSchema,
  display_table: DisplayTableSchema,
  display_progress: DisplayProgressSchema,
  display_product: DisplayProductSchema,
  display_comparison: DisplayComparisonSchema,
  display_price: DisplayPriceSchema,
  display_image: DisplayImageSchema,
  display_gallery: DisplayGallerySchema,
  display_carousel: DisplayCarouselSchema,
  display_sources: DisplaySourcesSchema,
  display_link: DisplayLinkSchema,
  display_map: DisplayMapSchema,
  display_file: DisplayFileSchema,
  display_code: DisplayCodeSchema,
  display_spreadsheet: DisplaySpreadsheetSchema,
  display_steps: DisplayStepsSchema,
  display_alert: DisplayAlertSchema,
  display_choices: DisplayChoicesSchema,
} as const;

export type DisplayToolName = keyof typeof DisplayToolRegistry;

// --- Tipos inferidos ---

export type DisplayMetric = z.infer<typeof DisplayMetricSchema>;
export type DisplayChart = z.infer<typeof DisplayChartSchema>;
export type DisplayTable = z.infer<typeof DisplayTableSchema>;
export type DisplayProgress = z.infer<typeof DisplayProgressSchema>;
export type DisplayProduct = z.infer<typeof DisplayProductSchema>;
export type DisplayComparison = z.infer<typeof DisplayComparisonSchema>;
export type DisplayPrice = z.infer<typeof DisplayPriceSchema>;
export type DisplayImage = z.infer<typeof DisplayImageSchema>;
export type DisplayGallery = z.infer<typeof DisplayGallerySchema>;
export type DisplayCarousel = z.infer<typeof DisplayCarouselSchema>;
export type DisplaySources = z.infer<typeof DisplaySourcesSchema>;
export type DisplayLink = z.infer<typeof DisplayLinkSchema>;
export type DisplayMap = z.infer<typeof DisplayMapSchema>;
export type DisplayFile = z.infer<typeof DisplayFileSchema>;
export type DisplayCode = z.infer<typeof DisplayCodeSchema>;
export type DisplaySpreadsheet = z.infer<typeof DisplaySpreadsheetSchema>;
export type DisplaySteps = z.infer<typeof DisplayStepsSchema>;
export type DisplayAlert = z.infer<typeof DisplayAlertSchema>;
export type DisplayChoices = z.infer<typeof DisplayChoicesSchema>;
```

### 2. Display tools como Vercel AI SDK tools

#### 2.1 Arquivo: `apps/packages/ai-sdk/src/tools/display.ts`

Cria as display tools usando `tool()` do Vercel AI SDK. Cada tool tem `description` para o modelo, `parameters` (schema Zod), e `execute` que simplesmente retorna os args validados (a renderizacao eh do frontend).

```typescript
import { tool } from "ai";
import {
  DisplayMetricSchema,
  DisplayChartSchema,
  DisplayTableSchema,
  // ...todos os schemas
} from "../display-schemas.js";

export function createDisplayTools() {
  return {
    display_metric: tool({
      description: "Exibe um KPI/metrica em destaque com valor grande, label e tendencia opcional (seta para cima/baixo). Use para destacar um numero importante.",
      parameters: DisplayMetricSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_chart: tool({
      description: "Exibe um grafico (barras, linhas, pizza, area, donut). Use para visualizar dados numericos comparativos ou series temporais.",
      parameters: DisplayChartSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_table: tool({
      description: "Exibe uma tabela rica com colunas tipadas (texto, numero, dinheiro, imagem, link, badge). Use quando uma tabela markdown seria insuficiente — por exemplo, com imagens em celulas ou formatacao monetaria.",
      parameters: DisplayTableSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_progress: tool({
      description: "Exibe uma barra de progresso com etapas nomeadas e status (completo, atual, pendente). Use para mostrar fluxos de trabalho ou checklists visuais.",
      parameters: DisplayProgressSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_product: tool({
      description: "Exibe um card de produto com imagem, titulo, preco, rating, fonte e badges. Use para apresentar um produto especifico encontrado em pesquisa.",
      parameters: DisplayProductSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_comparison: tool({
      description: "Exibe uma tabela comparativa de produtos lado a lado, cada um com imagem, preco e atributos. Use para comparar 2-5 opcoes.",
      parameters: DisplayComparisonSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_price: tool({
      description: "Exibe um preco em destaque grande com label, contexto e fonte. Use para destacar o preco principal encontrado em uma pesquisa.",
      parameters: DisplayPriceSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_image: tool({
      description: "Exibe uma imagem unica com caption e suporte a zoom. Use para mostrar uma foto relevante ao contexto.",
      parameters: DisplayImageSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_gallery: tool({
      description: "Exibe um grid de imagens expansivel. Use para mostrar multiplas imagens relacionadas (fotos de produtos, screenshots, etc.).",
      parameters: DisplayGallerySchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_carousel: tool({
      description: "Exibe um carrossel horizontal de cards com imagem, titulo, subtitulo e preco opcional. Use para apresentar uma lista de opcoes navegavel.",
      parameters: DisplayCarouselSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_sources: tool({
      description: "Exibe uma lista de fontes consultadas com favicon, titulo e URL. Use ao final de uma resposta baseada em pesquisa para dar transparencia sobre as fontes.",
      parameters: DisplaySourcesSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_link: tool({
      description: "Exibe um preview de link com OG image, titulo e descricao. Use para destacar um link importante com visual rico.",
      parameters: DisplayLinkSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_map: tool({
      description: "Exibe um mapa com pins geolocalizados. Use para mostrar localizacoes de lojas, enderecos ou pontos de interesse.",
      parameters: DisplayMapSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_file: tool({
      description: "Exibe um card de arquivo para download com icone, nome, tipo e tamanho. Use para entregar documentos gerados (PDF, DOCX, XLSX).",
      parameters: DisplayFileSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_code: tool({
      description: "Exibe um bloco de codigo com syntax highlighting, numeros de linha, e botao de copiar. Use para trechos de codigo maiores que um inline code.",
      parameters: DisplayCodeSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_spreadsheet: tool({
      description: "Exibe uma planilha com headers e linhas de dados, com formatacao monetaria/percentual opcional. Use para dados tabulares que o usuario pode querer exportar.",
      parameters: DisplaySpreadsheetSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_steps: tool({
      description: "Exibe uma timeline/checklist de etapas com status visual. Use para passo-a-passo, fluxos de trabalho ou progresso de tarefas.",
      parameters: DisplayStepsSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_alert: tool({
      description: "Exibe um banner de alerta (info, warning, error, success). Use para chamar atencao para informacoes criticas, avisos ou confirmacoes.",
      parameters: DisplayAlertSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_choices: tool({
      description: "Exibe opcoes clicaveis para o usuario (botoes, cards ou lista). Use quando precisar que o usuario escolha entre alternativas.",
      parameters: DisplayChoicesSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
  };
}
```

### 3. Registro das display tools no agente

#### 3.1 Arquivo: `apps/packages/ai-sdk/src/agent.ts`

Importar `createDisplayTools()` e mergear com as coding tools. Display tools sao **sempre disponibilizadas** — o modelo decide quando usar. Nao ha filtro por modo.

```typescript
import { createDisplayTools } from "./tools/display.js";

// Dentro de runAiAgent(), junto com codingTools:
const displayTools = createDisplayTools();
const allTools = { ...codingTools, ...displayTools, ...mcpTools, ...options.tools };
```

### 4. Formato de entrega SSE — Vercel DataStream

#### 4.1 Arquivo: `apps/backbone/src/routes/conversations.ts`

Adicionar rota alternativa ou parametro que emite no formato Vercel `DataStream`, compativel com `useChat` do `ai/react`:

```typescript
conversationRoutes.post("/conversations/:sessionId/messages", async (c) => {
  const sessionId = c.req.param("sessionId");
  const format = c.req.query("format"); // "datastream" | undefined

  // ...validacoes existentes...

  if (format === "datastream") {
    // Vercel AI SDK DataStream format — consumido por useChat()
    return streamSSE(c, async (stream) => {
      for await (const event of sendMessage(auth.user, sessionId, message)) {
        const encoded = encodeDataStreamEvent(event);
        if (encoded) {
          await stream.writeSSE({ data: encoded });
        }
      }
    });
  }

  // Formato original (AgentEvent JSON) — backward compatible
  return streamSSE(c, async (stream) => {
    for await (const event of sendMessage(auth.user, sessionId, message)) {
      await stream.writeSSE({ data: JSON.stringify(event) });
    }
  });
});
```

A funcao `encodeDataStreamEvent()` traduz `AgentEvent` para o protocolo DataStream do Vercel. Implementar em `apps/backbone/src/routes/datastream.ts`:

```typescript
import type { AgentEvent } from "../agent/types.js";

export function encodeDataStreamEvent(event: AgentEvent): string | null {
  switch (event.type) {
    case "text":
      return `0:${JSON.stringify(event.content)}`;
    case "reasoning":
      return `g:${JSON.stringify(event.content)}`;
    case "tool-call":
      return `9:${JSON.stringify({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      })}`;
    case "tool-result":
      return `a:${JSON.stringify({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
      })}`;
    case "step_finish":
      return `e:${JSON.stringify({ finishReason: "stop" })}`;
    case "usage":
      return `d:${JSON.stringify({
        finishReason: "stop",
        usage: {
          promptTokens: event.usage.inputTokens,
          completionTokens: event.usage.outputTokens,
        },
      })}`;
    case "init":
      return null; // useChat nao precisa deste evento
    case "result":
      return null; // ja coberto por text deltas
    default:
      return null;
  }
}
```

### 5. Exportar schemas do ai-sdk

#### 5.1 Arquivo: `apps/packages/ai-sdk/src/index.ts`

Exportar os schemas e tipos para que apps consumidores possam importar:

```typescript
export {
  DisplayToolRegistry,
  type DisplayToolName,
  // Schemas individuais
  DisplayMetricSchema,
  DisplayChartSchema,
  DisplayTableSchema,
  DisplayProgressSchema,
  DisplayProductSchema,
  DisplayComparisonSchema,
  DisplayPriceSchema,
  DisplayImageSchema,
  DisplayGallerySchema,
  DisplayCarouselSchema,
  DisplaySourcesSchema,
  DisplayLinkSchema,
  DisplayMapSchema,
  DisplayFileSchema,
  DisplayCodeSchema,
  DisplaySpreadsheetSchema,
  DisplayStepsSchema,
  DisplayAlertSchema,
  DisplayChoicesSchema,
  // Tipos inferidos
  type DisplayMetric,
  type DisplayChart,
  type DisplayTable,
  type DisplayProgress,
  type DisplayProduct,
  type DisplayComparison,
  type DisplayPrice,
  type DisplayImage,
  type DisplayGallery,
  type DisplayCarousel,
  type DisplaySources,
  type DisplayLink,
  type DisplayMap,
  type DisplayFile,
  type DisplayCode,
  type DisplaySpreadsheet,
  type DisplaySteps,
  type DisplayAlert,
  type DisplayChoices,
} from "./display-schemas.js";
```

### 6. Guia de integracao

#### 6.1 Arquivo: `guides/rich-content/GUIDE.md`

Guia completo para apps consumidores. Conteudo:

- O que sao display tools e por que existem
- Como consumir via `useChat` do `ai/react`
- Como identificar display tools no stream (prefixo `display_` + flag `_display: true` no result)
- Catalogo visual: cada display tool com descricao, schema, exemplo de payload, e screenshot/wireframe de referencia
- Mapa `toolName → componente React` sugerido
- Fallback: se o frontend nao tem renderer para uma display tool, renderizar como JSON formatado

#### 6.2 Arquivo: `guides/rich-content/schemas.json`

JSON Schema exportado dos schemas Zod (via `zodToJsonSchema`). Para clientes que nao usam TypeScript ou nao importam do ai-sdk.

Gerar com script:

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";
import { DisplayToolRegistry } from "./display-schemas.js";

const jsonSchemas = Object.fromEntries(
  Object.entries(DisplayToolRegistry).map(([name, schema]) => [
    name,
    zodToJsonSchema(schema),
  ])
);
```

#### 6.3 Arquivo: `guides/rich-content/examples.json`

Exemplos de payload para cada display tool. Cada entrada contem:

```json
{
  "display_product": {
    "description": "Card de produto com imagem, preco, rating e fonte",
    "example": {
      "title": "Pneu Levorin Praieiro 26x1.95",
      "image": "https://example.com/pneu.jpg",
      "price": { "value": 35.90, "currency": "BRL" },
      "rating": { "score": 4.8, "count": 15000 },
      "source": { "name": "Pedal Ciclo", "url": "https://pedalciclo.com.br" },
      "badges": [{ "label": "Menor preco", "variant": "success" }],
      "url": "https://pedalciclo.com.br/pneu-levorin"
    },
    "use_when": "Apresentar um produto especifico encontrado em pesquisa de preco/disponibilidade"
  }
}
```

Um exemplo completo para cada uma das 19 display tools.

#### 6.4 Arquivo: `guides/rich-content/component-map.md`

Mapa de referencia para implementadores de frontend:

```markdown
| Display Tool | Componente sugerido | Libs recomendadas |
|---|---|---|
| display_metric | `<MetricCard />` | — |
| display_chart | `<Chart />` | recharts |
| display_table | `<DataTable />` | @tanstack/react-table |
| display_carousel | `<Carousel />` | embla-carousel-react |
| display_map | `<MapView />` | react-leaflet |
| display_code | `<CodeBlock />` | shiki, react-syntax-highlighter |
| display_spreadsheet | `<Spreadsheet />` | @tanstack/react-table |
| display_sources | `<SourcesList />` | — |
| display_product | `<ProductCard />` | — |
| display_comparison | `<ComparisonTable />` | — |
| display_gallery | `<ImageGallery />` | — |
| display_image | `<ImageViewer />` | — |
| display_link | `<LinkPreview />` | — |
| display_price | `<PriceHighlight />` | — |
| display_file | `<FileCard />` | — |
| display_progress | `<ProgressSteps />` | — |
| display_steps | `<StepTimeline />` | — |
| display_alert | `<Alert />` | shadcn/ui Alert |
| display_choices | `<ChoiceButtons />` | shadcn/ui Button/Card |
```

---

## Limites

### NAO fazer

- NAO renderizar display tools no backend — o backend emite JSON, o frontend renderiza
- NAO criar componentes React no ai-sdk ou backbone — componentes sao responsabilidade do app consumidor
- NAO filtrar display tools por modo (conversation/heartbeat/cron) — o modelo decide quando usar
- NAO criar display tools que dependam de estado do frontend (ex: modal, drawer) — display tools sao stateless, emitem dados
- NAO duplicar funcionalidade de markdown — se markdown resolve (texto bold, listas, headings), nao precisa de display tool
- NAO incluir logica de layout/grid no schema — o schema define dados, o frontend decide layout
- NAO criar display tool para conteudo que ja vem de tool-result funcional (ex: WebSearch results ja aparecem como tool-result; display_sources eh para o agente **curar** as fontes, nao duplicar)

### Observacoes

- Display tools tem prefixo `display_` por convencao — permite que o frontend identifique sem lista hardcoded
- O flag `_display: true` no result diferencia display tools de tools funcionais no stream
- Canais pobres (WhatsApp) ignoram display tools — o texto markdown entre elas eh a resposta completa
- O modelo precisa de instrucao no system prompt para saber quando usar display tools vs markdown. Isso eh responsabilidade do prompt assembly do agente, nao deste PRP
- O `guides/rich-content/` serve como contrato publico — apps consumidores dependem dele para implementar renderers

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | Criar `display-schemas.ts` com todos os schemas Zod | nada |
| 2a | Criar `tools/display.ts` com as display tools Vercel AI SDK | fase 1 |
| 2b | Exportar schemas/tipos em `index.ts` do ai-sdk | fase 1 |
| 3 | Registrar display tools em `agent.ts` (merge com codingTools) | fase 2a |
| 4 | Criar `routes/datastream.ts` com `encodeDataStreamEvent()` | PRP 13 |
| 5 | Adicionar formato `datastream` na rota de conversacao | fase 4 |
| 6 | Build do ai-sdk (`npm run build:packages`) e validacao | fases 2a, 2b, 3 |
| 7a | Gerar `guides/rich-content/GUIDE.md` | fase 1 |
| 7b | Gerar `guides/rich-content/schemas.json` via script | fase 1 |
| 7c | Gerar `guides/rich-content/examples.json` | fase 1 |
| 7d | Gerar `guides/rich-content/component-map.md` | fase 1 |
| 8 | Teste manual — verificar display tools no SSE | fase 6 |

Fases 2a e 2b sao paralelas. Fases 7a-7d sao paralelas.
