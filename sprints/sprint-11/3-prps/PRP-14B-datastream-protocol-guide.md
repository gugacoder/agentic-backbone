# PRP-14B — DataStream Protocol e Guia Rich Content

Criar o encoder DataStream para compatibilidade com `useChat()`, adicionar formato alternativo na rota de conversacao, e produzir documentacao completa de integracao para apps consumidores.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- O stream SSE da rota `POST /conversations/:sessionId/messages` emite `AgentEvent` como JSON — formato customizado, nao compativel com `useChat()` do `ai/react`
- Nao existe funcao para traduzir `AgentEvent` para o protocolo Vercel DataStream
- Nao existe documentacao de integracao para apps consumidores das display tools
- Apps usando `useChat()` precisam de adapter customizado para consumir o stream

### Estado desejado

1. Funcao `encodeDataStreamEvent()` traduz `AgentEvent` para protocolo Vercel DataStream (prefixos `0:`, `9:`, `a:`, `e:`, `d:`, `g:`)
2. Rota de conversacao aceita `?format=datastream` para emitir no formato DataStream — backward compatible
3. Guia completo em `guides/rich-content/` com GUIDE.md, schemas.json, examples.json e component-map.md

### Dependencias

- **PRP 13 (Rich Stream)** — ja implementado. Stream rico com `tool-call`/`tool-result` funciona
- **PRP-14A** — as display tools devem existir para que o DataStream carregue payloads de display tools. Porem o encoder eh generico (funciona com qualquer `AgentEvent`) e pode ser implementado em paralelo
- **S-050 (display-schemas.ts)** — necessario para gerar `schemas.json` e `examples.json` do guia

## Especificacao

### Feature F-177: DataStream Encoder

**Spec:** S-053

Criar `apps/backbone/src/routes/datastream.ts` com a funcao pura `encodeDataStreamEvent()`:

```typescript
import type { AgentEvent } from "../agent/types.js";

/**
 * Traduz AgentEvent para o protocolo Vercel AI SDK DataStream.
 * Retorna string formatada com prefixo ou null se o evento nao tem representacao.
 *
 * Prefixos DataStream:
 *   0: — text delta
 *   9: — tool call
 *   a: — tool result
 *   e: — step finish (finish reason)
 *   d: — done (usage + finish reason)
 *   g: — reasoning
 */
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
      return null;
    case "result":
      return null;
    default:
      return null;
  }
}
```

#### Regras

- Funcao pura, sem side effects — recebe evento, retorna string ou null
- Prefixos exatamente os do protocolo Vercel DataStream
- Mapeamento de campos `usage`: `inputTokens` → `promptTokens`, `outputTokens` → `completionTokens`
- Eventos `init` e `result` retornam `null` — sem equivalente no DataStream
- Default retorna `null` — forward compatible
- **Verificar nomes exatos dos campos de `AgentEvent`** em `apps/backbone/src/agent/types.ts` antes de implementar

### Feature F-178: DataStream Route — ?format=datastream

**Spec:** S-054

Adicionar suporte ao parametro `?format=datastream` na rota `POST /conversations/:sessionId/messages` em `apps/backbone/src/routes/conversations.ts`:

```typescript
import { encodeDataStreamEvent } from "./datastream.js";

// Dentro do handler POST /conversations/:sessionId/messages:
const format = c.req.query("format");

if (format === "datastream") {
  return streamSSE(c, async (stream) => {
    for await (const event of sendMessage(auth.user, sessionId, message)) {
      const encoded = encodeDataStreamEvent(event);
      if (encoded) {
        await stream.writeSSE({ data: encoded });
      }
    }
  });
}

// Formato original (AgentEvent JSON) — sem mudanca
return streamSSE(c, async (stream) => {
  for await (const event of sendMessage(auth.user, sessionId, message)) {
    await stream.writeSSE({ data: JSON.stringify(event) });
  }
});
```

#### Regras

- Check `format === "datastream"` **antes** do stream existente
- Branch padrao (sem format ou format desconhecido) **identico** ao codigo atual — nao refatorar
- Eventos com `encodeDataStreamEvent()` retornando `null` sao ignorados silenciosamente
- Nao criar rota separada — mesmo endpoint, formato de saida diferente
- Nao adicionar validacao de format — valores desconhecidos caem no branch padrao
- Backward compatible — rota sem `?format` continua como antes

### Feature F-179: Guia Rich Content

**Spec:** S-055

Produzir 4 artefatos de documentacao em `guides/rich-content/`:

