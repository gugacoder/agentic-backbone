# Brainstorming — Sprint 12 | Wave 5

**Sprint:** 12 | **Wave:** 5 | **Data:** 2026-03-29

---

## Contexto

Sprint 12 é um sprint de **implementação**. A tarefa definida em `TASK.md` é o **PRP-15 — ai-chat: Pacote React de Chat Rico**.

### Objetivo do PRP-15

Criar o pacote `@agentic-backbone/ai-chat` — biblioteca React reutilizável que entrega experiência completa de chat rico out-of-the-box. O pacote consome o stream do backbone via Vercel AI SDK `useChat`, renderiza `message.parts` tipados (texto, reasoning, tool calls, display tools) e inclui os 19 renderers de display tools do PRP-14.

**Implementação de referência:** refatorar `/conversations` no Hub para usar o pacote.

### Dependências satisfeitas

O PRP-15 depende do PRP-13 (Rich Stream) e PRP-14 (Rich Content), ambos implementados no Sprint 11. A verificação do código confirma:

| Artefato | Estado |
|---|---|
| `apps/packages/ai-sdk/src/display-schemas.ts` | ✅ 276 linhas — 19 schemas Zod completos |
| `apps/packages/ai-sdk/src/tools/display.ts` | ✅ 122 linhas — createDisplayTools() com 19 tools |
| `apps/packages/ai-sdk/src/agent.ts` | ✅ Registra `displayTools` em `allTools` |
| `apps/packages/ai-sdk/src/index.ts` | ✅ Exporta todos os schemas/tipos de display |
| `apps/backbone/src/routes/datastream.ts` | ✅ encodeDataStreamEvent() implementada |
| `apps/backbone/src/routes/conversations.ts` | ✅ Suporta `?format=datastream` |
| `guides/rich-content/GUIDE.md` | ✅ Guia completo de integração |
| `guides/rich-content/schemas.json` | ✅ JSON Schema para clientes não-TypeScript |
| `guides/rich-content/examples.json` | ✅ Exemplos canônicos dos 19 display tools |
| `guides/rich-content/component-map.md` | ✅ Mapa toolName → componente React + libs |

---

## Funcionalidades Mapeadas (Estado Atual do Código)

### `apps/packages/ai-sdk/` (PRP-14 — implementado)

| Arquivo | Estado | Conteúdo |
|---|---|---|
| `display-schemas.ts` | ✅ | 19 schemas Zod: DisplayMetric, DisplayChart, DisplayTable, DisplayProgress, DisplayProduct, DisplayComparison, DisplayPrice, DisplayImage, DisplayGallery, DisplayCarousel, DisplaySources, DisplayLink, DisplayMap, DisplayFile, DisplayCode, DisplaySpreadsheet, DisplaySteps, DisplayAlert, DisplayChoices |
| `tools/display.ts` | ✅ | createDisplayTools() retorna mapa com 19 tools AI SDK |
| `index.ts` | ✅ | Exporta DisplayToolRegistry, todos os schemas e tipos |

### `apps/backbone/src/routes/` (DataStream — implementado)

| Arquivo | Estado | Conteúdo |
|---|---|---|
| `datastream.ts` | ✅ | encodeDataStreamEvent(): AgentEvent → prefixos 0:, 9:, a:, e:, d:, g: |
| `conversations.ts` | ✅ | Aceita `?format=datastream`, emite SSE no formato Vercel |

### `apps/hub/src/` (Chat Hub — legado, a ser refatorado)

| Arquivo | Estado | Observação |
|---|---|---|
| `lib/chat-stream.ts` | ⚠️ 75 linhas | Streaming manual via fetch + SSE parsing — substituto: `useChat` do `ai/react` |
| `components/chat/message-bubble.tsx` | ⚠️ 113 linhas | Renderiza markdown plano sem parts tipados — sem reasoning, sem tool activity |
| `components/chat/message-list.tsx` | ⚠️ 101 linhas | Lista com auto-scroll funcional mas acoplada ao Hub |
| `components/chat/message-input.tsx` | ⚠️ Existe | Input com Enter/Shift+Enter, acoplado ao Hub |
| `components/chat/streaming-indicator.tsx` | ⚠️ Existe | Cursor piscante, acoplado ao Hub |
| `components/conversations/conversation-chat.tsx` | ⚠️ 488 linhas | Página completa com header, takeover, feedback — a manter como wrapper fino |
| `components/conversations/conversations-layout.tsx` | ✅ Manter | Sidebar com busca/filtro/favoritos — lógica de negócio do Hub, não vai para o pacote |

