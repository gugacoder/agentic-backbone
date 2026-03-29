# PRP 15 — ai-chat: Pacote React de Chat Rico

Criar o pacote `@agentic-backbone/ai-chat` — biblioteca React que entrega experiencia completa de chat rico out-of-the-box, consumindo o stream do backbone via Vercel AI SDK `useChat`. Inclui renderers para todos os display tools (PRP 14), blocos de reasoning, timeline de tools, e markdown rico. Implementacao de referencia: refatorar `/conversations` no Hub para usar o pacote.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

O Hub (`apps/hub.old/`) tem chat funcional com:

- `chat-stream.ts` — streaming via fetch + parsing manual de SSE (76 linhas)
- `MessageBubble.tsx` — bolha simples com markdown via `react-markdown` (113 linhas)
- `MessageList.tsx` — lista com auto-scroll inteligente (102 linhas)
- `MessageInput.tsx` — textarea expansivel com Enter/Shift+Enter (93 linhas)
- `ConversationChatPage.tsx` — pagina completa com header, takeover, feedback (489 linhas)
- `ConversationsLayout.tsx` — sidebar de conversas com busca/filtro/favoritos (566 linhas)

**Problemas**:

1. Streaming manual (`chat-stream.ts`) reimplementa o que `useChat` do `ai/react` ja faz
2. `MessageBubble` renderiza tudo como markdown plano — sem reasoning, sem tool activity, sem display tools
3. Nao existe separacao entre "pacote reutilizavel" e "pagina do Hub" — tudo esta acoplado ao Hub
4. Apps consumidores (Pneu SOS) precisam reimplementar tudo do zero

### Estado desejado

1. `@agentic-backbone/ai-chat` entrega componentes React reutilizaveis para qualquer app
2. Hub refatorado usa o pacote — zero logica de chat duplicada
3. Consumidor instala, aponta pro backbone, e tem experiencia rica completa
4. Display tools renderizadas automaticamente — sem config no app

### Dependencias

- **PRP 13** (Rich Stream) — stream emite `reasoning`, `tool-call`, `tool-result`
- **PRP 14** (Rich Content) — display tools existem e seus schemas sao exportados pelo ai-sdk

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Chat no Hub | ~1400 linhas acopladas ao Hub | Pacote `ai-chat` + pagina fina no Hub |
| Streaming | `chat-stream.ts` manual | `useChat` do `ai/react` |
| Renderizacao de mensagem | Markdown plano | Parts tipados (reasoning + tools + display + markdown) |
| Reuso entre apps | Copiar e colar | `npm install @agentic-backbone/ai-chat` |
| Display tools no chat | Inexistente | 19 renderers built-in |

---

## Especificacao

### 1. Estrutura do pacote

#### 1.1 Diretorio: `apps/packages/ai-chat/`

```
apps/packages/ai-chat/
  package.json
  tsconfig.json
  src/
    index.ts                       ← exports publicos
    Chat.tsx                       ← componente principal
    ChatProvider.tsx                ← context provider (config, auth)
    MessageList.tsx                 ← lista de mensagens com auto-scroll
    MessageBubble.tsx              ← bolha que itera message.parts
    MessageInput.tsx               ← input com auto-expand + abort
    Markdown.tsx                   ← react-markdown + remark-gfm + rehype
    StreamingIndicator.tsx         ← cursor piscante
    parts/
      ReasoningBlock.tsx           ← bloco colapsavel de pensamento
      ToolActivity.tsx             ← card de tool-call em execucao (spinner + nome + args)
      ToolResult.tsx               ← resultado de tool funcional (JSON colapsavel)
      PartRenderer.tsx             ← switch central: part.type → componente
    display/
      index.ts                     ← registry de display renderers
      MetricCard.tsx
      Chart.tsx
      DataTable.tsx
      ProductCard.tsx
      Carousel.tsx
      Gallery.tsx
      PriceHighlight.tsx
      ComparisonTable.tsx
      SourcesList.tsx
      LinkPreview.tsx
      MapView.tsx
      FileCard.tsx
      CodeBlock.tsx
      Spreadsheet.tsx
      ProgressSteps.tsx
      StepTimeline.tsx
      Alert.tsx
      ChoiceButtons.tsx
    hooks/
      useBackboneChat.ts           ← wrapper de useChat com config backbone
    types.ts                       ← tipos publicos do pacote
    registry.ts                    ← mapa toolName → componente, extensivel
    styles.css                     ← estilos base (Tailwind-compatible)
```

