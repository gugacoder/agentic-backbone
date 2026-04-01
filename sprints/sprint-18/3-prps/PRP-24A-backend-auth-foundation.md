# PRP-24A — Backend Auth Foundation: Identify + bcrypt + Rate Limiting

Implementar os três pilares backend do novo sistema de autenticação: endpoint de identificação com campo `auth` no UserConfig, migração de senhas para bcrypt, e middleware de rate limiting.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- Login em etapa única: `POST /auth/login` com username + password, JWT retornado no body
- `verifyPassword` em `users/password.ts` compara strings via `timingSafeEqual` — senhas reversíveis (AES-256-GCM)
- Sem rate limiting — brute-force viável em `/auth/login`
- `UserConfig` não possui campo `auth` — todos os users têm login, incluindo users de sistema
- Sem endpoint de identificação — frontend não sabe qual método de auth usar

### Estado desejado

- `POST /auth/identify` retorna o método de autenticação do user (senha, OTP ou escolha)
- `UserConfig` tem campo `auth?: { otp?: boolean; password?: boolean }` para controlar acesso
- Senhas hasheadas com bcrypt (cost 12), migração lazy on-login
- Rate limiting de 5 tentativas por IP a cada 15 minutos nos endpoints de auth

### Dependencias

- Nenhuma — este PRP é o desbloqueador de todo o fluxo

## Especificacao

### Feature F-350: Endpoint /auth/identify + campo auth no UserConfig

**Spec:** S-100

Adicionar o campo `auth` ao `UserConfig` e criar o endpoint de identificação (etapa 1 do wizard).

#### 1. `apps/backbone/src/users/types.ts`

Adicionar interface `UserAuth` e campo `auth` ao `UserConfig`:

```typescript
export interface UserAuth {
  otp?: boolean;
  password?: boolean;
}

// Dentro de UserConfig, adicionar:
auth?: UserAuth;
```

- `auth` é opcional — users sem `auth` (ou com `auth: {}`) **não têm login**
- `auth.password: true` requer `credential.yml` com senha
- `auth.otp: true` requer `phoneNumber` preenchido no UserConfig

#### 2. Schema Zod (`apps/backbone/src/context/schemas.ts` ou onde `UserMdSchema` é definido)

Adicionar o campo `auth` ao schema Zod do frontmatter de `USER.md`:

```typescript
auth: z.object({
  otp: z.boolean().optional(),
  password: z.boolean().optional(),
}).optional(),
```

#### 3. `apps/backbone/src/users/manager.ts`

Atualizar `createUser()` e `updateUser()` para aceitar e persistir o campo `auth` no frontmatter de `USER.md`. A leitura já será automática pelo parser de frontmatter se o schema estiver atualizado.