#### F-179a: `guides/rich-content/GUIDE.md`

Guia completo de integracao. Secoes obrigatorias:

1. **O que sao display tools** — ferramentas cujo proposito eh emitir conteudo estruturado no stream; frontend mapeia para componentes React; backend emite JSON, frontend renderiza
2. **Como consumir via `useChat`** — exemplo de integracao com `useChat()` do `ai/react` usando `?format=datastream`
3. **Como identificar display tools no stream**:
   - Prefixo `display_` no `toolName` do evento `tool-call`/`tool-result`
   - Flag `_display: true` no `result` — diferencia de tools funcionais
4. **Catalogo das 19 display tools** — para cada uma: nome, descricao, referencia ao schema, quando usar vs markdown
5. **Fallback** — se o frontend nao tem renderer para uma display tool, renderizar como JSON formatado (nunca quebrar)
6. **Canais pobres** — WhatsApp e outros canais sem rich content recebem apenas o markdown entre as display tools

#### F-179b: `guides/rich-content/schemas.json`

JSON Schema exportado dos schemas Zod via `zodToJsonSchema`. Estrutura:

```json
{
  "display_metric": { /* JSON Schema */ },
  "display_chart": { /* JSON Schema */ },
  // ...19 entries
}
```

Gerar via script em `.tmp/gen-schemas.mjs`:

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";
import { DisplayToolRegistry } from "../apps/packages/ai-sdk/src/display-schemas.js";

const jsonSchemas = Object.fromEntries(
  Object.entries(DisplayToolRegistry).map(([name, schema]) => [
    name,
    zodToJsonSchema(schema),
  ])
);
```

**Nota:** Se o build do ai-sdk ainda nao foi feito, gerar manualmente a partir dos schemas Zod do PRP-14 milestone.

#### F-179c: `guides/rich-content/examples.json`

Um exemplo de payload canonico para cada uma das 19 display tools:

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
    "use_when": "Apresentar um produto especifico encontrado em pesquisa"
  }
  // ...18 mais
}
```

Cada entry tem: `description` (o que exibe), `example` (payload valido contra o schema), `use_when` (quando usar em vez de markdown).

#### F-179d: `guides/rich-content/component-map.md`

Mapa de referencia para implementadores de frontend:

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

## Limites

- **NAO** criar componentes React — display tools emitem dados, o app consumidor renderiza
- **NAO** modificar o formato padrao de emissao SSE — `?format=datastream` eh alternativa, nao substituicao
- **NAO** alterar o ai-sdk neste PRP — schemas e tools sao responsabilidade do PRP-14A
- **NAO** escrever `schemas.json` manualmente — gerar via script para consistencia com Zod source of truth
- **NAO** adicionar logica de layout nos schemas — dados puros, frontend decide layout
- **GUIDE.md eh contrato publico** — apps consumidores dependem dele; manter atualizado quando schemas mudarem
- **Linguagem em pt-BR** — consistente com o restante do projeto

## Validacao

- [ ] `routes/datastream.ts` existe com `encodeDataStreamEvent()` exportada
- [ ] Evento `text` → prefixo `0:`, `reasoning` → `g:`, `tool-call` → `9:`, `tool-result` → `a:`
- [ ] Evento `step_finish` → `e:`, `usage` → `d:` com campos mapeados para convencao Vercel
- [ ] Eventos `init` e `result` → `null`
- [ ] `POST /conversations/:sessionId/messages?format=datastream` emite SSE no formato DataStream
- [ ] `POST /conversations/:sessionId/messages` (sem format) continua emitindo AgentEvent JSON
- [ ] Clientes existentes nao sao afetados — zero regressao
- [ ] `guides/rich-content/GUIDE.md` existe com todas as secoes obrigatorias
- [ ] `guides/rich-content/schemas.json` existe com JSON Schema para as 19 display tools
- [ ] `guides/rich-content/examples.json` existe com 19 exemplos canonicos validos
- [ ] `guides/rich-content/component-map.md` existe com mapa das 19 tools → componentes
- [ ] GUIDE.md explica como consumir via `useChat()` com `?format=datastream`
- [ ] GUIDE.md documenta fallback para display tools sem renderer
- [ ] Typecheck passa: nenhum erro TypeScript no backbone

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-177 DataStream Encoder | S-053 | RC-005 |
| F-178 DataStream Route | S-054 | RC-006 |
| F-179 Guia Rich Content | S-055 | RC-007, RC-008, RC-009, RC-010 |