#### 1.2 Arquivo: `apps/packages/ai-chat/package.json`

```json
{
  "name": "@agentic-backbone/ai-chat",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "peerDependencies": {
    "react": "^19",
    "react-dom": "^19",
    "ai": "^4"
  },
  "dependencies": {
    "@agentic-backbone/ai-sdk": "workspace:*",
    "react-markdown": "^10",
    "remark-gfm": "^4",
    "rehype-raw": "^7",
    "rehype-highlight": "^7",
    "recharts": "^3",
    "lucide-react": "^0.577",
    "embla-carousel-react": "^8"
  }
}
```

`react`, `react-dom` e `ai` sao peer dependencies — o app consumidor ja os tem. `@agentic-backbone/ai-sdk` eh workspace dependency para acesso aos schemas Zod das display tools.

### 2. Componente principal — Chat

#### 2.1 Arquivo: `src/Chat.tsx`

Componente auto-suficiente. O consumidor minimo:

```tsx
import { Chat } from "@agentic-backbone/ai-chat";

<Chat
  endpoint="https://backbone:6002/api/v1/ai"
  token="eyJ..."
  sessionId="abc-123"
/>
```

Props:

```typescript
export interface ChatProps {
  /** URL base do backbone (ex: https://backbone:6002/api/v1/ai) */
  endpoint: string;
  /** JWT token para autenticacao */
  token: string;
  /** ID da sessao/conversa */
  sessionId: string;
  /** Mensagens iniciais (historico pre-carregado). Opcional. */
  initialMessages?: Message[];
  /** Renderers customizados para display tools (merge com built-in). Opcional. */
  displayRenderers?: Record<string, React.ComponentType<any>>;
  /** Callback quando usuario envia mensagem. Opcional. */
  onSend?: (content: string) => void;
  /** Callback quando resposta completa. Opcional. */
  onResponse?: (message: Message) => void;
  /** Callback quando usuario clica em choice (display_choices). Opcional. */
  onChoice?: (choiceId: string) => void;
  /** Placeholder do input. Default: "Digite sua mensagem..." */
  placeholder?: string;
  /** Desabilita input (ex: durante takeover). Default: false */
  disabled?: boolean;
  /** Classe CSS do container. Opcional. */
  className?: string;
  /** Mostra indicador de custo/tokens. Default: false */
  showUsage?: boolean;
}
```

Internamente, `Chat` compoe:

```tsx
<ChatProvider endpoint={endpoint} token={token} sessionId={sessionId}>
  <div className={className}>
    <MessageList displayRenderers={mergedRenderers} />
    <MessageInput placeholder={placeholder} disabled={disabled} />
  </div>
</ChatProvider>
```

#### 2.2 Arquivo: `src/ChatProvider.tsx`

Context provider que encapsula `useChat` do `ai/react`:

```typescript
interface ChatContext {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: () => void;
  isLoading: boolean;
  stop: () => void;
  reload: () => void;
  error: Error | undefined;
}
```

Configura `useChat` com:

```typescript
useChat({
  api: `${endpoint}/conversations/${sessionId}/messages?format=datastream`,
  headers: { Authorization: `Bearer ${token}` },
  initialMessages,
  onFinish: onResponse,
});
```

### 3. Renderizacao de parts

#### 3.1 Arquivo: `src/parts/PartRenderer.tsx`

Switch central que recebe um `part` do `message.parts` e retorna o componente correto:

```typescript
export function PartRenderer({ part, displayRenderers }: PartRendererProps) {
  // Texto → markdown
  if (part.type === "text") {
    return <Markdown>{part.text}</Markdown>;
  }

  // Reasoning → bloco colapsavel
  if (part.type === "reasoning") {
    return <ReasoningBlock content={part.reasoning} />;
  }

  // Tool invocation
  if (part.type === "tool-invocation") {
    // Display tool → renderer especifico
    if (part.toolName.startsWith("display_")) {
      const Renderer = displayRenderers[part.toolName];
      if (Renderer && part.state === "result") {
        return <Renderer {...part.result} />;
      }
      if (part.state === "call") {
        return null; // display tools nao mostram estado "chamando"
      }
      // Fallback: JSON formatado
      return <ToolResult toolName={part.toolName} result={part.result} />;
    }

    // Tool funcional → card de atividade
    if (part.state === "call") {
      return <ToolActivity toolName={part.toolName} args={part.args} />;
    }
    if (part.state === "result") {
      return <ToolResult toolName={part.toolName} result={part.result} />;
    }
  }

  return null;
}
```

