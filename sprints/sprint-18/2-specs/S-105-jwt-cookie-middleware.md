# S-105 — JWT via HTTP-only Cookie + Middleware Cookie-First + Logout

Migrar a entrega do JWT de body para cookie HttpOnly e atualizar o middleware de autenticação para ler cookie primeiro.

**Resolve:** D-007 (JWT via HTTP-only cookie + middleware cookie-first)
**Score de prioridade:** 8
**Dependência:** Nenhuma — pode rodar em paralelo com S-100, S-101, S-102
**PRP:** 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

---

## 1. Objetivo

JWT em `localStorage` é vulnerável a XSS. Migrar para `Set-Cookie: HttpOnly; Secure; SameSite=Strict` elimina essa superfície de ataque. O middleware de auth deve aceitar cookie como fonte primária, mantendo `Authorization: Bearer` como fallback para API keys e uso programático.

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/routes/auth.ts` — Login retorna cookie

Modificar `POST /auth/login`:

```typescript
import { setCookie, deleteCookie } from "hono/cookie";

app.post("/auth/login", authRateLimit, async (c) => {
  // ... validação existente ...

  const token = await createAuthToken(slug, role);

  // Setar cookie HttpOnly
  setCookie(c, "token", token, {
    httpOnly: true,
    secure: true,           // requer HTTPS
    sameSite: "Strict",
    path: "/api",
    maxAge: 24 * 60 * 60,   // 24h em segundos
  });

  // Retornar user info no body (sem token)
  return c.json({
    success: true,
    user: { id: slug, role, displayName },
  });
});
```

**IMPORTANTE:** O campo `token` **não é mais retornado no body**. O frontend recebe apenas `{ success, user }`.

Aplicar o mesmo padrão em `POST /auth/otp-verify` (S-104).

### 2.2 Arquivo: `apps/backbone/src/routes/auth.ts` — Novo endpoint /auth/logout

```typescript
app.post("/auth/logout", async (c) => {
  deleteCookie(c, "token", { path: "/api" });
  return c.json({ success: true });
});
```

O endpoint é público (não requer JWT) para que o client possa fazer logout mesmo com token expirado.

### 2.3 Arquivo: `apps/backbone/src/routes/index.ts` — Middleware cookie-first

Atualizar o middleware JWT para checar cookie como fonte primária:

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

### 2.4 Cookie path e CORS

O cookie usa `path: "/api"` para que:
- Seja enviado automaticamente em todas as chamadas à API
- Não seja enviado para assets estáticos (performance)

**CORS:** se o frontend e o backend estão em origens diferentes (dev: Vite proxy), verificar que:
- `credentials: "include"` está configurado no fetch do frontend
- O servidor responde com `Access-Control-Allow-Credentials: true`

No setup atual com Vite proxy (`/api` → `:BACKBONE_PORT`), o cookie é same-origin — CORS não é problema.

### 2.5 Secure flag em development

O flag `Secure` requer HTTPS. Em desenvolvimento local (HTTP), o cookie não será enviado pelo browser. Opções:

```typescript
const isProduction = process.env.NODE_ENV === "production";

setCookie(c, "token", token, {
  httpOnly: true,
  secure: isProduction,     // false em dev para funcionar com HTTP
  sameSite: "Strict",
  path: "/api",
  maxAge: 24 * 60 * 60,
});
```

---

## 3. Regras de Implementação

- **Backward-compatible:** `Authorization: Bearer` continua funcionando para API keys (`sk_...`) e uso programático
- **Query param** `?token=` continua funcionando para EventSource/SSE (não suporta headers customizados)
- O cookie não é acessível por JavaScript (`HttpOnly`) — elimina XSS como vetor
- `SameSite=Strict` previne CSRF — o cookie só é enviado em requisições same-site
- O body do login **não retorna mais o token** — apenas `{ success, user }`
- O endpoint `/auth/logout` apaga o cookie com `deleteCookie`
- O flag `Secure` deve ser condicional ao ambiente (produção vs. dev)

---

## 4. Critérios de Aceite

- [ ] `POST /auth/login` responde com `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict; Path=/api`
- [ ] `POST /auth/login` retorna `{ success, user }` no body (sem campo `token`)
- [ ] `POST /auth/otp-verify` responde com o mesmo padrão de cookie
- [ ] `POST /auth/logout` apaga o cookie e retorna `{ success: true }`
- [ ] Middleware JWT aceita token de: cookie → header Bearer → query param (nesta ordem)
- [ ] API keys (`sk_...`) via header Bearer continuam funcionando
- [ ] EventSource via `?token=` continua funcionando
- [ ] Rotas públicas de auth não são bloqueadas pelo middleware
- [ ] Flag `Secure` é condicional ao ambiente
- [ ] Build compila sem erros
