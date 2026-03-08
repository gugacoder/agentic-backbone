# PRP-41 — Hub: Área do Usuário, Logout e Visão Sysadmin

**Spec:** Feedback do operador (2026-03-08)
**Score:** Crítico (UX essencial — autenticação e visibilidade)
**Features:** F-142 a F-143

---

## Contexto

O Hub não possui página de área do usuário nem opção de logout. Além disso, ao logar com `SYSROLE=sysadmin`, o sistema deve exibir dados de **todos os usuários** — incluindo todos os agentes de todos os owners, não apenas os do usuário logado.

---

## F-142 — Hub: Página de Área do Usuário com Logout

### Objetivo
Criar uma página `/account` (ou `/profile`) no Hub onde o usuário logado pode:
- Ver suas informações (nome, papel/role, ID)
- Fazer logout (limpar token JWT do store e redirecionar para `/login`)

### Implementação

**Rota:** `/account` via TanStack Router

**Conteúdo da página:**
- Card com informações do usuário: nome, email (se disponível), role
- Botão "Sair" que:
  1. Chama `useAuthStore().logout()` (ou equivalente — limpa token e user)
  2. Redireciona para `/login`

**Navegação:**
- Adicionar link para `/account` no menu lateral ou header do Hub (ex: avatar/ícone de usuário)
- Deve estar acessível em qualquer página autenticada

**Stack:**
- TanStack Router para a rota
- `useAuthStore` do `lib/auth.ts` para dados do usuário e logout
- shadcn components: `Card`, `Button`, `Avatar` (ou `UserCircle` icon)

### Testes
- Página `/account` renderiza informações do usuário logado
- Botão "Sair" redireciona para `/login` e limpa o token
- Link para `/account` aparece na navegação principal
- `npm run build:hub` passa sem erros

---

## F-143 — Hub: Visão Sysadmin — Ver Agentes de Todos os Usuários

### Objetivo
Quando o usuário logado tem `role=sysadmin`, a listagem de agentes no Hub deve exibir **agentes de todos os owners** (todos os usuários), não apenas os do usuário atual.

### Implementação

**Backend:**
- Endpoint `GET /agents` deve aceitar query param `?scope=all` (default: agentes do usuário logado)
- Com `scope=all`, retorna todos os agentes de todos os owners
- Apenas usuários com `role=sysadmin` podem usar `scope=all` — retornar 403 se não for sysadmin

**Hub:**
- Ao carregar a listagem de agentes, verificar `useAuthStore().user.role`
- Se `role === "sysadmin"`, chamar `GET /agents?scope=all`
- Na listagem, adicionar coluna/badge com o owner do agente (ex: `guga.assistente` → owner: `guga`)
- Adicionar badge visual "Admin" no header quando logado como sysadmin

**Nota de design:**
- Respeitar a convenção de ID de agente `owner.slug` — o owner já está no ID
- Não criar novo estado de navegação — usar o mesmo componente de listagem, apenas mais dados

### Testes
- Com `role=sysadmin`, a listagem exibe agentes de todos os owners com badge de owner
- Com `role` comum, a listagem exibe apenas agentes do próprio usuário (comportamento atual)
- `GET /agents?scope=all` sem sysadmin retorna 403
- Badge "Admin" aparece no header quando logado como sysadmin
- `npm run build:hub` e `npm run typecheck` passam sem erros

---

## Dependências

- F-142: nenhuma (features independentes)
- F-143: nenhuma (features independentes)

## Stack

- **Backend:** Hono, JWT middleware (já tem `role` no payload), `listAgents()` do registry
- **Hub:** TanStack Router, `useAuthStore`, TanStack Query, shadcn/ui
