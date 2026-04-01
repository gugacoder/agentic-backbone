# S-100 — Endpoint /auth/identify + Campo auth no UserConfig

Criar o endpoint de identificação (etapa 1 do wizard de login) e adicionar o campo `auth` ao UserConfig para controlar quais métodos de autenticação cada user suporta.

**Resolve:** D-001 (Endpoint /auth/identify + campo auth no UserConfig)
**Score de prioridade:** 10
**Dependência:** Nenhuma — desbloqueador de todo o fluxo
**PRP:** 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

---

## 1. Objetivo

Introduzir a etapa de identificação do login: o frontend envia o username (email ou slug) e recebe qual método de autenticação usar (senha, OTP ou escolha). Isso requer que cada user tenha um campo `auth` declarando seus métodos suportados.

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/users/types.ts`

Adicionar interface `UserAuth` e campo `auth` ao `UserConfig`:

```typescript
export interface UserAuth {
  otp?: boolean;
  password?: boolean;
}

// Dentro de UserConfig, adicionar:
export interface UserConfig {
  // ... campos existentes ...
  auth?: UserAuth;
}
```

**Regras:**
- `auth` é opcional — users sem `auth` (ou com `auth: {}`) **não têm login** (ex: users de sistema como `pneusos`)
- `auth.password: true` requer `credential.yml` com senha
- `auth.otp: true` requer `phoneNumber` preenchido no UserConfig

### 2.2 Arquivo: `apps/backbone/src/context/schemas.ts` (ou onde `UserMdSchema` é definido)

Adicionar o campo `auth` ao schema Zod do frontmatter de `USER.md`:

```typescript
auth: z.object({
  otp: z.boolean().optional(),
  password: z.boolean().optional(),
}).optional(),
```

### 2.3 Arquivo: `apps/backbone/src/users/manager.ts`

Atualizar `createUser()` e `updateUser()` para aceitar e persistir o campo `auth` no frontmatter de `USER.md`.

Na leitura (`getUser`, `getUserByEmail`, etc.), o campo `auth` já será lido automaticamente pelo parser de frontmatter se o schema estiver atualizado.

### 2.4 Arquivo: `apps/backbone/src/routes/auth.ts` — Novo endpoint

Adicionar `POST /auth/identify`:

```typescript
app.post("/auth/identify", async (c) => {
  const { username } = await c.req.json<{ username: string }>();

  // 1. Resolver user por email ou slug
  const resolved = await getUserByEmail(username) ?? await getUserBySlug(username);

  // 2. User inexistente → 401 (mesma mensagem genérica)
  if (!resolved) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  const { config } = resolved;

  // 3. User sem auth configurado → 401
  if (!config.auth?.otp && !config.auth?.password) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  // 4. Determinar método
  const hasOtp = config.auth.otp === true && !!config.phoneNumber;
  const hasPassword = config.auth.password === true;

  let method: "otp" | "password" | "choice";
  let phoneSuffix: string | undefined;

  if (hasOtp && hasPassword) {
    method = "choice";
  } else if (hasOtp) {
    method = "otp";
  } else {
    method = "password";
  }

  // 5. Se OTP disponível e método é "otp" (não "choice"), enviar código agora
  //    Se "choice", o envio acontece quando o user escolher OTP
  if (method === "otp") {
    // await sendOtp(resolved.slug, config.phoneNumber!);  // implementado em S-103
    phoneSuffix = config.phoneNumber!.slice(-2);
  }

  if (method === "choice") {
    phoneSuffix = config.phoneNumber!.slice(-2);
  }

  // 6. Resposta
  const response: Record<string, unknown> = { method };
  if (method === "choice") {
    response.default = "otp";
  }
  if (phoneSuffix) {
    response.phoneSuffix = phoneSuffix;
  }

  return c.json(response);
});
```

**Nota:** A chamada a `sendOtp()` será integrada quando S-103 (OTP sender) estiver implementada. Nesta spec, deixar o ponto de integração comentado com `// TODO: S-103`.

#### Resposta do endpoint

| Cenário | Response |
|---------|----------|
| Só OTP | `{ method: "otp", phoneSuffix: "61" }` |
| Só senha | `{ method: "password" }` |
| Ambos | `{ method: "choice", default: "otp", phoneSuffix: "61" }` |
| User inexistente | `401 { error: "Credenciais inválidas" }` |
| User sem auth | `401 { error: "Credenciais inválidas" }` |

**Segurança:** mesma mensagem de erro para user inexistente e user sem auth — impede enumeração de usuários.

### 2.5 Arquivo: `context/users/system/USER.md`

Adicionar campo `auth` ao user `system` (para testes):

```yaml
auth:
  password: true
```

### 2.6 Rota pública

O endpoint `/auth/identify` deve ser **público** (sem JWT), assim como `/auth/login` já é. Verificar que o middleware de auth em `routes/index.ts` não bloqueia esta rota.

---

## 3. Regras de Implementação

- Manter o endpoint `POST /auth/login` existente intacto — ele continuará funcionando para a etapa 2 (senha)
- Não enviar OTP real nesta spec — apenas preparar o ponto de integração
- A mensagem de erro 401 deve ser idêntica para todos os cenários de falha (anti-enumeração)
- O campo `phoneSuffix` retorna apenas os 2 últimos dígitos do telefone (privacidade)

---

## 4. Critérios de Aceite

- [ ] `UserConfig` tem campo `auth?: { otp?: boolean; password?: boolean }`
- [ ] Schema Zod de `USER.md` aceita o campo `auth`
- [ ] `POST /auth/identify` retorna `method: "password"` para user com `auth.password: true`
- [ ] `POST /auth/identify` retorna `method: "otp"` para user com `auth.otp: true` e `phoneNumber` preenchido
- [ ] `POST /auth/identify` retorna `method: "choice"` para user com ambos
- [ ] `POST /auth/identify` retorna 401 para user inexistente
- [ ] `POST /auth/identify` retorna 401 para user sem `auth` configurado
- [ ] Mensagem de erro é idêntica em todos os cenários de falha
- [ ] Endpoint é público (não requer JWT)
- [ ] User `system` tem `auth.password: true` no `USER.md`