#### 4. `apps/backbone/src/routes/auth.ts` — Novo endpoint `POST /auth/identify`

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

  // 5. Se OTP disponível e método é "otp", enviar código
  //    TODO: integrar sendOtp() quando PRP-24B estiver implementado
  if (method === "otp") {
    // await sendOtp(resolved.slug, config.phoneNumber!);
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

#### 5. `context/users/system/USER.md`

Adicionar campo `auth` ao user `system` (para testes):

```yaml
auth:
  password: true
```

#### 6. Rota pública

O endpoint `/auth/identify` deve ser **público** (sem JWT). Verificar que o middleware de auth em `routes/index.ts` não bloqueia esta rota.

#### Regras

- Manter o endpoint `POST /auth/login` existente intacto
- Não enviar OTP real nesta feature — apenas preparar o ponto de integração (TODO)
- A mensagem de erro 401 deve ser idêntica para todos os cenários de falha (anti-enumeração)
- O campo `phoneSuffix` retorna apenas os 2 últimos dígitos do telefone (privacidade)

### Feature F-351: Migração de senhas para bcrypt

**Spec:** S-101

Substituir a comparação direta de strings por hashing bcrypt com detecção de formato antigo e re-hash transparente.

#### 1. Dependência: instalar `bcrypt`

```bash
npm install bcrypt --workspace=apps/backbone
npm install -D @types/bcrypt --workspace=apps/backbone
```

Alternativa: `bcryptjs` (JavaScript puro) se `bcrypt` nativo causar problemas de compilação.

#### 2. `apps/backbone/src/users/password.ts` (REESCREVER)

```typescript
import bcrypt from "bcrypt";

const BCRYPT_COST = 12;

function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$/.test(stored);
}

export async function verifyPassword(
  input: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isBcryptHash(stored)) {
    const valid = await bcrypt.compare(input, stored);
    return { valid, needsRehash: false };
  }

  // Formato antigo: comparação direta (timing-safe)
  const a = Buffer.from(input, "utf-8");
  const b = Buffer.from(stored, "utf-8");
  if (a.length !== b.length) {
    return { valid: false, needsRehash: false };
  }
  const { timingSafeEqual } = await import("crypto");
  const valid = timingSafeEqual(a, b);
  return { valid, needsRehash: valid }; // se válido, precisa re-hash
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}
```

**IMPORTANTE:** A assinatura de `verifyPassword` muda de síncrona para assíncrona (`Promise`). Todos os call sites devem ser atualizados com `await`.

#### 3. `apps/backbone/src/routes/auth.ts` — Atualizar login

```typescript
// Antes:
const valid = verifyPassword(password, record.password);

// Depois:
const { valid, needsRehash } = await verifyPassword(password, record.password);

if (valid && needsRehash) {
  const hashed = await hashPassword(password);
  await updateUserCredentialPassword(record.slug, hashed);
}
```

#### 4. `apps/backbone/src/users/manager.ts` — Hash em createUser/updateUser

- `createUser()` com senha: hashear antes de gravar
- `updateUser()` quando atualiza senha: hashear antes de gravar
- Nova função `updateUserCredentialPassword(slug, hashedPassword)` para re-hash transparente

#### Regras

- Cost factor 12 é o mínimo recomendado (OWASP 2024)
- A migração é **lazy** (on-login) — não há script de migração em massa
- Não remover a lógica de decriptação do `credential.yml` (AES-256-GCM) — o hash bcrypt será encriptado em disco da mesma forma
- `verifyPassword` deve permanecer timing-safe no fallback plaintext

### Feature F-352: Rate limiting middleware para endpoints de auth

**Spec:** S-102

Middleware Hono de rate limiting in-memory para prevenir brute-force nos endpoints de autenticação.

#### 1. Novo arquivo: `apps/backbone/src/middleware/rate-limit.ts`

```typescript
import type { MiddlewareHandler } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function rateLimit(
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    const now = Date.now();
    const entry = store.get(ip);

    if (entry && entry.resetAt > now) {
      if (entry.count >= maxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return c.json(
          {
            error: "Muitas tentativas. Tente novamente em alguns minutos.",
            retryAfter,
          },
          429
        );
      }
      entry.count++;
    } else {
      store.set(ip, { count: 1, resetAt: now + windowMs });
    }

    await next();
  };
}
```

#### 2. `apps/backbone/src/routes/auth.ts` — Aplicar middleware

```typescript
import { rateLimit } from "../middleware/rate-limit.js";

const authRateLimit = rateLimit(5, 15 * 60 * 1000);

app.post("/auth/identify", authRateLimit, async (c) => { /* ... */ });
app.post("/auth/login", authRateLimit, async (c) => { /* ... */ });
app.post("/auth/otp-verify", authRateLimit, async (c) => { /* ... */ });
```

#### Regras

- In-memory (`Map`) — sem dependência de Redis
- Rate limit **por IP**, não por username — previne enumeração
- Tentativas contam mesmo que o login falhe por outros motivos
- Não aplicar em `GET /auth/me` — é rota protegida por JWT
- Resposta 429 inclui `retryAfter` em segundos (usado pelo frontend para countdown)

## Limites

- **NÃO** implementar OTP (envio, verificação, config) — isso é PRP-24B
- **NÃO** alterar a entrega do JWT (cookie vs body) — isso é PRP-24C
- **NÃO** alterar o frontend (Hub ou Chat) — isso é PRP-24D e PRP-24E
- **NÃO** criar script de migração em massa de senhas — a migração é lazy

## Validacao

- [ ] `UserConfig` tem campo `auth?: { otp?: boolean; password?: boolean }`
- [ ] Schema Zod de `USER.md` aceita o campo `auth`
- [ ] `POST /auth/identify` retorna `method` correto conforme `auth` do user
- [ ] `POST /auth/identify` retorna 401 para user inexistente e user sem auth (mesma mensagem)
- [ ] Endpoint `/auth/identify` é público (não requer JWT)
- [ ] User `system` tem `auth.password: true` no `USER.md`
- [ ] `verifyPassword` é async e retorna `{ valid, needsRehash }`
- [ ] Senhas novas (createUser, updateUser) são hasheadas com bcrypt cost 12
- [ ] Login com senha no formato antigo funciona e re-hasheia automaticamente
- [ ] Todos os call sites de `verifyPassword` atualizados para async
- [ ] Middleware `rateLimit()` criado em `middleware/rate-limit.ts`
- [ ] Aplicado em `POST /auth/identify`, `POST /auth/login`, `POST /auth/otp-verify`
- [ ] Após 5 tentativas do mesmo IP em 15 min → resposta 429 com `retryAfter`
- [ ] `GET /auth/me` não é afetado pelo rate limit
- [ ] Build compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-350 /auth/identify + UserConfig auth | S-100 | D-001 |
| F-351 bcrypt migration | S-101 | D-002 |
| F-352 rate limiting middleware | S-102 | D-003 |