### `apps/chat/src/` (Chat PWA — app separado)

Tem seus próprios `message-bubble.tsx`, `message-input.tsx`, `message-list.tsx`, `streaming-indicator.tsx` — duplicação idêntica aos do Hub. O pacote ai-chat beneficia ambos.

### `apps/packages/` (pacote ai-chat — ausente)

`apps/packages/ai-chat/` **não existe**. Nenhum arquivo do pacote foi criado.

---

## Lacunas e Oportunidades

### AC-001 — GAP CRÍTICO: Pacote `apps/packages/ai-chat/` não existe
Nenhum arquivo do pacote foi criado. O scaffold completo (package.json, tsconfig.json, estrutura src/) é pré-requisito absoluto de todas as outras fases. Sem este scaffold, nenhum componente pode ser desenvolvido ou referenciado.

### AC-002 — GAP CRÍTICO: ChatProvider.tsx + useBackboneChat.ts ausentes
O núcleo do pacote — encapsulamento de `useChat` do `ai/react` com configuração backbone (`endpoint`, `token`, `sessionId`, `?format=datastream`) — não existe. Sem ele, o streaming rico via DataStream protocol não chega aos componentes React.

### AC-003 — GAP: Markdown.tsx + StreamingIndicator.tsx não são portáveis
Os equivalentes existem no Hub e no app chat, mas estão acoplados a cada app. O pacote ai-chat precisa de versões próprias e portáveis, compatíveis com `react-markdown` + `remark-gfm` + `rehype-highlight`.

### AC-004 — GAP: styles.css com CSS variables ausente
O Hub usa Tailwind classes diretas nos componentes de chat. O pacote precisa usar CSS variables (`.ai-chat` namespace) para não acoplar ao Tailwind config do consumidor. Compatível com shadcn tokens.

### AC-005 — GAP: ReasoningBlock.tsx ausente
Nenhum componente React renderiza o `part.type === "reasoning"` do stream. O agente já emite reasoning (PRP-13), mas o Hub exibe apenas markdown — o raciocínio é descartado silenciosamente.

### AC-006 — GAP: ToolActivity.tsx ausente
Nenhum componente renderiza `part.type === "tool-invocation"` com `state === "call"` — o spinner de atividade da tool não existe. O usuário não vê o que o agente está fazendo em tempo real.

### AC-007 — GAP: ToolResult.tsx ausente
O resultado de tools funcionais não é exibido de forma inspecionável. Ausência dificulta debugging e visibilidade de operações do agente.

### AC-008 — GAP: 8 display renderers simples ausentes
Alert, MetricCard, PriceHighlight, FileCard, CodeBlock, SourcesList, StepTimeline e ProgressSteps não existem como componentes React portáveis. As display tools do ai-sdk emitem esses dados, mas nenhum app os renderiza como componente rico.

### AC-009 — GAP: Chart (recharts) e Carousel (embla) ausentes
Os dois renderers que dependem de libs externas (recharts para gráficos, embla-carousel-react para carrosseis) não existem. São casos de uso de alto impacto para dashboards e e-commerce.

### AC-010 — GAP: 9 display renderers compostos ausentes
ProductCard, ComparisonTable, DataTable, Spreadsheet, Gallery, ImageViewer, LinkPreview, MapView e ChoiceButtons completam o catálogo de 19 renderers. ChoiceButtons e ProductCard são críticos para o caso de uso Pneu SOS.

### AC-011 — GAP CRÍTICO: PartRenderer.tsx ausente
O switch central que mapeia `part.type` → componente React não existe. É a peça que conecta todos os outros componentes (reasoning, tools, display). Sem ele, MessageBubble não sabe qual componente renderizar.

### AC-012 — GAP: registry.ts + display/index.ts ausentes
O mapa `toolName → componente React` (defaultDisplayRenderers) e a infraestrutura de extensão por override não existem. Sem registry, o app consumidor não pode sobrescrever renderers individuais.

