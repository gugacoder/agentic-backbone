# PRP 23 — Rich Response: Display Domain Tools + Ativacao por Cliente

Agrupar as 19 display tools individuais em 4 domain tools por forma de organizacao da informacao, e criar mecanismo de ativacao de resposta rica via query param `rich=true` no endpoint de mensagens — permitindo que o cliente (ai-chat) solicite conteudo rico e o backbone injete o prompt adequado.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

Apos PRPs 13 (Rich Stream) e 14 (Rich Content), o ai-sdk possui 19 display tools registradas em `createDisplayTools()` (`apps/packages/ai-sdk/src/tools/display.ts`). Essas tools sao sempre montadas no `runAiAgent()` e disponibilizadas a todos os agentes.

Porem:

1. **O modelo nao usa as display tools** — nenhum prompt instrui o modelo a usa-las. O PRP 14 delegou isso ao prompt assembly, mas ninguem implementou.
2. **19 tools individuais consomem contexto** — cada schema ocupa tokens. Para agentes como `nic.implantador` (~49 tools do backbone + 19 display + ~19 coding = ~87 tools), o custo eh significativo.
3. **Nao ha mecanismo de ativacao** — as display tools sao sempre carregadas, mesmo para canais que nao suportam conteudo rico (WhatsApp, voice).

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Display tools | 19 individuais | 4 domain tools |
| Ativacao | Sempre carregadas | Carregadas apenas quando `rich=true` |
| Prompt | Nenhum | Injetado quando `rich=true` |
| ai-chat | Nao solicita | Envia `rich=true` por default (`enableRichContent`) |
| Total tools (com rich) | 19 display tools | 4 display domain tools |
| Total tools (sem rich) | 19 display tools (desperdicadas) | 0 display tools |

### Dependencias

- **PRP 14** (Rich Content) — schemas Zod existentes em `display-schemas.ts`
- **PRP 15** (ai-chat) — `useBackboneChat` onde `enableRichContent` sera adicionado
- **PRP 18** (Domain Tools) — pattern de agrupamento com discriminated union
- **PRP 20** (Chat Feature Flags) — parametro `enableRichContent` nos feature flags do chat

---

## Especificacao

### 1. Domain tools — agrupamento por forma de organizacao

As 19 display tools sao agrupadas em 4 domain tools. O criterio de agrupamento eh **como a informacao eh organizada**, nao o dominio de negocio:

| Domain tool | Actions | Logica |
|---|---|---|
| `display_highlight` | metric, price, alert, choices | Destacar um valor, chamar atencao, pedir decisao |
| `display_collection` | table, spreadsheet, comparison, carousel, gallery, sources | Apresentar colecao de itens |
| `display_card` | product, link, file, image | Apresentar item individual com detalhes |
| `display_visual` | chart, map, code, progress, steps | Visualizacao especializada de dados ou fluxos |

**19 tools → 4 domain tools**

#### 1.1 Pattern de cada domain tool

Mesmo pattern do PRP 18: discriminated union no parametro `action`.

```typescript
// Exemplo: display_highlight
const metricParams = z.object({
  action: z.literal("metric"),
  ...DisplayMetricSchema.shape,
});

const priceParams = z.object({
  action: z.literal("price"),
  ...DisplayPriceSchema.shape,
});

const alertParams = z.object({
  action: z.literal("alert"),
  ...DisplayAlertSchema.shape,
});

const choicesParams = z.object({
  action: z.literal("choices"),
  ...DisplayChoicesSchema.shape,
});

const highlightSchema = z.discriminatedUnion("action", [
  metricParams,
  priceParams,
  alertParams,
  choicesParams,
]);
```

#### 1.2 Arquivo: `apps/packages/ai-sdk/src/tools/display.ts` (reescrever)

Substituir as 19 tools individuais por 4 domain tools:

