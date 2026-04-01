# S-107 — Chat: Migrar Login de better-auth para Backbone Auth

Alinhar o app Chat ao fluxo de autenticação do Backbone, substituindo `better-auth` pelo wizard de 2 etapas com cookie HttpOnly.

**Resolve:** D-011 (Chat login wizard alinhado ao backbone)
**Score de prioridade:** 6
**Dependência:** S-105 (JWT cookie), S-106 (wizard de referência — padrões e componentes)
**PRP:** 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

---

## 1. Objetivo

O app Chat (`apps/chat`) usa `better-auth` (`createAuthClient` de `better-auth/react`), uma biblioteca externa que não integra com o backend Backbone. Isso cria dois sistemas de auth divergentes. Migrar para o mesmo fluxo do Hub: `/auth/identify` → `/auth/login` ou `/auth/otp-verify`, com JWT via cookie HttpOnly.

---

## 2. Estado Atual

- `apps/chat/src/lib/auth-client.ts` — usa `createAuthClient` de `better-auth/react`, exporta `signIn`, `signOut`, `useSession`, `getSession`
- `apps/chat/src/routes/login.tsx` — usa `signIn.email({ email, password })`, verifica role de equipe (`admin`, `manager`, `attendant`), usa `LoginForm` de `@workspace/ui`
- Framer Motion já está instalado e em uso no chat

---

## 3. Alterações

### 3.1 Arquivo: `apps/chat/src/lib/auth-client.ts` (REESCREVER)

Substituir `better-auth` por módulo nativo que chama os endpoints do Backbone:

```typescript
export interface AuthUser {
  id: string;
  role: string;
  displayName: string;
}

export interface IdentifyResult {
  method: "password" | "otp" | "choice";
  default?: "otp";
  phoneSuffix?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/v1/ai${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? "Erro desconhecido", data.retryAfter);
  }
  return res.json() as Promise<T>;
}

export async function identify(username: string): Promise<IdentifyResult> {
  return apiPost("/auth/identify", { username });
}

export async function loginWithPassword(username: string, password: string): Promise<AuthUser> {
  const { user } = await apiPost<{ user: AuthUser }>("/auth/login", { username, password });
  return user;
}

export async function loginWithOtp(username: string, code: string): Promise<AuthUser> {
  const { user } = await apiPost<{ user: AuthUser }>("/auth/otp-verify", { username, code });
  return user;
}

export async function resendOtp(username: string): Promise<void> {
  await apiPost("/auth/otp-send", { username });
}

export async function logout(): Promise<void> {
  await fetch("/api/v1/ai/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

export async function getSession(): Promise<AuthUser | null> {
  const res = await fetch("/api/v1/ai/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  const me = await res.json();
  return { id: me.user, role: me.role, displayName: me.displayName };
}

export { ApiError };
```

### 3.2 Arquivo: `apps/chat/src/routes/login.tsx` (REESCREVER)

Implementar wizard de 2 etapas, seguindo o mesmo padrão de S-106 (Hub). O chat já usa Framer Motion e tem uma estética própria — manter o visual existente (gradiente, card translúcido, logo).

**Diferenças em relação ao Hub:**
- Logo diferente (usa imagens SVG do chat)
- Verificação de role de equipe (`admin`, `manager`, `attendant`) após login bem-sucedido
- `returnUrl` no search params para redirect

**Estrutura do wizard:**
1. **Etapa 1** — Input de email/username → `/auth/identify`
2. **Etapa 2** — Senha, OTP ou escolha (igual ao Hub)
3. Após login: verificar role. Se não for equipe, logout + mensagem "Acesso restrito"

### 3.3 Componente OTP Input

Reutilizar o `OtpInput` de S-106. Opções:
- **Preferível:** mover `OtpInput` para `packages/ui` e importar como `@workspace/ui/components/otp-input`
- **Alternativa:** copiar componente para `apps/chat/src/components/otp-input.tsx`

### 3.4 Remover dependência `better-auth`

```bash
npm uninstall better-auth --workspace=apps/chat
```

Remover qualquer import de `better-auth` em todo o app chat.

### 3.5 Arquivo: `apps/chat/src/routes/__root.tsx` (ou equivalente)

Atualizar o guard de autenticação para usar `getSession()` nativo em vez de `better-auth`:

```typescript
// Antes:
import { getSession } from "@/lib/auth-client";
const session = await getSession();
const user = session?.data?.user;

// Depois:
import { getSession } from "@/lib/auth-client";
const user = await getSession(); // retorna AuthUser | null diretamente
```

### 3.6 Proxy do Vite (verificação)

Confirmar que o `vite.config.ts` do chat proxeia `/api` para o backbone, assim como o hub faz. Se já está configurado, nenhuma mudança necessária.

---

## 4. Regras de Implementação

- Manter a estética visual existente do chat (gradiente, card translúcido, logo SVG)
- Framer Motion já está instalado — usar as mesmas variantes de transição de S-106
- `credentials: "include"` em todos os fetch
- Verificação de role de equipe (`admin`, `manager`, `attendant`) deve ser mantida
- Não criar store Zustand no chat se o padrão atual não usa — funções standalone são suficientes
- Interface em pt-BR

---

## 5. Critérios de Aceite

- [ ] `better-auth` removido do `package.json` do chat
- [ ] `auth-client.ts` reescrito com funções nativas (identify, loginWithPassword, loginWithOtp, etc.)
- [ ] Login do chat é wizard de 2 etapas com transição Framer Motion
- [ ] OTP input funciona com auto-advance e auto-submit
- [ ] Reenvio OTP com countdown
- [ ] Rate limit (429) exibe feedback com countdown
- [ ] Verificação de role de equipe mantida após login
- [ ] `credentials: "include"` em todos os fetch
- [ ] Visual existente do chat preservado (gradiente, card, logo)
- [ ] Build do chat compila sem erros (`npm run build --workspace=apps/chat`)
