# PRP-10 — Gestao de Usuarios

Interface para criar, editar e gerenciar usuarios com permissoes, habilitando acesso segmentado por equipe.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem pagina `/settings` com tabs (PRP-09). A tab "Usuarios" existe como placeholder. O backbone expoe CRUD completo de usuarios:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/users` | Listar usuarios (sysuser only) |
| GET | `/users/:slug` | Detalhe do usuario |
| POST | `/users` | Criar usuario (sysuser only) |
| PATCH | `/users/:slug` | Atualizar usuario |
| DELETE | `/users/:slug` | Remover usuario (exceto `system`) |

Modelo de permissoes existente:

```typescript
interface UserPermissions {
  canCreateAgents?: boolean;
  canCreateChannels?: boolean;
  maxAgents?: number;
}
```

### Estado desejado

1. Tab "Usuarios" em `/settings/users` com lista de usuarios
2. Dialog de criacao com validacao (slug, nome, senha, permissoes)
3. Dialog de edicao (mesmos campos, slug readonly, senha opcional)
4. Exclusao com confirmacao (exceto system user)
5. Badges de permissoes na lista

## Especificacao

### Feature F-038: Lista de usuarios em /settings/users

**Substituir placeholder** da tab "Usuarios" em `/settings`:

- Fetch via `usersQueryOptions()`
- Tabela (shadcn Table, desktop) / Lista de cards (mobile):

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Nome | `user.displayName` | Texto com avatar initials |
| Slug | `user.slug` | Texto monoespaco |
| Email | `user.email` | Texto (ou "—") |
| Permissoes | `user.permissions` | Badges: "Criar agentes", "Criar canais" |
| Max Agentes | `user.permissions.maxAgents` | Numero ou "Ilimitado" |

- Botao "Novo usuario" no PageHeader → abre dialog de criacao
- Click na linha → abre dialog de edicao
- Sysuser com badge especial, nao editavel
- Indicacao visual do usuario logado

**components/users/permission-badges.tsx:**

```typescript
interface PermissionBadgesProps {
  permissions?: UserPermissions;
}
```

- Badges coloridos para cada permissao habilitada

### Feature F-039: Formulario criar/editar usuario

**components/users/user-form.tsx:**

```typescript
interface UserFormProps {
  user?: User;           // undefined = criacao
  onSuccess: () => void;
  onDelete?: () => void; // apenas edicao
}
```

- React Hook Form + Zod validation
- Renderiza em shadcn Dialog

**Campos (criacao):**

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

**Diferencas na edicao:**
- Slug readonly (nao editavel apos criacao)
- Senha opcional (deixar vazio = nao alterar)
- Botao "Excluir usuario" no rodape (com confirmacao)

**Criacao:** `POST /users` → toast sucesso, invalida `["users"]`, fecha dialog.
**Edicao:** `PATCH /users/:slug` → toast sucesso, invalida `["users"]`, fecha dialog.

### Feature F-040: Excluir usuario + endpoint agentes do usuario

**Exclusao:**
- Botao "Excluir" no dialog de edicao
- `ConfirmDialog` com mensagem: "Tem certeza que deseja excluir o usuario {slug}?"
- `DELETE /users/:slug` → toast sucesso, invalida `["users"]`, fecha dialogs
- Nao permite excluir usuario `system` (botao oculto/desabilitado)

**Endpoint novo — `GET /users/:slug/agents`:**
- Listar agentes do usuario para exibir na edicao
- Mostrar contagem "N agentes" no dialog de edicao

**API module — expandir `api/users.ts`:**

```typescript
export const usersQueryOptions = () =>
  queryOptions({
    queryKey: ["users"],
    queryFn: () => request<User[]>("/users"),
  });

export const userAgentsQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["users", slug, "agents"],
    queryFn: () => request<Agent[]>(`/users/${slug}/agents`),
  });
```

## Limites

- **NAO** implementar roles (admin/operador/viewer) — apenas permissoes granulares existentes. Roles ficam para sprint futuro.
- **NAO** implementar convite por email — apenas criacao direta pelo sysuser.
- **NAO** implementar avatar upload — apenas initials geradas do nome.
- **NAO** implementar auditoria de acoes por usuario — sprint futuro.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-09** (Configuracoes LLM) deve estar implementado — tab Usuarios vive na estrutura de tabs de `/settings`.

## Validacao

- [ ] Lista de usuarios exibe todos os usuarios cadastrados
- [ ] Formulario de criacao valida slug (kebab-case), nome e senha
- [ ] Criar usuario com permissoes funciona e aparece na lista
- [ ] Editar usuario atualiza displayName, email, permissoes
- [ ] Alterar senha funciona (campo opcional na edicao)
- [ ] Excluir usuario pede confirmacao e remove do sistema
- [ ] Nao permite excluir usuario `system`
- [ ] Sysuser aparece com badge especial (nao editavel)
- [ ] Permissoes exibidas como badges na lista
- [ ] Layout responsivo: tabela (desktop), cards (mobile)
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-038 Lista usuarios | S-010 sec 3.1 | D-016, G-016 |
| F-039 Form criar/editar | S-010 sec 3.2-3.3 | D-016, G-007 |
| F-040 Excluir + agentes | S-010 sec 2.1 | G-016 |
