# PRP-24C — JWT Cookie Delivery + Auth Middleware Cookie-First

Migrar a entrega do JWT de body para cookie HttpOnly, atualizar o middleware de autenticação para ler cookie primeiro, e criar endpoint de logout.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- `POST /auth/login` retorna JWT no body (`c.json({ token })`)
- Frontend armazena token em localStorage — vulnerável a XSS
- Middleware de auth lê `Authorization: Bearer` e `?token=` (query param)
- Não existe endpoint de logout
- `POST /auth/otp-verify` (PRP-24B) também retorna JWT no body

### Estado desejado

- Login e OTP-verify respondem com `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict; Path=/api`
- Body retorna `{ success, user }` sem o campo `token`
- Middleware de auth: cookie → header Bearer → query param (nesta ordem)
- `POST /auth/logout` apaga o cookie
- `Authorization: Bearer` mantido para API keys (`sk_...`) e uso programático

### Dependencias

- **PRP-24A** — endpoint `/auth/login` existente (que será modificado)
- **PRP-24B** — endpoint `/auth/otp-verify` (que será modificado para usar cookie)

## Especificacao

### Feature F-356: JWT via cookie + logout endpoint

**Spec:** S-105 seções 2.1, 2.2, 2.5

Modificar os endpoints de autenticação para retornar JWT via `Set-Cookie` e criar endpoint de logout.

#### 1. `apps/backbone/src/routes/auth.ts` — Login retorna cookie

```typescript
import { setCookie, deleteCookie } from "hono/cookie";

const isProduction = process.env.NODE_ENV === "production";

app.post("/auth/login", authRateLimit, async (c) => {
  // ... validação existente ...

  const token = await createAuthToken(slug, role);

  setCookie(c, "token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Strict",
    path: "/api",
    maxAge: 24 * 60 * 60, // 24h
  });

  return c.json({
    success: true,
    user: { id: slug, role, displayName },
  });
});
```

**IMPORTANTE:** O campo `token` **não é mais retornado no body**. O frontend recebe apenas `{ success, user }`.

#### 2. Aplicar mesmo padrão em `POST /auth/otp-verify`

```typescript
app.post("/auth/otp-verify", authRateLimit, async (c) => {
  // ... validação existente (PRP-24B) ...

  const token = await createAuthToken(resolved.slug, resolved.config.role ?? "user");

  setCookie(c, "token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Strict",
    path: "/api",
    maxAge: 24 * 60 * 60,
  });

  return c.json({
    success: true,
    user: { id: resolved.slug, role: resolved.config.role, displayName: resolved.config.displayName },
  });
});
```

#### 3. Novo endpoint: `POST /auth/logout`

```typescript
app.post("/auth/logout", async (c) => {
  deleteCookie(c, "token", { path: "/api" });
  return c.json({ success: true });
});
```

O endpoint é público (sem JWT) — permite logout mesmo com token expirado.

#### Regras

- Flag `Secure` é condicional: `false` em dev (HTTP), `true` em produção (HTTPS)
- `SameSite=Strict` previne CSRF
- Cookie `path: "/api"` — não enviado para assets estáticos
- `/auth/logout` é público
- Extrair a lógica de `setCookie` para um helper se necessário para evitar duplicação entre login e otp-verify

### Feature F-357: Auth middleware cookie-first

**Spec:** S-105 seção 2.3

Atualizar o middleware JWT para checar cookie como fonte primária de token.

#### 1. `apps/backbone/src/routes/index.ts` — Middleware atualizado

```typescript
import { getCookie } from "hono/cookie";

// Ordem de precedência:
// 1. Cookie "token"
// 2. Header "Authorization: Bearer <token>"
// 3. Query param "?token=<value>"

app.use("/api/*", async (c, next) => {
  // Skip auth para webhooks
  if (c.req.path.includes("/webhook")) {
    return next();
  }

  // Skip auth para rotas públicas de auth
  const publicAuthPaths = ["/auth/login", "/auth/identify", "/auth/otp-verify", "/auth/otp-send", "/auth/logout"];
  const isPublicAuth = publicAuthPaths.some((p) => c.req.path.endsWith(p));
  if (isPublicAuth && c.req.method === "POST") {
    return next();
  }

  let token: string | undefined;

  // 1. Cookie
  token = getCookie(c, "token");

  // 2. Authorization header
  if (!token) {
    const authHeader = c.req.header("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  // 3. Query param (para EventSource/SSE)
  if (!token) {
    token = c.req.query("token");
  }

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // API key auth (sk_...) — mantido como está
  if (token.startsWith("sk_")) {
    // ... lógica existente de API key ...
    return next();
  }

  // JWT verification — lógica existente
  // ...
});
```

#### Regras

- A ordem de precedência é: cookie → header → query param
- API keys (`sk_...`) via Bearer continuam funcionando
- Query param `?token=` continua funcionando para EventSource/SSE
- As rotas públicas de auth incluem os novos endpoints (identify, otp-verify, otp-send, logout)
- CORS: no setup com Vite proxy, o cookie é same-origin — CORS não é problema

## Limites

- **NÃO** alterar o frontend — isso é PRP-24D e PRP-24E
- **NÃO** remover suporte a `Authorization: Bearer` — necessário para API keys e uso programático
- **NÃO** remover suporte a `?token=` query param — necessário para EventSource/SSE
- **NÃO** alterar a lógica de geração de JWT — apenas o mecanismo de entrega muda

## Validacao

- [ ] `POST /auth/login` responde com `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict; Path=/api`
- [ ] `POST /auth/login` retorna `{ success, user }` no body (sem campo `token`)
- [ ] `POST /auth/otp-verify` responde com o mesmo padrão de cookie
- [ ] `POST /auth/logout` apaga o cookie e retorna `{ success: true }`
- [ ] Middleware JWT aceita token de: cookie → header Bearer → query param (nesta ordem)
- [ ] API keys (`sk_...`) via header Bearer continuam funcionando
- [ ] EventSource via `?token=` continua funcionando
- [ ] Rotas públicas de auth não são bloqueadas pelo middleware (incluindo novos endpoints)
- [ ] Flag `Secure` é condicional ao ambiente (produção vs. dev)
- [ ] Build compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-356 JWT cookie + logout | S-105 | D-007 |
| F-357 auth middleware cookie-first | S-105 | D-007 |