```typescript
export function createDisplayTools() {
  return {
    display_highlight: tool({
      description: [
        "Destaca informacao importante na resposta.",
        "Actions: metric (KPI com valor e tendencia), price (preco em destaque),",
        "alert (banner info/warning/error/success), choices (opcoes clicaveis para o usuario).",
      ].join(" "),
      parameters: highlightSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_collection: tool({
      description: [
        "Apresenta colecao de itens organizados.",
        "Actions: table (tabela rica com colunas tipadas), spreadsheet (planilha exportavel),",
        "comparison (itens lado a lado), carousel (cards horizontais navegaveis),",
        "gallery (grid de imagens), sources (lista de fontes consultadas).",
      ].join(" "),
      parameters: collectionSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_card: tool({
      description: [
        "Apresenta item individual com detalhes visuais.",
        "Actions: product (card com imagem, preco, rating, badges),",
        "link (preview de URL com OG image), file (card de arquivo para download),",
        "image (imagem unica com caption e zoom).",
      ].join(" "),
      parameters: cardSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),

    display_visual: tool({
      description: [
        "Visualizacao especializada de dados ou fluxos.",
        "Actions: chart (grafico bar/line/pie/area/donut), map (mapa com pins),",
        "code (bloco com syntax highlighting), progress (barra de progresso com etapas),",
        "steps (timeline/checklist de etapas).",
      ].join(" "),
      parameters: visualSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
  };
}
```

#### 1.3 Execute e _display flag

O `execute` retorna `{ ...args, _display: true }` como antes. O frontend identifica display tools pelo prefixo `display_` no toolName e pelo flag `_display: true` no result.

O frontend mapeia `toolName` + `action` para o componente correto:
- `display_highlight` + `action: "metric"` → `MetricCard`
- `display_collection` + `action: "table"` → `DataTable`
- etc.

#### 1.4 Schemas — reusar os existentes

Os schemas de `display-schemas.ts` continuam existindo e exportados. As domain tools compoem discriminated unions a partir deles (spread de `.shape`). Nenhuma mudanca nos schemas individuais.

### 2. Ativacao por cliente — `rich=true`

#### 2.1 Arquivo: `apps/backbone/src/routes/conversations.ts`

Ler query param `rich`:

```typescript
conversationRoutes.post("/conversations/:sessionId/messages", async (c) => {
  // ...existente...
  const rich = c.req.query("rich") === "true";
  // Passar para sendMessage
  for await (const event of sendMessage(auth.user, sessionId, message, { rich })) {
    // ...
  }
});
```

#### 2.2 Arquivo: `apps/backbone/src/conversations/index.ts`

Na funcao `sendMessage()`, passar `rich` para `assemblePrompt`:

```typescript
export async function* sendMessage(
  user: AuthUser,
  sessionId: string,
  message: string,
  opts?: { rich?: boolean }
) {
  // ...existente...
  const assembled = await assemblePrompt(effectiveAgentId, "conversation", {
    userMessage: message,
    channelId: session.channel_id ?? undefined,
    rich: opts?.rich,
  });
  // ...
}
```

#### 2.3 Arquivo: `apps/backbone/src/context/index.ts`

Em `assemblePrompt`, injetar prompt de display tools quando `rich`:

```typescript
export interface AssemblePromptOpts {
  userMessage?: string;
  channelId?: string;
  rich?: boolean;
}

export async function assemblePrompt(...) {
  // ...secoes existentes (identity, skills, adapters, etc.)...

  // Rich content: instrucoes de display tools
  if (opts.rich) {
    system += RICH_CONTENT_PROMPT;
  }

  // ...mode instructions...
}
```

#### 2.4 Prompt de rich content

Constante em `apps/backbone/src/context/index.ts`:

```typescript
const RICH_CONTENT_PROMPT = `<rich_content>
O cliente suporta conteudo rico. Alem de markdown, voce tem display tools para formatar informacoes de forma visual.

Planeje sua resposta usando as display tools quando fizer sentido:
- display_highlight: para destacar valores, precos, alertas ou pedir escolhas ao usuario
- display_collection: para colecoes (tabelas, comparacoes, carrosseis, galerias, fontes)
- display_card: para itens individuais (produtos, links, arquivos, imagens)
- display_visual: para visualizacoes (graficos, mapas, codigo, progresso, timelines)

Regras:
- Use display tools para informacao estruturada; use markdown para texto corrido
- Combine display tools com texto markdown na mesma resposta
- Nao use display tool quando markdown simples resolve (listas, headings, bold)
- Uma resposta pode ter multiplas display tools
</rich_content>\n\n`;
```

#### 2.5 Display tools condicionais

As display tools so devem ser carregadas quando `rich=true`. Hoje o ai-sdk as carrega sempre.

Opcao: o backbone controla quais tools passa para o ai-sdk. Quando `rich=false`, nao inclui display tools no `options.tools`.