#### 3.2 Arquivo: `src/parts/ReasoningBlock.tsx`

- Bloco com icone de "pensamento" (Brain icon do Lucide)
- Texto em fonte menor, cor muted
- Colapsavel: durante streaming fica aberto; apos conclusao colapsa automaticamente
- Click para expandir/colapsar
- Agrupa deltas consecutivos de reasoning num unico bloco

#### 3.3 Arquivo: `src/parts/ToolActivity.tsx`

- Card compacto com icone por tool (mapa hardcoded: WebSearch → Globe, Bash → Terminal, etc.)
- Nome da tool + resumo dos args (ex: `WebSearch: "pneu aro 26 preco"`)
- Spinner animado enquanto `state === "call"`
- Transiciona para check quando `state === "result"`
- Colapsavel: expandir mostra args completos

#### 3.4 Arquivo: `src/parts/ToolResult.tsx`

- JSON formatado e colapsavel para tools funcionais
- Header com nome da tool + status (sucesso/erro)
- Corpo colapsado por default (expandir mostra JSON completo)
- Erros em vermelho

### 4. Display renderers

#### 4.1 Arquivo: `src/display/index.ts`

Registry default:

```typescript
import { MetricCard } from "./MetricCard.js";
import { Chart } from "./Chart.js";
import { DataTable } from "./DataTable.js";
// ...todos os 19

export const defaultDisplayRenderers: Record<string, React.ComponentType<any>> = {
  display_metric: MetricCard,
  display_chart: Chart,
  display_table: DataTable,
  display_progress: ProgressSteps,
  display_product: ProductCard,
  display_comparison: ComparisonTable,
  display_price: PriceHighlight,
  display_image: ImageViewer,
  display_gallery: Gallery,
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
```

#### 4.2 Especificacao dos renderers

Cada renderer recebe as props tipadas pelo schema Zod correspondente (importado do ai-sdk).

| Renderer | Lib externa | Notas |
|---|---|---|
| `MetricCard` | — | Valor grande + label + seta trend + cor |
| `Chart` | recharts | Bar, Line, Pie, Area, Donut. ResponsiveContainer |
| `DataTable` | — | Tabela HTML estilizada. Colunas tipadas (money → formato BRL, image → thumbnail, badge → chip colorido). Sortable opcional |
| `ProgressSteps` | — | Stepper vertical/horizontal. Icones check/current/pending |
| `ProductCard` | — | Imagem + titulo + preco + rating stars + source badge + link. Layout card com sombra |
| `ComparisonTable` | — | Grid de ProductCards lado a lado + tabela de atributos abaixo |
| `PriceHighlight` | — | Preco em fonte grande (2xl+), label acima, contexto abaixo, badge opcional |
| `ImageViewer` | — | Imagem com caption. Click para zoom (dialog fullscreen) |
| `Gallery` | — | Grid de imagens. Click abre viewer. Layout grid ou masonry |
| `Carousel` | embla-carousel-react | Cards horizontais com setas prev/next. Touch-friendly |
| `SourcesList` | — | Lista vertical. Cada item: favicon (img 16x16) + titulo link + snippet. Estilo Perplexity |
| `LinkPreview` | — | Card com OG image + titulo + descricao + dominio. Clicavel |
| `MapView` | iframe OpenStreetMap | Pins via URL params no iframe. Sem lib pesada de mapa |
| `FileCard` | — | Icone por tipo (PDF/DOCX/XLSX) + nome + tamanho. Botao download se url presente |
| `CodeBlock` | highlight.js (via rehype-highlight) | Syntax highlighting + botao copy + titulo opcional |
| `Spreadsheet` | — | Tabela HTML com headers fixos. Formatacao monetaria/percentual nas colunas indicadas |
| `StepTimeline` | — | Timeline vertical com icones por status. Descricao colapsavel |
| `Alert` | — | Banner com icone por variant (Info/AlertTriangle/XCircle/CheckCircle do Lucide) + titulo + mensagem |
| `ChoiceButtons` | — | Botoes ou cards clicaveis. Emite evento via `onChoice` do ChatProvider |

### 5. Hook useBackboneChat

#### 5.1 Arquivo: `src/hooks/useBackboneChat.ts`

Wrapper de `useChat` para consumidores que querem controle fino (sem usar `<Chat />`):

