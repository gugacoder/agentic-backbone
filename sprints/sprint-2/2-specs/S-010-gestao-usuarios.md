# AB Hub - Gestao de Usuarios

Interface para criar, editar e gerenciar usuarios com permissoes, habilitando equipes e acesso segmentado.

---

## 1. Objetivo

- Listar usuarios cadastrados com status e permissoes
- Criar novos usuarios com perfil e permissoes definidas
- Editar perfil e permissoes de usuarios existentes
- Excluir usuarios (exceto system)
- Resolver D-016 (sem gestao de usuarios), G-016 (equipe com roles)

---

## 2. API Endpoints Existentes

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/users` | Listar usuarios (sysuser only) |
| GET | `/users/:slug` | Detalhe do usuario (sysuser ou self) |
| POST | `/users` | Criar usuario (sysuser only) |
| PATCH | `/users/:slug` | Atualizar usuario (sysuser: tudo; self: displayName, email, password) |
| DELETE | `/users/:slug` | Remover usuario (sysuser only, exceto `system`) |

**Backend ja completo.** O modelo de permissoes existente:

```typescript
interface UserPermissions {
  canCreateAgents?: boolean;
  canCreateChannels?: boolean;
  maxAgents?: number;
}
```

### 2.1 Endpoints Novos Necessarios

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/users/:slug/agents` | Listar agentes do usuario |

**Justificativa:** Para mostrar na tela de detalhe quantos agentes o usuario possui e quais.

---

## 3. Telas

### 3.1 Lista de Usuarios (`/settings/users`)

**Layout:** Tabela responsiva (desktop), lista de cards (mobile).

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Nome | `user.displayName` | Texto com avatar initials |
| Slug | `user.slug` | Texto monoespaco |
| Email | `user.email` | Texto (ou "—") |
| Permissoes | `user.permissions` | Badges: "Criar agentes", "Criar canais" |
| Max Agentes | `user.permissions.maxAgents` | Numero ou "Ilimitado" |

**Acoes:**
- Botao "Novo usuario" → dialog de criacao
- Click na linha → dialog de edicao
- Indicacao visual do sysuser (badge especial, nao editavel)

### 3.2 Criar Usuario (Dialog)

**Formulario:**

| Campo | Tipo | Obrigatorio | Validacao |
|-------|------|-------------|-----------|
| Slug | Input texto | Sim | kebab-case, unico, 3-30 chars |
| Nome | Input texto | Sim | 2-100 chars |
| Email | Input email | Nao | formato email |
| Senha | Input password | Sim | min 6 chars |
| Confirmar senha | Input password | Sim | igual a senha |
| Criar agentes | Switch | Nao | default: true |
| Criar canais | Switch | Nao | default: false |
| Max agentes | Input numerico | Nao | 0 = ilimitado |

**Ao criar:**
1. `POST /users` com dados do formulario
2. Toast de sucesso: "Usuario criado com sucesso"
3. Invalidar query `["users"]`
4. Fechar dialog

### 3.3 Editar Usuario (Dialog)

Mesmo formulario da criacao, com diferencas:
- Slug readonly (nao editavel apos criacao)
- Senha opcional (deixar vazio = nao alterar)
- Botao "Excluir usuario" no rodape (com confirmacao)

### 3.4 Integracao com Navegacao

Adicionar sub-rota dentro de `/settings`:

| Tab | Rota | Conteudo |
|-----|------|----------|
| LLM | `/settings` | Planos LLM (S-009) |
| Web Search | `/settings/web-search` | Provedor de busca (S-009) |
| Usuarios | `/settings/users` | Gestao de usuarios |
| Sistema | `/settings/system` | Info do sistema (S-009) |

---

## 4. Componentes

### 4.1 UserList

**Localizacao:** `components/users/user-list.tsx`

```typescript
interface UserListProps {
  users: User[];
  onEdit: (slug: string) => void;
  onCreate: () => void;
}
```

- Tabela com shadcn Table (desktop)
- Lista de cards (mobile)

### 4.2 UserForm

**Localizacao:** `components/users/user-form.tsx`

```typescript
interface UserFormProps {
  user?: User;           // undefined = criacao
  onSuccess: () => void;
  onDelete?: () => void; // apenas edicao
}
```

- React Hook Form + Zod validation
- Dialog (shadcn Dialog) para criacao e edicao

### 4.3 PermissionBadges

**Localizacao:** `components/users/permission-badges.tsx`

```typescript
interface PermissionBadgesProps {
  permissions?: UserPermissions;
}
```

- Badges coloridos para cada permissao habilitada

### 4.4 API Module

**Localizacao:** `api/users.ts` (ja existe, expandir)

```typescript
export const usersQueryOptions = () =>
  queryOptions({
    queryKey: ["users"],
    queryFn: () => request<User[]>("/users"),
  });

export const userQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["users", slug],
    queryFn: () => request<User>(`/users/${slug}`),
  });
```

---

## 5. Criterios de Aceite

- [ ] Lista de usuarios exibe todos os usuarios cadastrados
- [ ] Formulario de criacao valida slug, nome e senha
- [ ] Criar usuario com permissoes cria USER.md no backend
- [ ] Editar usuario atualiza displayName, email, permissoes
- [ ] Alterar senha funciona (campo opcional na edicao)
- [ ] Excluir usuario pede confirmacao e remove do sistema
- [ ] Nao permite excluir usuario `system`
- [ ] Sysuser aparece com badge especial (nao editavel via formulario)
- [ ] Permissoes exibidas como badges na lista
- [ ] Layout responsivo: tabela (desktop), cards (mobile)
- [ ] Navegacao via tabs em `/settings/users`

---

## 6. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| UserList | D-016 (sem gestao de usuarios), G-016 (equipe com roles) |
| UserForm | D-016, G-007 (independencia tecnica) |
| PermissionBadges | G-016 (controle de acesso) |
