# Guia Rich Content — Display Tools

Este guia é a referência completa para integrar **display tools** no frontend, consumir o protocolo DataStream via `useChat()` e renderizar conteúdo rico emitido pelo agente.

---

## O que são display tools

Display tools são ferramentas cujo único propósito é **emitir conteúdo estruturado no stream de resposta**. Ao contrário de tools funcionais (que executam operações — busca, leitura de arquivo, chamada de API), display tools não têm efeito colateral: o agente as invoca para declarar *o quê* deve ser exibido, e o frontend decide *como* renderizar.

### Princípio de funcionamento

```
Agente invoca display_product(...)
        ↓
Backend emite evento tool-call  (toolName: "display_product", args: {...})
Backend emite evento tool-result (toolName: "display_product", result: {..., _display: true})
        ↓
Frontend recebe via DataStream
Frontend identifica: toolName começa com "display_" + result._display === true
Frontend renderiza <ProductCard /> com os dados do result
```

### Por que não usar markdown?

| Situação | Solução recomendada |
|---|---|
| Texto simples, listas, parágrafos | Markdown (text delta) |
| Produto com imagem, preço, rating | `display_product` |
| Gráfico com múltiplas séries | `display_chart` |
| Tabela com ordenação e tipos de coluna | `display_table` |
| Comparação lado a lado de produtos | `display_comparison` |
| Mapa com múltiplos pins | `display_map` |

Display tools entregam dados estruturados que permitem interatividade e layout rico — coisas que markdown não consegue expressar.

---

## Como consumir via `useChat()` com `?format=datastream`

O backend expõe a rota `POST /api/v1/ai/conversations/:sessionId/messages` com suporte ao parâmetro `?format=datastream`. Quando esse parâmetro está presente, o stream SSE usa o protocolo Vercel DataStream — compatível nativamente com `useChat()` do pacote `ai/react`.

### Setup

```tsx
import { useChat } from "ai/react";

function Chat({ sessionId }: { sessionId: string }) {
  const { messages, append, isLoading } = useChat({
    api: `/api/v1/ai/conversations/${sessionId}/messages?format=datastream`,
    streamProtocol: "data", // protocolo DataStream
  });

  return (
    <div>
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
    </div>
  );
}
```

### Renderizando tool invocations

O `useChat()` expõe `message.toolInvocations` para cada mensagem com chamadas de ferramenta:

```tsx
function Message({ message }: { message: Message }) {
  return (
    <div>
      {/* Texto da resposta */}
      {message.content && <p>{message.content}</p>}

      {/* Tool invocations (display tools + tools funcionais) */}
      {message.toolInvocations?.map((tool) => (
        <ToolRenderer key={tool.toolCallId} invocation={tool} />
      ))}
    </div>
  );
}

function ToolRenderer({ invocation }: { invocation: ToolInvocation }) {
  // Identificar display tools pelo prefixo e pela flag _display
  const isDisplay =
    invocation.toolName.startsWith("display_") &&
    invocation.state === "result" &&
    (invocation.result as any)?._display === true;

  if (!isDisplay) return null;

  return <DisplayToolRenderer name={invocation.toolName} result={invocation.result} />;
}
```

---

## Como identificar display tools no stream

Há dois indicadores que distinguem uma display tool de uma tool funcional:

### 1. Prefixo `display_` no `toolName`

Todo evento `tool-call` ou `tool-result` cuja propriedade `toolName` começa com `display_` é uma display tool.

```
tool-result → toolName: "display_product"   ← display tool
tool-result → toolName: "bash"              ← tool funcional
tool-result → toolName: "web_search"        ← tool funcional
```

### 2. Flag `_display: true` no `result`

O campo `result` de toda display tool sempre contém `_display: true`. Isso permite distinguir display tools mesmo em contextos onde o `toolName` não está disponível.

```json
{
  "toolCallId": "tc_abc123",
  "toolName": "display_product",
  "result": {
    "_display": true,
    "title": "Pneu Levorin Praieiro 26x1.95",
    "price": { "value": 35.90, "currency": "BRL" }
  }
}
```

### Verificação dupla recomendada