```typescript
export function useBackboneChat(options: UseBackboneChatOptions) {
  return useChat({
    api: `${options.endpoint}/conversations/${options.sessionId}/messages?format=datastream`,
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
    },
    body: { message: undefined }, // sera preenchido por handleSubmit
    initialMessages: options.initialMessages,
    onFinish: options.onResponse,
    onError: options.onError,
  });
}
```

Exportado publicamente para apps que querem montar UI customizada mas usar o streaming do backbone.

### 6. Exports publicos

#### 6.1 Arquivo: `src/index.ts`

```typescript
// Componente principal
export { Chat } from "./Chat.js";
export type { ChatProps } from "./Chat.js";

// Provider (para composicao customizada)
export { ChatProvider } from "./ChatProvider.js";

// Componentes individuais (para composicao customizada)
export { MessageList } from "./MessageList.js";
export { MessageBubble } from "./MessageBubble.js";
export { MessageInput } from "./MessageInput.js";
export { Markdown } from "./Markdown.js";

// Parts
export { PartRenderer } from "./parts/PartRenderer.js";
export { ReasoningBlock } from "./parts/ReasoningBlock.js";
export { ToolActivity } from "./parts/ToolActivity.js";
export { ToolResult } from "./parts/ToolResult.js";

// Display renderers (individuais, para override ou uso standalone)
export { MetricCard } from "./display/MetricCard.js";
export { Chart } from "./display/Chart.js";
export { DataTable } from "./display/DataTable.js";
export { ProductCard } from "./display/ProductCard.js";
export { Carousel } from "./display/Carousel.js";
export { Gallery } from "./display/Gallery.js";
export { PriceHighlight } from "./display/PriceHighlight.js";
export { ComparisonTable } from "./display/ComparisonTable.js";
export { SourcesList } from "./display/SourcesList.js";
export { LinkPreview } from "./display/LinkPreview.js";
export { MapView } from "./display/MapView.js";
export { FileCard } from "./display/FileCard.js";
export { CodeBlock } from "./display/CodeBlock.js";
export { Spreadsheet } from "./display/Spreadsheet.js";
export { ProgressSteps } from "./display/ProgressSteps.js";
export { StepTimeline } from "./display/StepTimeline.js";
export { Alert } from "./display/Alert.js";
export { ChoiceButtons } from "./display/ChoiceButtons.js";

// Registry
export { defaultDisplayRenderers } from "./display/index.js";

// Hook
export { useBackboneChat } from "./hooks/useBackboneChat.js";

// Estilos
export "./styles.css";
```

### 7. Refatoracao do Hub — implementacao de referencia

#### 7.1 Arquivo: `apps/hub.old/src/components/conversations/conversation-chat.tsx`

Substituir a logica de streaming e renderizacao por `<Chat />` do ai-chat:

```tsx
import { Chat } from "@agentic-backbone/ai-chat";
import "@agentic-backbone/ai-chat/styles.css";

function ConversationChatPage() {
  const { id: sessionId } = useParams();
  const { token } = useAuthStore();
  const conversation = useConversation(sessionId);

  return (
    <div className="flex flex-col h-full">
      {/* Header — mantido no Hub (titulo, takeover, menu) */}
      <ChatHeader conversation={conversation} />

      {/* Takeover banner — mantido no Hub (logica de negocio) */}
      {conversation.takeover && <TakeoverBanner session={conversation} />}

      {/* Chat — delegado ao ai-chat */}
      <Chat
        endpoint={API_BASE}
        token={token}
        sessionId={sessionId}
        disabled={!!conversation.takeover}
        showUsage={true}
        className="flex-1"
      />
    </div>
  );
}
```

#### 7.2 Arquivos removidos do Hub

Apos a refatoracao, estes arquivos do Hub tornam-se redundantes:

| Arquivo | Motivo |
|---|---|
| `lib/chat-stream.ts` | Substituido por `useChat` via ai-chat |
| `components/chat/message-list.tsx` | Substituido por `MessageList` do ai-chat |
| `components/chat/message-bubble.tsx` | Substituido por `MessageBubble` do ai-chat |
| `components/chat/message-input.tsx` | Substituido por `MessageInput` do ai-chat |
| `components/chat/streaming-indicator.tsx` | Substituido por `StreamingIndicator` do ai-chat |

#### 7.3 Arquivos mantidos no Hub

