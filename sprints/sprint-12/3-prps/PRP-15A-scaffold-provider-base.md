# PRP-15A — Scaffold, Provider e Componentes Base do ai-chat

Criar o pacote `@agentic-backbone/ai-chat` com scaffold completo, provider React com `useChat`, componentes atomicos de markdown/streaming e stylesheet com CSS variables.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Apos PRP-14 (Display Tools) e PRP-14B (DataStream Protocol), o backbone emite stream rico com parts tipados (`text`, `reasoning`, `tool-invocation`) via `?format=datastream`. Porem:

- `apps/packages/ai-chat/` nao existe — nenhum arquivo do pacote foi criado
- Nenhum React context encapsula `useChat` do `@ai-sdk/react` com configuracao backbone
- Componentes de markdown e streaming indicator existem no Hub e no app chat, mas estao acoplados a cada app
- Estilos usam Tailwind classes diretas, impedindo portabilidade para consumidores sem Tailwind

### Estado desejado

1. Pacote `@agentic-backbone/ai-chat` scaffolded com package.json, tsconfig.json e estrutura src/
2. `ChatProvider` + `useBackboneChat` encapsulam `useChat` com URL DataStream e auth automatica
3. `Markdown` e `StreamingIndicator` portaveis, usando CSS variables sem dependencia de Tailwind
4. `styles.css` com CSS variables no namespace `.ai-chat`, dark mode e animacoes

### Dependencias

- **PRP-14A (Display Tools)** — ja implementado. Schemas e tipos de display tools disponíveis no ai-sdk
- **PRP-14B (DataStream Protocol)** — ja implementado. Backbone aceita `?format=datastream`
- **Nenhuma dependencia de outros PRPs do sprint-12** — este PRP eh o primeiro a ser implementado

## Especificacao

### Feature F-180: Scaffold do Pacote ai-chat

**Spec:** S-056

Criar `apps/packages/ai-chat/` com:

- `package.json` com nome `@agentic-backbone/ai-chat`, peer deps `react`/`react-dom`, deps de runtime (`@ai-sdk/react`, `react-markdown`, `remark-gfm`, `rehype-highlight`, `lucide-react`, `recharts`, `embla-carousel-react`, `clsx`)
- `tsconfig.json` estendendo padrao monorepo (ES2022, ESNext, bundler, react-jsx)
- Estrutura `src/` com subpastas: `hooks/`, `parts/`, `display/`, `components/`
- `src/index.ts` barrel export (vazio inicialmente)
- Registrar no array `workspaces` do `package.json` raiz (se glob `apps/packages/*` nao cobrir)

```json
{
  "name": "@agentic-backbone/ai-chat",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css"
  }
}
```

#### Regras

- Nao instalar dependencias nesta feature — apenas declarar no package.json
- Estrutura de pastas eh organizacional — criar diretorios e index vazios
- Alinhar versoes de deps ao que ja existe no monorepo (verificar hub/package.json, chat/package.json)
- Nao criar componentes — scaffold apenas

### Feature F-181: ChatProvider + useBackboneChat

**Spec:** S-057

Criar o provider React e hook customizado:

**`src/hooks/useBackboneChat.ts`:**

```typescript
export interface UseBackboneChatOptions {
  endpoint: string;     // base URL do backbone (ex: "http://localhost:6002")
  token: string;        // JWT token
  sessionId: string;    // ID da sessao/conversa
  initialMessages?: Message[];
}

export function useBackboneChat(options: UseBackboneChatOptions) {
  return useChat({
    api: `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/messages?format=datastream`,
    headers: { Authorization: `Bearer ${options.token}` },
    initialMessages: options.initialMessages,
  });
}
```

**`src/hooks/ChatProvider.tsx`:**

```typescript
export interface ChatProviderProps {
  endpoint: string;
  token: string;
  sessionId: string;
  children: React.ReactNode;
}

export function ChatProvider({ endpoint, token, sessionId, children }: ChatProviderProps) {
  const chat = useBackboneChat({ endpoint, token, sessionId });
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
```

#### Regras

- Nao duplicar logica do `useChat` — apenas configurar e reexportar
- URL composta via props — nunca hardcodada
- Token via header Authorization — nao usar query param
- Reexportar tipos do `@ai-sdk/react` (Message, etc.)

### Feature F-182: Markdown + StreamingIndicator Portaveis

**Spec:** S-058

**`src/components/Markdown.tsx`:**