```tsx
function isDisplayTool(toolName: string, result: unknown): boolean {
  return (
    toolName.startsWith("display_") &&
    typeof result === "object" &&
    result !== null &&
    (result as any)._display === true
  );
}
```

---

## Catálogo das 19 display tools

### Métricas e Dados

#### `display_metric`
Exibe um valor métrico isolado com label, unidade e tendência.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `label` | string | sim |
| `value` | string \| number | sim |
| `unit` | string | não |
| `trend` | `{ direction: "up"\|"down"\|"neutral", value: string }` | não |
| `icon` | string | não |

**Quando usar em vez de markdown:** KPIs, indicadores de desempenho, métricas de sistema com seta de tendência.

**Schema:** `display_metric` em `schemas.json`

---

#### `display_chart`
Renderiza um gráfico de barras, linhas, pizza, área ou donut.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `type` | `"bar"\|"line"\|"pie"\|"area"\|"donut"` | sim |
| `title` | string | sim |
| `data` | `Array<{ label, value, color? }>` | sim |
| `format` | `{ prefix?, suffix?, locale? }` | não |

**Quando usar em vez de markdown:** Séries temporais, distribuições, comparações numéricas que se beneficiam de visualização.

**Schema:** `display_chart` em `schemas.json`

---

#### `display_table`
Tabela estruturada com tipos de coluna e ordenação opcional.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `columns` | `Array<{ key, label, type?, align? }>` | sim |
| `rows` | `Array<Record<string, unknown>>` | sim |
| `title` | string | não |
| `sortable` | boolean | não (default: false) |

**Tipos de coluna disponíveis:** `text`, `number`, `money`, `image`, `link`, `badge`.

**Quando usar em vez de markdown:** Tabelas com mais de 3 colunas, dados heterogêneos, necessidade de ordenação ou tipos especiais de célula.

**Schema:** `display_table` em `schemas.json`

---

#### `display_progress`
Sequência de etapas com status (concluída, atual, pendente).

| Campo | Tipo | Obrigatório |
|---|---|---|
| `steps` | `Array<{ label, status, description? }>` | sim |
| `title` | string | não |

**Status disponíveis:** `completed`, `current`, `pending`.

**Quando usar em vez de markdown:** Processos com fases claras, onboarding, pipelines.

**Schema:** `display_progress` em `schemas.json`

---

### Produtos e Comércio

#### `display_product`
Card de produto com imagem, preço, rating, badges e fonte.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `title` | string | sim |
| `image` | string (url) | não |
| `price` | `{ value, currency }` | não |
| `originalPrice` | `{ value, currency }` | não |
| `rating` | `{ score: 0-5, count }` | não |
| `source` | `{ name, url, favicon? }` | não |
| `badges` | `Array<{ label, variant }>` | não |
| `url` | string (url) | não |
| `description` | string | não |

**Quando usar em vez de markdown:** Qualquer resultado de pesquisa de produto.

**Schema:** `display_product` em `schemas.json`

---

#### `display_comparison`
Comparação lado a lado de múltiplos produtos.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `items` | `Array<DisplayProduct>` | sim |
| `title` | string | não |
| `attributes` | `Array<{ key, label }>` | não |

**Quando usar em vez de markdown:** "Qual o melhor entre X, Y e Z?" — resposta estruturada com atributos comparáveis.

**Schema:** `display_comparison` em `schemas.json`

---

#### `display_price`
Destaque de preço unitário com contexto e fonte.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `value` | `{ value, currency }` | sim |
| `label` | string | sim |
| `context` | string | não |
| `source` | `{ name, url }` | não |
| `badge` | `{ label, variant }` | não |

**Quando usar em vez de markdown:** Cotação de um único item, preço de referência, valor de serviço.

**Schema:** `display_price` em `schemas.json`

---

### Mídia

#### `display_image`
Imagem única com legenda e dimensões.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `url` | string (url) | sim |
| `alt` | string | não |
| `caption` | string | não |
| `width` | number | não |
| `height` | number | não |

**Quando usar em vez de markdown:** Quando precisar de legenda, dimensões ou controle de layout.

**Schema:** `display_image` em `schemas.json`

---