Isso requer que `createDisplayTools()` seja chamado pelo backbone (nao internamente no ai-sdk) e passado via `options.tools` apenas quando `rich=true`.

**Alternativa mais simples**: o ai-sdk continua criando display tools internamente, mas aceita uma flag `disableDisplayTools` no options. Quando `true`, nao inclui display tools no merge.

```typescript
// agent.ts
const displayTools = options.disableDisplayTools ? {} : createDisplayTools();
let tools = { ...mcpTools, ...codingTools, ...displayTools, ...dangerousTools };
```

O backbone passa `disableDisplayTools: !rich`.

### 3. ai-chat — enableRichContent

#### 3.1 Arquivo: `apps/packages/ai-chat/src/hooks/useBackboneChat.ts`

Adicionar `enableRichContent` ao options:

```typescript
export interface UseBackboneChatOptions {
  endpoint: string;
  token: string;
  sessionId: string;
  initialMessages?: Message[];
  enableRichContent?: boolean; // default: true
}

export function useBackboneChat(options: UseBackboneChatOptions) {
  const rich = options.enableRichContent !== false;
  const chat = useChat({
    api: `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/messages?format=datastream${rich ? "&rich=true" : ""}`,
    // ...
  });
  // ...
}
```

#### 3.2 Frontend — mapeamento de domain tool + action

O `PartRenderer` no ai-chat precisa mapear `toolName` + `result.action` para o componente correto:

```typescript
if (part.toolName.startsWith("display_") && part.state === "result") {
  const action = part.result.action;
  const key = `${part.toolName}:${action}`; // ex: "display_highlight:metric"
  const Renderer = displayRenderers[key] ?? displayRenderers[action];
  if (Renderer) return <Renderer {...part.result} />;
}
```

O registry de renderers muda de `toolName → Component` para `action → Component`:

```typescript
export const defaultDisplayRenderers = {
  metric: MetricCard,
  price: PriceHighlight,
  alert: Alert,
  choices: ChoiceButtons,
  table: DataTable,
  spreadsheet: Spreadsheet,
  comparison: ComparisonTable,
  carousel: Carousel,
  gallery: Gallery,
  sources: SourcesList,
  product: ProductCard,
  link: LinkPreview,
  file: FileCard,
  image: ImageViewer,
  chart: Chart,
  map: MapView,
  code: CodeBlock,
  progress: ProgressSteps,
  steps: StepTimeline,
};
```

---

## Limites

### NAO fazer

- NAO alterar os schemas individuais em `display-schemas.ts` — continuam existindo e exportados
- NAO remover exports dos schemas/tipos individuais do `index.ts` do ai-sdk — apps podem usar
- NAO criar prompt de rich content especifico por agente — o prompt eh generico, o modelo decide
- NAO forcar display tools — o modelo usa quando faz sentido; se markdown resolve, usa markdown
- NAO ativar `rich=true` para canais nao-streaming (WhatsApp, voice) — esses canais ignoram display tools

### Observacoes

- O prompt de rich content (`<rich_content>`) eh generico e nao menciona dominios de negocio — funciona para qualquer agente
- Quando `rich=false`, as display tools nao sao carregadas — zero custo de tokens
- O frontend usa `action` (nao `toolName`) para resolver o renderer — o agrupamento eh transparente para o usuario
- A flag `enableRichContent` no ai-chat eh default `true` — o consumidor desliga se nao quiser

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | Reescrever `tools/display.ts` com 4 domain tools | nada |
| 2a | `conversations.ts`: ler `rich` query param | nada |
| 2b | `conversations/index.ts`: propagar `rich` para `assemblePrompt` | 2a |
| 2c | `context/index.ts`: injetar `RICH_CONTENT_PROMPT` quando `rich=true` | 2b |
| 3 | `agent.ts` ou `proxy.ts`: flag `disableDisplayTools` | nada |
| 4 | `useBackboneChat.ts`: `enableRichContent` query param | nada |
| 5 | `PartRenderer.tsx`: mapear por `action` em vez de `toolName` | 1 |
| 6 | Build ai-sdk + ai-chat | 1, 3, 4, 5 |
| 7 | Teste: conversa com `rich=true` — verificar display tools no stream | 6 |

Fases 1, 2a, 3, 4 sao independentes e podem ser executadas em paralelo.