| Arquivo | Motivo |
|---|---|
| `conversations-layout.tsx` | Sidebar de conversas — logica de negocio do Hub (busca, filtro, favoritos, CRUD) |
| `conversation-chat.tsx` | Pagina wrapper — header, takeover, menu. Usa `<Chat />` internamente |
| `message-feedback.tsx` | Feedback eh feature do Hub, nao do pacote generico |
| `takeover-banner.tsx` | Takeover eh feature do Hub, nao do pacote generico |
| `operator-message.tsx` | Mensagens de operador sao feature do Hub |
| `api/conversations.ts` | CRUD de conversas — permanece no Hub |

### 8. Estilizacao

#### 8.1 Arquivo: `src/styles.css`

Estilos base usando CSS variables para permitir customizacao pelo app consumidor:

```css
.ai-chat {
  --ai-chat-bg: var(--background, #09090b);
  --ai-chat-fg: var(--foreground, #fafafa);
  --ai-chat-muted: var(--muted, #a1a1aa);
  --ai-chat-accent: var(--accent, #3b82f6);
  --ai-chat-border: var(--border, #27272a);
  --ai-chat-radius: var(--radius, 0.5rem);
  --ai-chat-bubble-user: var(--ai-chat-bubble-user, #27272a);
  --ai-chat-bubble-assistant: transparent;
}
```

Compativel com shadcn tokens (usa as mesmas CSS variables). Se o app ja usa shadcn, os tokens sao herdados automaticamente. Se nao, os defaults funcionam standalone.

Nao usar Tailwind classes diretamente nos componentes do pacote — usar CSS modules ou classes proprias com CSS variables. Isso evita depender do Tailwind config do app consumidor.

---

## Limites

### NAO fazer

- NAO incluir CRUD de conversas no pacote — criar/renomear/deletar sessoes eh responsabilidade do app
- NAO incluir takeover/feedback no pacote — sao features de negocio do Hub, nao do chat generico
- NAO incluir sidebar de conversas no pacote — layout eh responsabilidade do app
- NAO incluir autenticacao no pacote — o app passa o token, o pacote so usa
- NAO usar Tailwind classes diretas nos componentes — usar CSS variables para nao acoplar ao config do consumidor
- NAO fazer SSR/RSC — o pacote eh client-only (hooks React)
- NAO persistir estado — o pacote eh stateless; historico vem do backbone via `initialMessages` ou via `useChat`
- NAO criar testes E2E no pacote — testar via implementacao de referencia no Hub

### Observacoes

- `ai` (Vercel AI SDK) eh peer dependency — o app consumidor deve instalar `ai@^4`
- O pacote importa schemas do `@agentic-backbone/ai-sdk` para type-safety nos display renderers
- `MapView` usa iframe OpenStreetMap em vez de lib pesada (react-leaflet) — evita bundle bloat. Se o app precisar de mapa interativo, pode sobrescrever via `displayRenderers`
- `display_choices` emite evento via callback `onChoice` — o app decide o que fazer (enviar como mensagem, navegar, etc.)
- O pacote expoe componentes individuais para composicao customizada — o consumidor nao eh obrigado a usar `<Chat />` monolitico
- `react-markdown` com `remark-gfm` renderiza tabelas, strikethrough, task lists, autolinks — cobre markdown rico sem precisar de display tool

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | Scaffold do pacote: `package.json`, `tsconfig.json`, estrutura de diretorios | nada |
| 2a | `ChatProvider.tsx` + `useBackboneChat.ts` (integracao com `useChat`) | fase 1 |
| 2b | `Markdown.tsx` + `StreamingIndicator.tsx` (atomicos, sem dependencia) | fase 1 |
| 2c | `styles.css` (CSS variables base) | fase 1 |
| 3a | `parts/ReasoningBlock.tsx` + `parts/ToolActivity.tsx` + `parts/ToolResult.tsx` | fase 2b |
| 3b | Display renderers simples: `Alert`, `MetricCard`, `PriceHighlight`, `FileCard`, `CodeBlock`, `SourcesList`, `StepTimeline`, `ProgressSteps` | fase 2b |
| 4a | Display renderers com lib: `Chart` (recharts), `Carousel` (embla) | fase 2b |
| 4b | Display renderers compostos: `ProductCard`, `ComparisonTable`, `DataTable`, `Spreadsheet`, `Gallery`, `ImageViewer`, `LinkPreview`, `MapView`, `ChoiceButtons` | fase 3b |
| 5 | `parts/PartRenderer.tsx` (switch central) | fases 3a, 3b, 4a, 4b |
| 6 | `registry.ts` + `display/index.ts` | fase 5 |
| 7 | `MessageBubble.tsx` + `MessageList.tsx` + `MessageInput.tsx` | fases 5, 6 |
| 8 | `Chat.tsx` (componente principal) + `index.ts` (exports) | fase 7 |
| 9 | Registrar pacote no workspace (`package.json` raiz) e instalar deps | fase 8 |
| 10 | Refatorar `conversation-chat.tsx` no Hub para usar `<Chat />` | fase 9 |
| 11 | Remover arquivos redundantes do Hub | fase 10 |
| 12 | Teste manual no Hub — validar experiencia completa | fase 11 |

