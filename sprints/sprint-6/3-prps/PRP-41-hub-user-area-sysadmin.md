# PRP-41 — Hub: Área do Usuário, Logout e Visão Sysadmin

Página de perfil do usuário com logout e visão administrativa que permite ao sysadmin ver agentes de todos os owners. Features essenciais de UX e controle de acesso.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub não possui página de área do usuário nem opção de logout — o usuário precisa limpar manualmente o token do navegador. Além disso, ao logar com `role=sysadmin`, a listagem de agentes exibe apenas os agentes do próprio usuário, sem visibilidade cross-owner.

### Estado desejado

1. Página `/account` com informações do usuário logado e botão de logout
2. Link para `/account` acessível na navegação principal (header ou sidebar)
3. Quando `role=sysadmin`, listagem de agentes exibe todos os agentes de todos os owners com badge de owner
4. Badge visual "Admin" no header quando logado como sysadmin

## Especificacao

### Feature F-142: Hub — Página de Área do Usuário com Logout

**Rota:** `/account` via TanStack Router

**Conteúdo da página:**

- Card com informações do usuário: nome, email (se disponível), role, ID
- Botão "Sair" que:
  1. Chama `useAuthStore().logout()` (limpa token e user)
  2. Redireciona para `/login`

**Navegação:**

- Adicionar link para `/account` no menu lateral ou header do Hub (ex: avatar/ícone de usuário)
- Deve estar acessível em qualquer página autenticada

**Stack:**

- TanStack Router para a rota
- `useAuthStore` do `lib/auth.ts` para dados do usuário e logout
- shadcn components: `Card`, `Button`, `Avatar`

### Feature F-143: Hub + API — Visão Sysadmin de Agentes de Todos os Owners

**Backend — extensão de `GET /agents`:**

- Aceita query param `?scope=all` (default: agentes do usuário logado)
- Com `scope=all`, chama `listAgents()` do registry sem filtro de owner
- Apenas `role=sysadmin` pode usar `scope=all` — retorna 403 caso contrário

**Hub — listagem de agentes:**

- Verificar `useAuthStore().user.role` ao montar a listagem
- Se `role === "sysadmin"`, chamar `GET /agents?scope=all`
- Adicionar badge/coluna com o owner do agente na listagem (extraído do ID `owner.slug`)
- Adicionar badge visual "Admin" no header quando logado como sysadmin

**Nota de design:**

- Respeitar a convenção de ID de agente `owner.slug` — o owner já está no ID
- Não criar novo estado de navegação — usar o mesmo componente de listagem, apenas mais dados

## Limites

- **NAO** implementar edição de perfil do usuário (apenas visualização + logout)
- **NAO** implementar CRUD de usuários nesta PRP (já existe em PRP-10)
- **NAO** implementar permissões granulares por agente para sysadmin (visibilidade global apenas)

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-10** (Gestão de Usuários) deve estar implementado — sistema de roles
- **PRP-03** (Gestão de Agentes) deve estar implementado — listagem de agentes existente

## Validacao

- [ ] Página `/account` renderiza informações do usuário logado (nome, role, ID)
- [ ] Botão "Sair" limpa o token JWT e redireciona para `/login`
- [ ] Link para `/account` aparece na navegação principal (header ou sidebar)
- [ ] Com `role=sysadmin`, listagem exibe agentes de todos os owners com badge de owner
- [ ] Com `role` comum, listagem exibe apenas agentes do próprio usuário (comportamento atual inalterado)
- [ ] `GET /agents?scope=all` sem sysadmin retorna 403
- [ ] Badge "Admin" aparece no header quando logado como sysadmin
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-142 Área do usuário + logout | Feedback operador | — |
| F-143 Visão sysadmin | Feedback operador | — |
