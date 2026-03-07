# AB Hub - Scaffold do Hub e Autenticacao

Criar o app Hub (React 19 + TanStack Router + shadcn/ui) com layout responsivo, autenticacao JWT e infraestrutura base para todas as features subsequentes.

---

## 1. Objetivo

- Criar o app `apps/hub` com Vite, React 19, TanStack Router, Tailwind CSS e shadcn/ui
- Implementar login com email/senha via backbone (`POST /auth/login`)
- Criar layout responsivo com sidebar (desktop) e bottom nav (mobile)
- Estabelecer infraestrutura: API client, SSE hook, Zustand stores, TanStack Query
- Discoveries: base necessaria para D-001, D-002, D-005, G-003, G-007, G-012

---

## 2. Stack

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| Build | Vite 6 | HMR rapido, ESM nativo |
| UI Framework | React 19 | Concurrent features, use() hook |
| Routing | TanStack Router | Type-safe, file-based, loader pattern |
| State (server) | TanStack Query v5 | Cache, invalidation, SSE-driven refetch |
| State (client) | Zustand | Leve, sem boilerplate |
| Components | shadcn/ui v4 | Composable, CSS tokens, acessivel |
| Styling | Tailwind CSS 4 | Utility-first, CSS tokens semanticos |
| PWA | vite-plugin-pwa | Offline-first, installable |
| Idioma | pt-BR | Interface 100% em portugues |

---

## 3. Estrutura de Diretorios

```
apps/hub/
  index.html
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
  src/
    main.tsx                    # entry point
    App.tsx                     # router provider
    index.css                   # tailwind + CSS tokens
    lib/
      api.ts                    # request<T>() wrapper com JWT
      auth.ts                   # useAuthStore (Zustand)
      store.ts                  # useUIStore (Zustand)
      chat-stream.ts            # streamMessage() via SSE
      query-client.ts           # TanStack Query client
    hooks/
      use-sse.ts                # useSSE() — subscribe to system events
    api/
      agents.ts                 # queryOptions factories
      conversations.ts
      channels.ts
      cron.ts
      settings.ts
      users.ts
    routes/
      __root.tsx                # root layout
      _authenticated.tsx        # auth guard layout
      _authenticated/
        index.tsx               # redirect -> /agents
        agents.tsx              # agent list
        agents.$id.tsx          # agent detail
        conversations.tsx       # conversation list
        conversations.$id.tsx   # chat view
        channels.tsx            # channel list
        cron.tsx                # cron jobs
        settings.tsx            # LLM settings
      login.tsx                 # login page
    components/
      layout/
        app-sidebar.tsx         # sidebar (desktop)
        bottom-nav.tsx          # bottom nav (mobile)
        breadcrumb-bar.tsx      # top bar com breadcrumbs
      shared/
        page-header.tsx         # titulo + acoes da pagina
        empty-state.tsx         # estado vazio padrao
        status-badge.tsx        # badge de status
        confirm-dialog.tsx      # dialog de confirmacao
```

---

## 4. Autenticacao

### 4.1 Fluxo

1. Usuario abre o Hub → TanStack Router verifica `useAuthStore.token`
2. Se nao autenticado → redirect para `/login`
3. Login form envia `POST /api/v1/ai/auth/login` com `{ username, password }`
4. Backbone retorna `{ token }` (JWT, 1 ano)
5. Token salvo no Zustand store (persistido em localStorage)
6. Todas as requests subsequentes incluem `Authorization: Bearer <token>`
7. Se backbone retorna 401 → limpa token, redirect para `/login`

### 4.2 API

| Metodo | Rota | Payload | Resposta |
|--------|------|---------|----------|
| POST | `/auth/login` | `{ username: string, password: string }` | `{ token: string }` |

### 4.3 Componentes

**LoginPage** (`routes/login.tsx`)
- Formulario com email e senha
- Validacao client-side (campos obrigatorios)
- Feedback de erro inline
- Redirect para `/` apos sucesso

---

## 5. Layout

### 5.1 Desktop (>= 768px)

```
+---sidebar---+--------content---------+
| Logo        | breadcrumb-bar         |
| nav-items   |                        |
|   Agentes   |   <page content>       |
|   Conversas |                        |
|   Canais    |                        |
|   Agenda    |                        |
|   Config    |                        |
+-------------+------------------------+
```

### 5.2 Mobile (< 768px)

```
+--------content---------+
| breadcrumb-bar         |
|                        |
|   <page content>       |
|                        |
|                        |
+---bottom-nav-----------+
| Agentes | Chat | Canais| Config |
+-------------------------+
```

### 5.3 Navegacao

| Item | Icone | Rota | Visivel mobile |
|------|-------|------|----------------|
| Agentes | Bot | `/agents` | Sim |
| Conversas | MessageSquare | `/conversations` | Sim |
| Canais | Radio | `/channels` | Sim |
| Agenda | Calendar | `/cron` | Nao (submenu) |
| Configuracoes | Settings | `/settings` | Sim |

---

## 6. Infraestrutura Base

### 6.1 API Client (`lib/api.ts`)

```typescript
async function request<T>(path: string, options?: RequestInit): Promise<T>
```

- Base path: `/api/v1/ai`
- Injeta JWT de `useAuthStore`
- Lanca erro com status e body em caso de falha
- Intercepta 401 → logout automatico

### 6.2 SSE Hook (`hooks/use-sse.ts`)

```typescript
function useSSE(options?: { enabled?: boolean }): {
  connected: boolean;
  lastEvent: SystemEvent | null;
}
```

- Conecta em `/api/v1/ai/system/events?token=<jwt>`
- Reconexao automatica com backoff
- Eventos tipados: `connected`, `heartbeat:status`, `channel:message`, `registry:adapters`, `job:status`, `ping`
- Invalida queries do TanStack Query conforme tipo do evento

### 6.3 Stores

**useAuthStore** — `token`, `login()`, `logout()`, persist em localStorage
**useUIStore** — `sidebarOpen`, `theme` (light/dark/system)

---

## 7. Criterios de Aceite

- [ ] `npm run dev:hub` inicia o Hub em `HUB_PORT` com HMR
- [ ] `npm run build:hub` gera build de producao sem erros
- [ ] Login com credenciais validas redireciona para `/agents`
- [ ] Login com credenciais invalidas exibe erro inline
- [ ] Refresh na pagina mantem sessao (token persistido)
- [ ] Layout exibe sidebar em desktop, bottom nav em mobile
- [ ] Navegacao entre paginas funciona sem reload
- [ ] SSE conecta ao backbone e reconecta apos desconexao
- [ ] Tema dark/light funciona via toggle
- [ ] PWA instalavel com manifest e service worker

---

## 8. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| Scaffold Hub | G-012 (onboarding rapido), G-011 (pt-BR) |
| Auth | Base para todas as features |
| Layout | D-005 (fragmentacao), G-003 (visao unificada) |
| SSE | D-001 (visibilidade real-time) |
| API Client | Base para todas as features |