Fases 2a, 2b, 2c sao paralelas. Fases 3a e 3b sao paralelas. Fases 4a e 4b sao paralelas.

---

## Publicacao e Versionamento

### Estrategia de versionamento

Semantic Versioning (semver) para ambos os pacotes publicaveis:

| Pacote | Versao inicial | Registry |
|---|---|---|
| `@agentic-backbone/ai-sdk` | `0.1.0` | GitHub Packages |
| `@agentic-backbone/ai-chat` | `0.1.0` | GitHub Packages |

**Regras de bump:**

| Tipo | Quando | Exemplo |
|---|---|---|
| `patch` (0.1.**1**) | Bug fix, ajuste de estilo, correcao de schema | Fix no DisplayProductSchema |
| `minor` (0.**2**.0) | Nova display tool, novo componente, nova prop | Adicionar `display_video` |
| `major` (**1**.0.0) | Breaking change em schema, props ou protocolo | Mudar formato do DataStream |

**Versionamento independente** — ai-sdk e ai-chat tem versoes separadas. ai-chat declara a versao minima do ai-sdk que precisa:

```json
{
  "dependencies": {
    "@agentic-backbone/ai-sdk": "^0.1.0"
  }
}
```

### Configuracao do GitHub Packages

#### Arquivo: `apps/packages/ai-sdk/.npmrc`

```ini
@agentic-backbone:registry=https://npm.pkg.github.com
```

#### Arquivo: `apps/packages/ai-chat/.npmrc`

```ini
@agentic-backbone:registry=https://npm.pkg.github.com
```

#### Arquivo: `apps/packages/ai-sdk/package.json` (campos adicionais)

```json
{
  "name": "@agentic-backbone/ai-sdk",
  "version": "0.1.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/keepcoding-tech/agentic-backbone.git",
    "directory": "apps/packages/ai-sdk"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

#### Arquivo: `apps/packages/ai-chat/package.json` (campos adicionais)

```json
{
  "name": "@agentic-backbone/ai-chat",
  "version": "0.1.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/keepcoding-tech/agentic-backbone.git",
    "directory": "apps/packages/ai-chat"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### Scripts de publicacao

#### Arquivo: `package.json` (raiz, scripts adicionais)

```json
{
  "scripts": {
    "publish:ai-sdk": "npm run build --workspace=apps/packages/ai-sdk && npm publish --workspace=apps/packages/ai-sdk",
    "publish:ai-chat": "npm run build --workspace=apps/packages/ai-chat && npm publish --workspace=apps/packages/ai-chat",
    "publish:packages": "npm run publish:ai-sdk && npm run publish:ai-chat",
    "version:patch": "npm version patch --workspace=apps/packages/ai-sdk --workspace=apps/packages/ai-chat",
    "version:minor": "npm version minor --workspace=apps/packages/ai-sdk --workspace=apps/packages/ai-chat"
  }
}
```

### Consumo no app cliente (ex: Pneu SOS)

#### Arquivo: `D:\sources\codr.studio\pneu-sos\.npmrc`

```ini
@agentic-backbone:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

#### Instalacao

```bash
npm install @agentic-backbone/ai-chat
```

Isso puxa `@agentic-backbone/ai-sdk` como dependencia transitiva. O app nao precisa instalar ai-sdk diretamente.

### Preparacao (sem publicar agora)

A fase de preparacao inclui:

1. Atualizar `version` do ai-sdk de `0.0.1` para `0.1.0`
2. Adicionar campos `repository` e `publishConfig` nos dois pacotes
3. Criar `.npmrc` nos dois pacotes
4. Adicionar scripts `publish:*` e `version:*` na raiz
5. Criar `CHANGELOG.md` em cada pacote (vazio, com template)

NAO publicar automaticamente. A publicacao sera manual via `npm run publish:packages` quando o usuario decidir.