#### `display_gallery`
Grade ou masonry de múltiplas imagens.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `images` | `Array<{ url, alt?, caption? }>` | sim |
| `title` | string | não |
| `layout` | `"grid"\|"masonry"` | não (default: grid) |
| `columns` | number (2-5) | não (default: 3) |

**Quando usar em vez de markdown:** Resultados de busca de imagens, portfólios, catálogos visuais.

**Schema:** `display_gallery` em `schemas.json`

---

#### `display_carousel`
Carrossel de cards com imagem, título, preço e link.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `items` | `Array<{ title, image?, subtitle?, price?, url?, badges? }>` | sim |
| `title` | string | não |

**Quando usar em vez de markdown:** Lista de produtos, sugestões, destaques que se beneficiam de navegação horizontal.

**Schema:** `display_carousel` em `schemas.json`

---

### Referências e Navegação

#### `display_sources`
Lista de fontes consultadas com snippet e favicon.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `sources` | `Array<{ title, url, favicon?, snippet? }>` | sim |
| `label` | string | não (default: "Fontes consultadas") |

**Quando usar em vez de markdown:** Sempre que o agente consultou URLs externas — transparência de fontes.

**Schema:** `display_sources` em `schemas.json`

---

#### `display_link`
Preview de link com título, descrição, imagem e domínio.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `url` | string (url) | sim |
| `title` | string | sim |
| `description` | string | não |
| `image` | string (url) | não |
| `favicon` | string (url) | não |
| `domain` | string | não |

**Quando usar em vez de markdown:** Link único que merece destaque visual com preview.

**Schema:** `display_link` em `schemas.json`

---

#### `display_map`
Mapa com pins e zoom configurável.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `pins` | `Array<{ lat, lng, label?, address? }>` | sim |
| `title` | string | não |
| `zoom` | number (1-20) | não (default: 14) |

**Quando usar em vez de markdown:** Localização de estabelecimentos, rotas, pontos de referência geográfica.

**Schema:** `display_map` em `schemas.json`

---

### Documentos e Arquivos

#### `display_file`
Card de arquivo com nome, tipo, tamanho e preview.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `name` | string | sim |
| `type` | string | sim |
| `size` | number | não |
| `url` | string (url) | não |
| `preview` | string | não |

**Quando usar em vez de markdown:** Referência a arquivos para download ou visualização.

**Schema:** `display_file` em `schemas.json`

---

#### `display_code`
Bloco de código com syntax highlighting.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `language` | string | sim |
| `code` | string | sim |
| `title` | string | não |
| `lineNumbers` | boolean | não (default: true) |