- Renderiza markdown com `react-markdown` + `remark-gfm` + `rehype-highlight`
- Links abrem em nova aba com `target="_blank" rel="noopener noreferrer"`
- Tabelas com wrapper overflow-x auto
- Code blocks com classes `.ai-chat-code-block` e `.ai-chat-inline-code`
- Classe root: `.ai-chat-markdown`

**`src/components/StreamingIndicator.tsx`:**

- Cursor piscante `▊` com animacao CSS `ai-chat-blink`
- Classe: `.ai-chat-cursor`
- `aria-label="Gerando resposta..."`

#### Regras

- Sem Tailwind — usar classes CSS com namespace `.ai-chat-*`
- Plugins sao fixos — remark-gfm e rehype-highlight sempre ativos
- Nao recriar logica existente — configurar react-markdown

### Feature F-183: styles.css com CSS Variables

**Spec:** S-060

Criar `src/styles.css` com:

**CSS Variables (tokens) sob `.ai-chat`:**
- Cores: `--ai-chat-bg`, `--ai-chat-fg`, `--ai-chat-muted`, `--ai-chat-border`, `--ai-chat-accent`, `--ai-chat-destructive`, `--ai-chat-success`, `--ai-chat-warning`
- Tipografia: `--ai-chat-font-family`, `--ai-chat-font-size`, `--ai-chat-line-height`, `--ai-chat-code-font`
- Espacamento: `--ai-chat-radius`, `--ai-chat-gap`, `--ai-chat-padding`
- Reasoning: `--ai-chat-reasoning-max-height`, `--ai-chat-reasoning-border`
- Bubbles: `--ai-chat-bubble-user-bg/fg`, `--ai-chat-bubble-assistant-bg/fg`

**Dark mode:** `.ai-chat.dark, .dark .ai-chat { ... }`

**Animacoes:**
```css
@keyframes ai-chat-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

**Estilos base:** `.ai-chat-markdown`, `.ai-chat-code-block`, `.ai-chat-inline-code`, `.ai-chat-reasoning`, `.ai-chat-tool-activity`, `.ai-chat-bubble`, `.ai-chat-input`, `.ai-chat-display-*`

#### Regras

- Todas as cores via CSS variables — nenhuma cor hardcoded nos componentes
- Namespace `.ai-chat` obrigatorio em todas as classes
- Compativel com shadcn — formato `hsl(...)` e nomes alinhados
- Dark mode via classe `.dark` no pai ou no proprio `.ai-chat`
- CSS puro — sem Tailwind

## Limites

- **NAO** criar componentes alem dos 4 especificados (Markdown, StreamingIndicator, ChatProvider, useBackboneChat)
- **NAO** criar display renderers — responsabilidade do PRP-15C
- **NAO** criar PartRenderer, MessageBubble ou Chat — responsabilidade dos PRP-15B e PRP-15D
- **NAO** executar `npm install` — apenas declarar deps. Install eh responsabilidade da feature F-194 (PRP-15E)
- **NAO** modificar o Hub — refatoracao eh responsabilidade do PRP-15E

## Validacao

- [ ] Diretorio `apps/packages/ai-chat/` existe com package.json e tsconfig.json
- [ ] `src/index.ts` existe com exports de ChatProvider, useChatContext, useBackboneChat, Markdown, StreamingIndicator
- [ ] Subpastas `hooks/`, `parts/`, `display/`, `components/` existem
- [ ] `useBackboneChat` chama `useChat` com URL correta incluindo `?format=datastream`
- [ ] `ChatProvider` expoe estado do chat via context
- [ ] Header Authorization injetado automaticamente
- [ ] `Markdown` renderiza GFM e syntax highlighting com classes `.ai-chat-*`
- [ ] `StreamingIndicator` exibe cursor piscante via CSS animation
- [ ] `styles.css` existe com CSS variables documentadas, dark mode e animacoes
- [ ] Nenhuma cor hardcoded nos componentes (validar grep por `#` e `rgb` em `.tsx`)
- [ ] Export `"./styles.css"` funciona no package.json
- [ ] Typecheck passa sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-180 Scaffold do Pacote ai-chat | S-056 | AC-001 |
| F-181 ChatProvider + useBackboneChat | S-057 | AC-002 |
| F-182 Markdown + StreamingIndicator | S-058 | AC-003 |
| F-183 styles.css com CSS Variables | S-060 | AC-004 |
