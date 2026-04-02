# PRP-25A — Fundamentos: Primitivos shadcn, Tipos, Utilitários e Hook

Adicionar primitivos shadcn (Input, DropdownMenu, Skeleton), tipos de conversas, funções utilitárias e hook standalone ao `@codrstudio/agentic-chat` — fundação para os componentes de gerenciamento de conversas.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- `@codrstudio/agentic-chat` entrega o chat (Chat, MessageList, MessageInput, MessageBubble, 19 display renderers, 2 hooks) — zero gerenciamento de sessões
- Primitivos shadcn existentes: Button, Dialog, ScrollArea, Badge, Tooltip, Avatar, Tabs, Separator, Popover, Label — **10 no total**
- Nenhum tipo `Conversation` próprio do pacote — toda tipagem vive no Hub acoplada a `Session` do backbone
- `buildInitialMessages` (120 linhas) está hardcoded no Hub em `conversation-chat.tsx:50-172`
- `formatRelativeTime` está hardcoded no Hub em `conversations-layout.tsx:36-46`
- Zero hook de gerenciamento de sessões — apps sem TanStack Query não têm como gerenciar conversas

### Estado desejado

- 3 novos primitivos shadcn: Input, DropdownMenu, Skeleton (**13 total**)
- Tipos `Conversation` e `BackendMessage` próprios do pacote
- Funções puras `formatRelativeTime`, `buildInitialMessages`, `groupConversations` exportadas
- Hook `useIsMobile` para detecção de viewport
- Hook `useConversations` standalone (fetch + useState) para apps sem data layer

### Dependencias

- Nenhuma — este PRP é o desbloqueador de PRP-25B e PRP-25C

## Especificacao

### Feature F-364: Primitivos shadcn — Input, DropdownMenu, Skeleton

**Spec:** S-108

Adicionar 3 novos primitivos shadcn ao `@codrstudio/agentic-chat` em `src/ui/`.

#### 1. `src/ui/input.tsx`

Input HTML puro com estilização shadcn (sem Radix — é um `<input>` com `cn()`):

```tsx
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
```

#### 2. `src/ui/dropdown-menu.tsx`

Baseado em `@radix-ui/react-dropdown-menu`. Exports: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`.

Padrão shadcn oficial — mesma estrutura do `dialog.tsx` existente. Content renderizado via Portal com animações de entrada/saída.

#### 3. `src/ui/skeleton.tsx`

Zero dependências. Div com `animate-pulse`:

```tsx
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}
```

#### 4. Atualizar `package.json`

Adicionar dependência:
```json
"@radix-ui/react-dropdown-menu": "^2"
```

#### Regras

- Seguir padrão shadcn já adotado no pacote (cn(), forwardRef, tokens CSS)
- DropdownMenu usa Portal para renderização (mesmo padrão do Dialog existente)
- Input não usa Radix — é HTML puro com estilos

### Feature F-365: Tipos, utilitários e useIsMobile

**Spec:** S-109

Criar tipos de conversas, funções puras extraídas do Hub e hook de detecção de viewport.

#### 1. `src/conversations/types.ts`

```ts
export interface Conversation {
  id: string;
  title?: string;
  agentId: string;
  updatedAt: string;
  starred: boolean;
  metadata?: Record<string, unknown>;
}