**Quando usar em vez de markdown:** Quando precisar de título, números de linha configuráveis ou controle fino sobre a linguagem. Para código inline simples, markdown ` ``` ` é suficiente.

**Schema:** `display_code` em `schemas.json`

---

#### `display_spreadsheet`
Planilha com headers tipados e formatação de colunas monetárias/percentuais.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `headers` | `Array<string>` | sim |
| `rows` | `Array<Array<string \| number \| null>>` | sim |
| `title` | string | não |
| `format` | `{ moneyColumns?, percentColumns? }` | não |

**Quando usar em vez de markdown:** Dados financeiros, planilhas exportadas, relatórios tabulares com formatação especial.

**Schema:** `display_spreadsheet` em `schemas.json`

---

### Interativo

#### `display_steps`
Timeline de etapas com orientação vertical ou horizontal.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `steps` | `Array<{ title, description?, status? }>` | sim |
| `title` | string | não |
| `orientation` | `"vertical"\|"horizontal"` | não (default: vertical) |

**Quando usar em vez de markdown:** Tutoriais passo a passo, processos sequenciais com descrições detalhadas por etapa.

**Schema:** `display_steps` em `schemas.json`

---

#### `display_alert`
Alerta com variante visual (info, warning, error, success).

| Campo | Tipo | Obrigatório |
|---|---|---|
| `variant` | `"info"\|"warning"\|"error"\|"success"` | sim |
| `message` | string | sim |
| `title` | string | não |
| `icon` | string | não |

**Quando usar em vez de markdown:** Avisos importantes, erros de validação, confirmações — quando a cor e o ícone da variante são essenciais para a comunicação.

**Schema:** `display_alert` em `schemas.json`

---

#### `display_choices`
Conjunto de opções clicáveis para o usuário escolher.

| Campo | Tipo | Obrigatório |
|---|---|---|
| `choices` | `Array<{ id, label, description?, icon? }>` | sim |
| `question` | string | não |
| `layout` | `"buttons"\|"cards"\|"list"` | não (default: buttons) |

**Quando usar em vez de markdown:** Perguntas de múltipla escolha, menus de navegação, seleção de fluxo — quando o frontend precisa capturar a escolha do usuário.

**Schema:** `display_choices` em `schemas.json`

---

## Fallback para display tools sem renderer

Nem todo frontend implementa todos os 19 renderers. A regra de fallback é:

> **Nunca quebrar. Sempre exibir algo.**

### Estratégia recomendada

```tsx
function DisplayToolRenderer({
  name,
  result,
}: {
  name: string;
  result: Record<string, unknown>;
}) {
  const { _display, ...data } = result;

  // Mapa de renderers registrados
  const renderers: Record<string, React.ComponentType<any>> = {
    display_metric: MetricCard,
    display_chart: Chart,
    display_product: ProductCard,
    // ... demais renderers implementados
  };

  const Component = renderers[name];

  if (Component) {
    return <Component {...data} />;
  }

  // Fallback: JSON formatado com indicação do tipo
  return (
    <div className="rounded border p-3 text-sm font-mono bg-muted">
      <p className="text-xs text-muted-foreground mb-2">{name}</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### Princípios do fallback

1. **Nunca lançar erro** — um renderer ausente nunca deve quebrar a renderização da mensagem
2. **Exibir o tipo** — mostrar o `toolName` no fallback ajuda o desenvolvedor a identificar o que implementar
3. **JSON formatado** — o payload completo deve ser visível para depuração
4. **Não ocultar** — evitar `return null` — o conteúdo foi emitido pelo agente e deve ser exibido de alguma forma

### Implementação progressiva

É válido começar com apenas os renderers mais usados (`display_product`, `display_metric`, `display_chart`) e expandir conforme necessário. O fallback cobre os demais.

---

## Canais pobres (WhatsApp e similares)

Canais como WhatsApp, SMS e outros que não suportam rich content recebem apenas o **texto markdown** das respostas do agente, sem os payloads de display tools.

### Como funciona

O agente é instruído a sempre emitir texto descritivo **além** das display tools. As display tools complementam o texto — não o substituem.

```
Texto: "Encontrei o produto abaixo com o menor preço disponível:"
display_product: { title: "Pneu Levorin...", price: {...} }
Texto: "O preço de R$ 35,90 é 12% menor que a média do mercado."
```

Em canais pobres, o canal adapter filtra os eventos `tool-call`/`tool-result` com `toolName.startsWith("display_")` e entrega apenas os deltas de texto.

### Regra de autoria para o agente

O agente deve sempre incluir informação suficiente no texto para que a resposta faça sentido sem as display tools. Display tools enriquecem — não são a resposta em si.

### Implementação no canal adapter

```typescript
// Filtro no adapter de canal pobre (ex: WhatsApp)
for await (const event of stream) {
  if (event.type === "text") {
    await channel.send(event.content);
  }
  // tool-call e tool-result com prefixo display_ são ignorados
  // tool-result de tools funcionais relevantes podem ser textualizados
}
```

---

## Referências

- **Schemas Zod:** `apps/packages/ai-sdk/src/display-schemas.ts`
- **Display Tools (AI SDK):** `apps/packages/ai-sdk/src/tools/display.ts`
- **DataStream Encoder:** `apps/backbone/src/routes/datastream.ts`
- **Rota de conversação:** `apps/backbone/src/routes/conversations.ts`
- **JSON Schema das 19 tools:** `guides/rich-content/schemas.json`
- **Exemplos canônicos:** `guides/rich-content/examples.json`
- **Mapa componente → renderer:** `guides/rich-content/component-map.md`
- **Spec técnica:** `sprints/sprint-11/2-specs/S-055-rich-content-guide.md`
