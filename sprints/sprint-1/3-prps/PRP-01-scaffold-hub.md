# PRP-01 — Scaffold do Hub e Autenticacao

Criar o app Hub (React 19 + TanStack Router + shadcn/ui) com layout responsivo, autenticacao JWT e infraestrutura base para todas as features subsequentes.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O monorepo tem `apps/backbone` (runtime Node.js) funcionando. Nao existe `apps/hub`. O backbone expoe:

- `POST /api/v1/ai/auth/login` — autenticacao JWT
- `GET /api/v1/ai/system/events` — SSE de eventos do sistema
- Todas as rotas protegidas por JWT (`Authorization: Bearer <token>`)

O `package.json` raiz ja tem scripts `dev:hub` e `build:hub` apontando para `apps/hub`.

### Estado desejado

Um SPA funcional em `apps/hub` com:
1. Build system (Vite 6, React 19, TypeScript)
2. Routing type-safe (TanStack Router)
3. Design system (Tailwind CSS 4, shadcn/ui, CSS tokens)
4. Login funcional com persistencia de sessao
5. Layout responsivo (sidebar desktop, bottom nav mobile)
6. Infraestrutura de dados (API client, SSE hook, TanStack Query, Zustand)
7. PWA instalavel

## Especificacao

### Feature F-001: Setup Vite + React 19 + TanStack Router

Criar `apps/hub/` com:

```
apps/hub/
  index.html
  vite.config.ts
  tsconfig.json
  package.json
  src/
    main.tsx          # entry point, monta React no DOM
    App.tsx           # RouterProvider com TanStack Router
    index.css         # imports Tailwind, define CSS tokens
    routeTree.gen.ts  # gerado pelo TanStack Router plugin
```

**package.json:**
- `name`: `@agentic-backbone/hub`
- `type`: `module`
- Dependencias: `react@19`, `react-dom@19`, `@tanstack/react-router`, `@tanstack/router-plugin` (Vite plugin)
- Dev: `vite@6`, `@vitejs/plugin-react`, `typescript`

**vite.config.ts:**
- Plugins: `react()`, `TanStackRouterVite()`
- `server.port`: lido de `process.env.HUB_PORT` (sem fallback)
- `server.proxy`: `/api` → `http://localhost:${BACKBONE_PORT}` (para dev)

**tsconfig.json:**
- Target: ES2022, module: ESNext, moduleResolution: bundler
- Strict mode
- Path alias: `@/*` → `./src/*`

### Feature F-002: Tailwind CSS 4 + shadcn/ui + CSS tokens

**Tailwind CSS 4:**
- Instalar `tailwindcss@4`, `@tailwindcss/vite`
- Configurar via `index.css` com `@import "tailwindcss"`

**shadcn/ui:**
- Inicializar com `npx shadcn@latest init`
- Componentes em `src/components/ui/`
- Instalar componentes base: `button`, `card`, `input`, `label`, `badge`, `switch`, `select`, `dialog`, `dropdown-menu`, `tabs`, `table`, `tooltip`, `separator`, `sheet`, `sidebar`, `scroll-area`, `skeleton`

**CSS tokens (em `index.css`):**
- Definir tokens semanticos para cores (background, foreground, primary, secondary, muted, accent, destructive, border, ring)
- Suporte a dark mode via `class` strategy
- Nunca usar cores Tailwind diretamente (ex: `bg-blue-500`) — sempre tokens semanticos

### Feature F-003: Auth store + API client + Login page

**lib/api.ts — API client:**

```typescript
export async function request<T>(path: string, options?: RequestInit): Promise<T>
```

- Base path: `/api/v1/ai`
- Injeta `Authorization: Bearer <token>` de `useAuthStore`
- Se resposta 401 → chama `useAuthStore.getState().logout()`
- Lanca erro tipado com status e body em caso de falha

**lib/auth.ts — Auth store (Zustand + persist):**

```typescript
interface AuthState {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}
```

- `login()`: `POST /auth/login` com `{ username, password }`, salva token
- `logout()`: limpa token, redireciona para `/login`
- Persistido em `localStorage` via `zustand/middleware`

**routes/login.tsx — Login page:**

- Formulario com campos `email` e `senha`
- Validacao client-side: campos obrigatorios
- Feedback de erro inline (credenciais invalidas)
- Redirect para `/` apos login bem-sucedido
- Se ja autenticado, redirect para `/`

### Feature F-004: Layout responsivo (sidebar + bottom nav)

**routes/__root.tsx:**
- Root layout, renderiza `<Outlet />`
- Monta `QueryClientProvider` e `SidebarProvider`

**routes/_authenticated.tsx:**
- Layout guard: verifica `useAuthStore.token`
- Se nao autenticado → `<Navigate to="/login" />`
- Renderiza layout com sidebar (desktop) ou bottom nav (mobile)

**components/layout/app-sidebar.tsx — Sidebar desktop (>= 768px):**
- Usa `Sidebar` do shadcn/ui
- Items de navegacao:

| Item | Icone | Rota |
|------|-------|------|
| Agentes | Bot | `/agents` |
| Conversas | MessageSquare | `/conversations` |
| Canais | Radio | `/channels` |
| Agenda | Calendar | `/cron` |
| Configuracoes | Settings | `/settings` |

- Logo/nome do app no topo

**components/layout/bottom-nav.tsx — Bottom nav mobile (< 768px):**
- Barra fixa no fundo
- Items: Agentes, Conversas, Canais, Configuracoes
- Item ativo com destaque visual

