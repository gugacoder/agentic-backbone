# S-104 — Endpoint /auth/otp-verify

Criar endpoint de verificação de código OTP que autentica o user e retorna JWT.

**Resolve:** D-006 (Endpoint /auth/otp-verify + validação do código)
**Score de prioridade:** 8
**Dependência:** S-103 (OTP sender + verifyOtp), S-105 (JWT via cookie — para formato de resposta)
**PRP:** 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

---

## 1. Objetivo

Criar o endpoint que finaliza o fluxo OTP: recebe username + código de 6 dígitos, valida contra o store in-memory (S-103) e, se válido, gera JWT e responde com cookie HttpOnly (S-105) ou body (fallback temporário até S-105).

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/routes/auth.ts` — Novo endpoint

```typescript
import { verifyOtp } from "../otp/sender.js";

app.post("/auth/otp-verify", authRateLimit, async (c) => {
  const { username, code } = await c.req.json<{ username: string; code: string }>();

  // 1. Validar input
  if (!username || !code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return c.json({ error: "Código inválido" }, 400);
  }

  // 2. Resolver user
  const resolved = await getUserByEmail(username) ?? await getUserBySlug(username);
  if (!resolved) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  // 3. Verificar OTP
  const valid = verifyOtp(resolved.slug, code);
  if (!valid) {
    return c.json({ error: "Código inválido ou expirado" }, 401);
  }

  // 4. Gerar JWT (mesma lógica do /auth/login)
  const role = resolved.config.role === "sysadmin" ? "sysuser" : "user";
  const token = await signJwt({
    sub: resolved.slug,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h
  });

  // 5. Responder com cookie (S-105) ou body (temporário)
  // Quando S-105 estiver implementado:
  //   setCookie(c, "token", token, {
  //     httpOnly: true, secure: true,
  //     sameSite: "Strict", path: "/api",
  //     maxAge: 24 * 60 * 60,
  //   });
  //   return c.json({ success: true });

  // Temporário (até S-105):
  return c.json({ token });
});
```

### 2.2 Rota pública

O endpoint `/auth/otp-verify` deve ser **público** (sem JWT), protegido apenas pelo rate limiting (S-102). Verificar que o middleware de auth em `routes/index.ts` não bloqueia esta rota.

### 2.3 Extração de lógica de JWT

A geração de JWT (`signJwt` com `sub`, `role`, `iat`, `exp`) é duplicada entre `/auth/login` e `/auth/otp-verify`. Extrair para uma função auxiliar:

```typescript
// Em auth.ts ou auth-helpers.ts:
async function createAuthToken(slug: string, role: string): Promise<string> {
  return signJwt({
    sub: slug,
    role: role === "sysadmin" ? "sysuser" : role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  });
}
```

Usar tanto em `POST /auth/login` quanto em `POST /auth/otp-verify`.

---

## 3. Regras de Implementação

- O código OTP é consumido na verificação (one-time use, garantido por S-103)
- Rate limiting (S-102) já está aplicado — previne brute-force de códigos
- A mensagem de erro para código inválido e código expirado pode ser a mesma ("Código inválido ou expirado")
- Input validation: código deve ser exatamente 6 dígitos numéricos
- A lógica de geração de JWT deve ser extraída para evitar duplicação com `/auth/login`
- O endpoint é público (sem JWT) — mesmo padrão de `/auth/login`

---

## 4. Critérios de Aceite

- [ ] `POST /auth/otp-verify` aceita `{ username, code }` e retorna JWT se válido
- [ ] Código inválido → 401
- [ ] Código expirado → 401
- [ ] Input inválido (não 6 dígitos) → 400
- [ ] User inexistente → 401
- [ ] Rate limiting aplicado (via S-102)
- [ ] Lógica de geração de JWT extraída e compartilhada com `/auth/login`
- [ ] Endpoint é público (sem JWT)
- [ ] Build compila sem erros
