# S-095 — Display Domain Tools: Consolidar 19 tools em 4

Agrupar as 19 display tools individuais em 4 domain tools com discriminated union por `action`, reduzindo custo de tokens e seguindo o pattern do PRP 18.

**Resolve:** D-001 (Reescrever display.ts com 4 domain tools)
**Score de prioridade:** 10
**Dependência:** Nenhuma — pode rodar em paralelo com S-096, S-097, S-099
**PRP:** 23 — Rich Response: Display Domain Tools + Ativação por Cliente

---

## 1. Objetivo

Substituir as 19 display tools individuais em `createDisplayTools()` por 4 domain tools agrupadas por forma de organização da informação. Cada domain tool usa `z.discriminatedUnion("action", [...])` composto a partir dos schemas existentes em `display-schemas.ts`. Os schemas individuais **não mudam** — apenas a camada de tools é reescrita.

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-sdk/src/tools/display.ts` (REESCREVER)

Substituir todo o conteúdo por 4 domain tools.

#### Mapeamento de agrupamento

| Domain tool | Actions | Critério |
|---|---|---|
| `display_highlight` | metric, price, alert, choices | Destacar valor, chamar atenção, pedir decisão |
| `display_collection` | table, spreadsheet, comparison, carousel, gallery, sources | Apresentar coleção de itens |
| `display_card` | product, link, file, image | Apresentar item individual com detalhes |
| `display_visual` | chart, map, code, progress, steps | Visualização especializada de dados ou fluxos |

#### Pattern de cada domain tool

Discriminated union no parâmetro `action`, usando spread de `.shape` dos schemas existentes:

```typescript
import { z } from "zod";
import { tool } from "ai";
import {
  DisplayMetricSchema, DisplayPriceSchema, DisplayAlertSchema, DisplayChoicesSchema,
  DisplayTableSchema, DisplaySpreadsheetSchema, DisplayComparisonSchema,
  DisplayCarouselSchema, DisplayGallerySchema, DisplaySourcesSchema,
  DisplayProductSchema, DisplayLinkSchema, DisplayFileSchema, DisplayImageSchema,
  DisplayChartSchema, DisplayMapSchema, DisplayCodeSchema, DisplayProgressSchema,
  DisplayStepsSchema,
} from "../display-schemas.js";

// --- highlight ---
const highlightSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("metric"), ...DisplayMetricSchema.shape }),
  z.object({ action: z.literal("price"), ...DisplayPriceSchema.shape }),
  z.object({ action: z.literal("alert"), ...DisplayAlertSchema.shape }),
  z.object({ action: z.literal("choices"), ...DisplayChoicesSchema.shape }),
]);

// --- collection ---
const collectionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("table"), ...DisplayTableSchema.shape }),
  z.object({ action: z.literal("spreadsheet"), ...DisplaySpreadsheetSchema.shape }),
  z.object({ action: z.literal("comparison"), ...DisplayComparisonSchema.shape }),
  z.object({ action: z.literal("carousel"), ...DisplayCarouselSchema.shape }),
  z.object({ action: z.literal("gallery"), ...DisplayGallerySchema.shape }),
  z.object({ action: z.literal("sources"), ...DisplaySourcesSchema.shape }),
]);

// --- card ---
const cardSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("product"), ...DisplayProductSchema.shape }),
  z.object({ action: z.literal("link"), ...DisplayLinkSchema.shape }),
  z.object({ action: z.literal("file"), ...DisplayFileSchema.shape }),
  z.object({ action: z.literal("image"), ...DisplayImageSchema.shape }),
]);

// --- visual ---
const visualSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chart"), ...DisplayChartSchema.shape }),
  z.object({ action: z.literal("map"), ...DisplayMapSchema.shape }),
  z.object({ action: z.literal("code"), ...DisplayCodeSchema.shape }),
  z.object({ action: z.literal("progress"), ...DisplayProgressSchema.shape }),
  z.object({ action: z.literal("steps"), ...DisplayStepsSchema.shape }),
]);
```

#### Definição das 4 tools

```typescript
export function createDisplayTools() {
  return {
    display_highlight: tool({
      description: [
        "Destaca informacao importante na resposta.",
        "Actions: metric (KPI com valor e tendencia), price (preco em destaque),",
        "alert (banner info/warning/error/success), choices (opcoes clicaveis para o usuario).",
      ].join(" "),
      inputSchema: highlightSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_collection: tool({
      description: [
        "Apresenta colecao de itens organizados.",
        "Actions: table (tabela rica com colunas tipadas), spreadsheet (planilha exportavel),",
        "comparison (itens lado a lado), carousel (cards horizontais navegaveis),",
        "gallery (grid de imagens), sources (lista de fontes consultadas).",
      ].join(" "),
      inputSchema: collectionSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_card: tool({
      description: [
        "Apresenta item individual com detalhes visuais.",
        "Actions: product (card com imagem, preco, rating, badges),",
        "link (preview de URL com OG image), file (card de arquivo para download),",
        "image (imagem unica com caption e zoom).",
      ].join(" "),
      inputSchema: cardSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_visual: tool({
      description: [
        "Visualizacao especializada de dados ou fluxos.",
        "Actions: chart (grafico bar/line/pie/area/donut), map (mapa com pins),",
        "code (bloco com syntax highlighting), progress (barra de progresso com etapas),",
        "steps (timeline/checklist de etapas).",
      ].join(" "),
      inputSchema: visualSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
  };
}
```

**IMPORTANTE — `inputSchema` vs `parameters`:** O código atual usa `inputSchema:` (não `parameters:`). Manter `inputSchema:` para compatibilidade com a versão do AI SDK em uso.

### 2.2 Arquivo: `apps/packages/ai-sdk/src/display-schemas.ts` (SEM ALTERAÇÃO)

Os 19 schemas individuais, `DisplayToolRegistry`, `DisplayToolName` e todos os tipos inferidos continuam existindo e exportados. Nenhuma mudança neste arquivo.

### 2.3 Arquivo: `apps/packages/ai-sdk/src/index.ts` (SEM ALTERAÇÃO nos exports)

Os exports de schemas e tipos individuais do `index.ts` devem ser mantidos — apps externas podem usá-los.

---

## 3. Regras de Implementação

- Usar spread de `.shape` dos schemas existentes — NÃO duplicar campos manualmente
- O `execute` de cada domain tool retorna `{ ...args, _display: true }` — mesmo pattern atual
- O prefixo `display_` nos nomes das domain tools é obrigatório — o frontend usa `toolName.startsWith("display_")` para identificar display tools
- Cada schema de action DEVE incluir `action: z.literal("nome")` como primeiro campo da discriminated union

---

## 4. Critérios de Aceite

- [ ] `createDisplayTools()` retorna exatamente 4 tools: `display_highlight`, `display_collection`, `display_card`, `display_visual`
- [ ] Cada tool usa `z.discriminatedUnion("action", [...])` com os schemas corretos
- [ ] Os 19 action names estão mapeados corretamente nas 4 domain tools
- [ ] `display-schemas.ts` não foi alterado — todos os exports permanecem
- [ ] `execute` retorna `{ ...args, _display: true }` em todas as 4 tools
- [ ] Build do ai-sdk compila sem erros (`npm run build:packages`)