**components/layout/breadcrumb-bar.tsx — Top bar:**
- Breadcrumbs com base na rota atual
- Trigger para abrir sidebar em mobile (menu hamburger)

### Feature F-005: SSE hook + Query client + UI store

**lib/query-client.ts:**
- Instancia do `QueryClient` com defaults razoaveis
- `staleTime`: 30s, `retry`: 1

**hooks/use-sse.ts — SSE hook:**

```typescript
export function useSSE(options?: { enabled?: boolean }): {
  connected: boolean;
  lastEvent: SystemEvent | null;
}
```

- Conecta em `/api/v1/ai/system/events?token=<jwt>`
- Reconexao automatica com backoff exponencial (1s, 2s, 4s, max 30s)
- Eventos tipados: `connected`, `heartbeat:status`, `channel:message`, `registry:adapters`, `job:status`, `ping`
- Em cada evento relevante, invalida queries do TanStack Query:
  - `heartbeat:status` → invalida `["agents", agentId, "stats"]`
  - `registry:adapters` → invalida `["agents"]`, `["channels"]`
  - `channel:message` → invalida `["channels"]`

**lib/store.ts — UI store (Zustand):**

```typescript
interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}
```

- Theme persistido em localStorage
- Aplica class `dark` no `<html>` conforme tema

### Feature F-006: PWA + paginas placeholder

**PWA (vite-plugin-pwa):**
- Manifest com nome "AB Hub", icones, theme_color
- Service worker com estrategia NetworkFirst para API, CacheFirst para assets
- Instalavel em mobile e desktop

**Paginas placeholder (rotas vazias com titulo):**
- `routes/_authenticated/index.tsx` → redirect para `/agents`
- `routes/_authenticated/agents.tsx` → "Agentes" (placeholder)
- `routes/_authenticated/conversations.tsx` → "Conversas" (placeholder)
- `routes/_authenticated/channels.tsx` → "Canais" (placeholder)
- `routes/_authenticated/cron.tsx` → "Agenda" (placeholder)
- `routes/_authenticated/settings.tsx` → "Configuracoes" (placeholder)

Cada placeholder usa `PageHeader` com titulo da secao e mensagem "Em breve".

**components/shared/page-header.tsx:**

```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}
```

**components/shared/empty-state.tsx:**

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
```

**components/shared/status-badge.tsx:**

```typescript
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'error' | 'warning';
  label?: string;
}
```

**components/shared/confirm-dialog.tsx:**

```typescript
interface ConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  destructive?: boolean;
  children: React.ReactNode; // trigger
}
```

### API query factories

Criar stubs em `src/api/` para uso pelos PRPs seguintes:

| Arquivo | Exports |
|---------|---------|
| `api/agents.ts` | `agentsQueryOptions()`, `agentQueryOptions(id)`, `agentStatsQueryOptions(id)` |
| `api/conversations.ts` | `conversationsQueryOptions()`, `conversationQueryOptions(id)` |
| `api/channels.ts` | `channelsQueryOptions()`, `channelQueryOptions(slug)` |
| `api/cron.ts` | `cronJobsQueryOptions()`, `cronJobQueryOptions(agentId, slug)` |
| `api/settings.ts` | `settingsQueryOptions()` |
| `api/users.ts` | `usersQueryOptions()` |

Cada factory retorna `queryOptions({ queryKey, queryFn })` usando `request<T>()`.

## Limites

- **NAO** implementar conteudo das paginas de agentes, conversas, canais, cron ou settings — apenas placeholders. Conteudo eh responsabilidade dos PRPs 02-07.
- **NAO** criar APIs novas no backbone — todas as APIs necessarias ja existem.
- **NAO** usar cores Tailwind diretamente — apenas CSS tokens semanticos.
- **NAO** usar polling (`refetchInterval`) — SSE eh a unica fonte de atualizacao real-time.
- **NAO** adicionar fallback defaults para variaveis de ambiente (`process.env.VAR ?? "value"`).
- **NAO** escrever testes — nao ha framework de testes configurado para o hub.

## Validacao

- [ ] `npm run dev:hub` inicia o Hub na porta `HUB_PORT` com HMR
- [ ] `npm run build:hub` gera build de producao sem erros
- [ ] Login com credenciais validas (`SYSUSER`/`SYSPASS`) redireciona para `/agents`
- [ ] Login com credenciais invalidas exibe erro inline
- [ ] Refresh na pagina mantem sessao (token persistido em localStorage)
- [ ] Layout exibe sidebar em desktop (>= 768px), bottom nav em mobile (< 768px)
- [ ] Navegacao entre paginas funciona sem reload
- [ ] SSE conecta ao backbone e exibe `connected: true`
- [ ] Tema dark/light funciona via toggle
- [ ] PWA instalavel com manifest e service worker
- [ ] Todas as rotas protegidas redirecionam para `/login` sem token
- [ ] `npm run typecheck` (se configurado) passa sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-001 Setup Vite | S-001 sec 2 | G-012 (onboarding rapido) |
| F-002 Design system | S-001 sec 2 | G-011 (pt-BR) |
| F-003 Auth | S-001 sec 4 | Base para todas |
| F-004 Layout | S-001 sec 5 | D-005, G-003 |
| F-005 SSE + stores | S-001 sec 6 | D-001 (real-time) |
| F-006 PWA + placeholders | S-001 sec 3 | G-012 |