export interface BackendMessage {
  id?: string;
  role: string;
  content: string | unknown[];
  _meta?: { id?: string; ts?: string; userId?: string; metadata?: Record<string, unknown> };
  timestamp?: string;
  metadata?: Record<string, unknown>;
}
```

#### 2. `src/conversations/utils.ts`

Funções puras extraídas do Hub:

**`formatRelativeTime(dateStr: string): string`**
Extraída de `conversations-layout.tsx:36-46`. Retorna strings em inglês por default ("now", "5m ago", "2h ago", "3d ago").

**`buildInitialMessages(messages: BackendMessage[]): Message[]`**
Extraída de `conversation-chat.tsx:50-172`. Função pura que transforma mensagens do backend (role/content/tool-call/tool-result) no formato ai-sdk (parts com tool-invocation). Elimina duplicação — hoje o Hub tem essa função hardcoded.

**`groupConversations(conversations: Conversation[]): { favorites: Conversation[]; history: Conversation[] }`**
Split simples por `starred`. O consumidor faz sort/filter antes de passar.

#### 3. `src/hooks/useIsMobile.ts`

```ts
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}
```

#### Regras

- `Conversation` é tipo próprio do agentic-chat — subconjunto limpo do `Session` do backbone
- `BackendMessage` aceita qualquer objeto com `role`, `content`, `_meta` — o Hub's `ConversationMessage` já conforma
- `buildInitialMessages` tem tipagem genérica — não depende de tipos do Hub
- `formatRelativeTime` retorna strings em inglês; consumidor faz override via `renderTimestamp` prop ou labels
- `useIsMobile` limpa listener no cleanup

### Feature F-366: Hook useConversations (standalone)

**Spec:** S-110

Hook standalone (sem TanStack Query) para apps sem data layer próprio. Usa `useState` + `useCallback` + `fetch`.

#### 1. `src/conversations/useConversations.ts`

```ts
interface UseConversationsOptions {
  endpoint?: string;    // default: ""
  token?: string;       // Bearer token
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>;  // override fetch
  autoFetch?: boolean;  // default: true
}

interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (agentId: string) => Promise<Conversation>;
  rename: (id: string, title: string) => Promise<void>;
  star: (id: string, starred: boolean) => Promise<void>;   // optimistic update
  remove: (id: string) => Promise<void>;
  exportUrl: (id: string, format?: "json" | "markdown") => string;
}
```

#### 2. Detalhes de implementação

- Fetcher default adiciona `Authorization: Bearer ${token}` no header
- Paths: `/api/v1/ai/conversations/*` (mesmo padrão do Hub)
- `star()` faz update otimista (atualiza estado local, faz PATCH, rollback no erro)
- `remove()` remove do estado local após DELETE bem-sucedido
- `create()` adiciona ao estado local após POST bem-sucedido
- `exportUrl()` retorna URL com `?token=` para download direto
- `autoFetch: true` por default — chama `refresh()` no mount

#### Regras

- Zero dependências externas — apenas React hooks + fetch nativo
- Consumers com TanStack Query, SWR ou Apollo ignoram o hook e passam dados diretamente para os componentes via props
- O Hub NÃO usa este hook — continua usando TanStack Query
- Optimistic update em `star()` com rollback no erro
- Não faz polling — o consumidor chama `refresh()` quando quiser

## Limites

- **NÃO** criar componentes de UI neste PRP — isso é PRP-25B
- **NÃO** criar exports em `index.ts` — isso é PRP-25C
- **NÃO** alterar código do Hub — isso é PRP-25C
- **NÃO** adicionar lógica de navegação — componentes são controlados
- **NÃO** acoplar a TanStack Query ou qualquer library de estado

## Validacao

- [ ] `src/ui/input.tsx` criado com padrão shadcn (cn(), forwardRef)
- [ ] `src/ui/dropdown-menu.tsx` criado com Radix DropdownMenu, exports corretos
- [ ] `src/ui/skeleton.tsx` criado com animate-pulse
- [ ] `@radix-ui/react-dropdown-menu` adicionado ao `package.json`
- [ ] `Conversation` e `BackendMessage` definidos em `src/conversations/types.ts`
- [ ] `formatRelativeTime` retorna strings relativas corretas ("now", "5m ago", "2h ago", "3d ago")
- [ ] `buildInitialMessages` transforma mensagens backend para formato ai-sdk com tool-invocation parts
- [ ] `groupConversations` separa por `starred` corretamente
- [ ] `useIsMobile` detecta viewport e limpa listener no cleanup
- [ ] `useConversations` hook: fetch lista, create, rename, star (optimistic), delete
- [ ] `star()` faz update otimista com rollback em erro
- [ ] `exportUrl()` retorna URL com `?token=` para download direto
- [ ] Todos os componentes/hooks respeitam tokens shadcn (bg-background, text-foreground, etc.)
- [ ] Build compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-364 Primitivos shadcn (Input, DropdownMenu, Skeleton) | S-108 | D-014 |
| F-365 Tipos, utilitários e useIsMobile | S-109 | D-015, D-016 |
| F-366 Hook useConversations standalone | S-110 | D-017 |
