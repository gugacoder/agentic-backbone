# PRP-23A — Display Domain Tools + Flag Condicional

Consolidar 19 display tools individuais em 4 domain tools com discriminated union por `action`, e adicionar flag `disableDisplayTools` ao ai-sdk para ativação condicional.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O ai-sdk possui 19 display tools individuais registradas em `createDisplayTools()` (`apps/packages/ai-sdk/src/tools/display.ts`). Cada tool ocupa tokens de contexto. As tools são sempre carregadas incondicionalmente em `agent.ts` linha 145, mesmo para canais que não suportam conteúdo rico.

### Estado desejado

- 4 domain tools (`display_highlight`, `display_collection`, `display_card`, `display_visual`) substituem as 19 individuais
- Flag `disableDisplayTools?: boolean` em `AiAgentOptions` permite que o backbone controle o carregamento
- Schemas individuais em `display-schemas.ts` permanecem intactos e exportados
- Build do ai-sdk compila sem erros

### Dependencias

- **PRP 14** (Rich Content) — schemas Zod existentes em `display-schemas.ts`
- **PRP 18** (Domain Tools) — pattern de agrupamento com discriminated union

## Especificacao

### Feature F-342: Reescrever display.ts com 4 domain tools

**Spec:** S-095

Reescrever `apps/packages/ai-sdk/src/tools/display.ts`. Substituir as 19 tools individuais por 4 domain tools.

**Mapeamento de agrupamento**

| Domain tool | Actions | Critério |
|---|---|---|
| `display_highlight` | metric, price, alert, choices | Destacar valor, chamar atenção, pedir decisão |
| `display_collection` | table, spreadsheet, comparison, carousel, gallery, sources | Apresentar coleção de itens |
| `display_card` | product, link, file, image | Apresentar item individual com detalhes |
| `display_visual` | chart, map, code, progress, steps | Visualização especializada de dados ou fluxos |

**Pattern de cada domain tool**

Discriminated union no parâmetro `action`, usando spread de `.shape` dos schemas existentes em `display-schemas.ts`:

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

// highlight
const highlightSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("metric"), ...DisplayMetricSchema.shape }),
  z.object({ action: z.literal("price"), ...DisplayPriceSchema.shape }),
  z.object({ action: z.literal("alert"), ...DisplayAlertSchema.shape }),
  z.object({ action: z.literal("choices"), ...DisplayChoicesSchema.shape }),
]);

// collection
const collectionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("table"), ...DisplayTableSchema.shape }),
  z.object({ action: z.literal("spreadsheet"), ...DisplaySpreadsheetSchema.shape }),
  z.object({ action: z.literal("comparison"), ...DisplayComparisonSchema.shape }),
  z.object({ action: z.literal("carousel"), ...DisplayCarouselSchema.shape }),
  z.object({ action: z.literal("gallery"), ...DisplayGallerySchema.shape }),
  z.object({ action: z.literal("sources"), ...DisplaySourcesSchema.shape }),
]);

// card
const cardSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("product"), ...DisplayProductSchema.shape }),
  z.object({ action: z.literal("link"), ...DisplayLinkSchema.shape }),
  z.object({ action: z.literal("file"), ...DisplayFileSchema.shape }),
  z.object({ action: z.literal("image"), ...DisplayImageSchema.shape }),
]);

// visual
const visualSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("chart"), ...DisplayChartSchema.shape }),
  z.object({ action: z.literal("map"), ...DisplayMapSchema.shape }),
  z.object({ action: z.literal("code"), ...DisplayCodeSchema.shape }),
  z.object({ action: z.literal("progress"), ...DisplayProgressSchema.shape }),
  z.object({ action: z.literal("steps"), ...DisplayStepsSchema.shape }),
]);
```

**Definição das 4 tools**

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

#### Regras

- Usar spread de `.shape` dos schemas existentes — NÃO duplicar campos manualmente
- O `execute` de cada domain tool retorna `{ ...args, _display: true }` — mesmo pattern atual
- O prefixo `display_` nos nomes das domain tools é obrigatório — o frontend usa `toolName.startsWith("display_")` para identificar display tools
- Cada schema de action DEVE incluir `action: z.literal("nome")` como primeiro campo da discriminated union
- `display-schemas.ts` NÃO deve ser alterado — todos os exports permanecem

### Feature F-343: Flag `disableDisplayTools` no ai-sdk

**Spec:** S-096

Adicionar flag condicional para desabilitar display tools no ai-sdk.

#### 1. `apps/packages/ai-sdk/src/types.ts`

Adicionar campo à interface `AiAgentOptions`:

```typescript
/** Desabilita display tools (rich content). Default: false (display tools habilitadas). */
disableDisplayTools?: boolean;
```

Posição: após o campo `repairToolCalls` / `maxRepairAttempts`, antes de `reasoning`.

#### 2. `apps/packages/ai-sdk/src/agent.ts`

Alterar a linha 145 para condicionar o carregamento:

**Antes:**
```typescript
const displayTools = createDisplayTools();
```

**Depois:**
```typescript
const displayTools = options.disableDisplayTools ? {} : createDisplayTools();
```

Apenas essa linha muda. O restante do merge permanece idêntico.

#### Regras

- O default é `false` (display tools habilitadas) — retrocompatível
- NÃO alterar a assinatura de `createDisplayTools()` — ela continua sem parâmetros
- NÃO remover o import de `createDisplayTools` — ele é usado condicionalmente

## Limites

- **NÃO** alterar os schemas individuais em `display-schemas.ts` — continuam existindo e exportados
- **NÃO** remover exports dos schemas/tipos individuais do `index.ts` do ai-sdk
- **NÃO** alterar a interface de callers existentes de `createDisplayTools()` ou `runAiAgent()`
- **NÃO** adicionar lógica de prompt neste PRP — o prompt é responsabilidade do PRP-23B

## Validacao

- [ ] `createDisplayTools()` retorna exatamente 4 tools: `display_highlight`, `display_collection`, `display_card`, `display_visual`
- [ ] Cada tool usa `z.discriminatedUnion("action", [...])` com os schemas corretos
- [ ] Os 19 action names estão mapeados corretamente nas 4 domain tools
- [ ] `display-schemas.ts` não foi alterado — todos os exports permanecem
- [ ] `execute` retorna `{ ...args, _display: true }` em todas as 4 tools
- [ ] `AiAgentOptions` em `types.ts` tem o campo `disableDisplayTools?: boolean`
- [ ] `agent.ts` condiciona: `options.disableDisplayTools ? {} : createDisplayTools()`
- [ ] Sem `disableDisplayTools` passado, display tools são carregadas normalmente
- [ ] Com `disableDisplayTools: true`, nenhuma display tool é incluída
- [ ] Build do ai-sdk compila sem erros (`npm run build:packages`)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-342 display domain tools | S-095 | D-001 |
| F-343 disableDisplayTools flag | S-096 | D-002 |