### AC-013 — GAP: MessageBubble.tsx, MessageList.tsx, MessageInput.tsx portáveis ausentes
As versões do Hub existem mas são acopladas. O pacote precisa de versões próprias que iteram `message.parts` via PartRenderer, com auto-scroll, abort e auto-expand independentes do Hub.

### AC-014 — GAP: Chat.tsx (componente principal) + index.ts exports ausentes
O componente auto-suficiente `<Chat endpoint token sessionId />` não existe. Sem ele, o consumidor precisa compor manualmente todos os subcomponentes.

### AC-015 — GAP: Pacote não está no npm workspace
Mesmo quando criado, `@agentic-backbone/ai-chat` precisa ser registrado no `package.json` raiz (workspaces) e as deps instaladas, para que imports no Hub e no app chat funcionem.

### AC-016 — GAP: Hub não usa o pacote ai-chat
`conversation-chat.tsx` continua usando `chat-stream.ts` manual e os componentes legados. A refatoração para `<Chat />` e remoção dos arquivos redundantes valida o pacote na prática.

### AC-017 — GAP: Configuração GitHub Packages ausente
Os dois pacotes (`ai-sdk` e `ai-chat`) não têm `.npmrc`, `publishConfig` ou `repository` configurados. Scripts `publish:*` e `version:*` na raiz também ausentes.

---

## Priorização

| ID | Descrição | Score | Justificativa |
|---|---|---|---|
| AC-001 | Scaffold do pacote ai-chat | 10 | Pré-requisito absoluto; bloqueante de tudo |
| AC-002 | ChatProvider + useBackboneChat | 10 | Núcleo do pacote; substitui streaming manual |
| AC-011 | PartRenderer.tsx | 10 | Switch central; conecta todos os sub-componentes |
| AC-005 | ReasoningBlock.tsx | 9 | Resolve D-020 (opacidade do agente); alto valor percebido |
| AC-008 | 8 renderers simples | 9 | Entrega 8/19 renderers sem deps pesadas |
| AC-013 | MessageBubble + MessageList + MessageInput | 9 | UI principal do chat; substituem legado Hub |
| AC-014 | Chat.tsx + index.ts | 9 | Entregável final; valida composição completa |
| AC-006 | ToolActivity.tsx | 8 | Resolve D-001 (caixa preta); visibilidade em tempo real |
| AC-009 | Chart + Carousel | 8 | Casos de uso e-commerce/analytics de alto impacto |
| AC-010 | 9 renderers compostos | 8 | Completa catálogo; ChoiceButtons crítico para Pneu SOS |
| AC-012 | registry.ts + display/index.ts | 8 | Extensibilidade; defaultDisplayRenderers completo |
| AC-016 | Refatoração Hub | 8 | Valida pacote na prática; reduz Hub de ~1400 para wrapper fino |
| AC-003 | Markdown + StreamingIndicator | 8 | Base de renderização de texto; dep de MessageBubble |
| AC-007 | ToolResult.tsx | 7 | Complementa ToolActivity; debugging e visibilidade |
| AC-015 | Registrar no workspace + install deps | 7 | Prerequisito da refatoração Hub |
| AC-004 | styles.css | 7 | Portabilidade; consumidor sem Tailwind funciona |
| AC-017 | GitHub Packages config | 6 | Preparação para distribuição externa; não bloqueia MVP |

**Ordem lógica de execução** (respeita dependências):
1. AC-001 (scaffold)
2. AC-002 + AC-003 + AC-004 (paralelos — provider, markdown, estilos)
3. AC-005 + AC-006 + AC-007 + AC-008 (paralelos — parts e renderers simples)
4. AC-009 + AC-010 (paralelos — renderers com lib e compostos)
5. AC-011 (PartRenderer — aguarda todos os componentes)
6. AC-012 (registry — aguarda PartRenderer)
7. AC-013 (MessageBubble/List/Input — aguarda registry)
8. AC-014 (Chat.tsx + index.ts — aguarda MessageBubble)
9. AC-015 (workspace register + install)
10. AC-016 (refatoração Hub — aguarda install)
11. AC-017 (GitHub Packages — independente, pode ser paralelo)
