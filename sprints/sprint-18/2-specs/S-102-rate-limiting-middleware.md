# S-102 — Rate Limiting Middleware para Endpoints de Auth

Adicionar middleware de rate limiting in-memory nos endpoints de autenticação para prevenir brute-force.

**Resolve:** D-003 (Rate limiting middleware 5 req / 15 min por IP)
**Score de prioridade:** 9
**Dependência:** Nenhuma — pode rodar em paralelo com S-100, S-101
**PRP:** 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

---

## 1. Objetivo

Os endpoints de autenticação (`/auth/identify`, `/auth/login`, `/auth/otp-verify`) não têm nenhuma proteção contra brute-force. Um atacante pode testar senhas e códigos OTP indefinidamente. Implementar rate limiting de 5 tentativas por IP a cada 15 minutos.

---

## 2. Alterações

### 2.1 Novo arquivo: `apps/backbone/src/middleware/rate-limit.ts`

Criar middleware Hono de rate limiting in-memory:

```typescript
import type { MiddlewareHandler } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpar entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Rate limiting middleware.
 * @param maxAttempts Máximo de tentativas por janela
 * @param windowMs Janela de tempo em milissegundos
 */
export function rateLimit(
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): MiddlewareHandler {
  return async (c, next) => {
    // Extrair IP do request
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      c.env?.remoteAddr ||
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

**Notas de implementação:**
- O `setInterval` com `.unref()` não impede o processo de encerrar
- IP extraído de `x-forwarded-for` (proxy/load balancer) com fallback
- A chave é apenas o IP — não inclui rota, para rate limitar globalmente todas as tentativas de auth de um mesmo IP

### 2.2 Arquivo: `apps/backbone/src/routes/auth.ts` — Aplicar middleware

Aplicar o middleware nas rotas de auth:

```typescript
import { rateLimit } from "../middleware/rate-limit.js";

const authRateLimit = rateLimit(5, 15 * 60 * 1000); // 5 tentativas, 15 min

app.post("/auth/identify", authRateLimit, async (c) => { /* ... */ });
app.post("/auth/login", authRateLimit, async (c) => { /* ... */ });
app.post("/auth/otp-verify", authRateLimit, async (c) => { /* ... */ });
```

**Alternativa:** aplicar o middleware a um grupo de rotas via `app.use("/auth/*", authRateLimit)` se a rota `/auth/me` (GET, protegida) não for impactada. Verificar que o rate limit só se aplica a rotas de autenticação (POST), não a rotas protegidas (GET).

### 2.3 Formato da resposta 429

```json
{
  "error": "Muitas tentativas. Tente novamente em alguns minutos.",
  "retryAfter": 542
}
```

- `retryAfter` em segundos (inteiro) — tempo restante até o reset da janela
- O frontend usará este valor para exibir countdown (S-106)

---

## 3. Regras de Implementação

- **In-memory** (`Map`) é suficiente — sem dependência de Redis para o escopo atual
- O rate limit é **por IP**, não por username — previne enumeração de users
- Tentativas contam mesmo que o login falhe por outros motivos (user inexistente, senha errada)
- O middleware deve ser aplicado **antes** do handler da rota
- Não aplicar rate limit em `/auth/me` (GET) — é rota protegida por JWT, não de autenticação

---

## 4. Critérios de Aceite

- [ ] Middleware `rateLimit()` criado em `middleware/rate-limit.ts`
- [ ] Aplicado em `POST /auth/identify`, `POST /auth/login`, `POST /auth/otp-verify`
- [ ] Após 5 tentativas do mesmo IP em 15 min → resposta 429 com `retryAfter`
- [ ] Tentativa 6+ retorna 429 sem executar o handler da rota
- [ ] Entradas expiradas são limpas periodicamente
- [ ] `POST /auth/me` (GET) não é afetado pelo rate limit
- [ ] Build compila sem erros
