# PRP-24E — Chat: Migrar Login de better-auth para Backbone Auth

Alinhar o app Chat ao fluxo de autenticação do Backbone, substituindo `better-auth` pelo wizard de 2 etapas com cookie HttpOnly.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- `apps/chat/src/lib/auth-client.ts` usa `createAuthClient` de `better-auth/react` — biblioteca externa que não integra com o Backbone
- Login do Chat é formulário único usando `signIn.email({ email, password })`
- Dois sistemas de auth divergentes: Chat (better-auth) vs Hub (Backbone)
- Framer Motion já está instalado no Chat

### Estado desejado

- Chat usa os mesmos endpoints do Backbone (`/auth/identify`, `/auth/login`, `/auth/otp-verify`)
- `better-auth` removido do `package.json`
- Login é wizard de 2 etapas (mesmo padrão do Hub)
- Auth via cookie HttpOnly (`credentials: "include"`)
- Visual existente do Chat preservado (gradiente, card translúcido, logo SVG)

### Dependencias

- **PRP-24A** — endpoint `/auth/identify`, rate limiting
- **PRP-24B** — endpoints `/auth/otp-verify`, `/auth/otp-send`
- **PRP-24C** — JWT via cookie
- **PRP-24D** — padrões e componentes de referência (OtpInput, wizard pattern)

## Especificacao

### Feature F-361: Chat auth client — migrar de better-auth para Backbone

**Spec:** S-107 seções 3.1, 3.4, 3.5

Reescrever o módulo de autenticação do Chat para usar endpoints nativos do Backbone.

#### 1. `apps/chat/src/lib/auth-client.ts` (REESCREVER)

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

export class ApiError extends Error {
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
```

#### 2. Remover dependência `better-auth`

```bash
npm uninstall better-auth --workspace=apps/chat
```

Remover qualquer import de `better-auth` em todo o app Chat.

#### 3. Route guard — `getSession()` nativo

```typescript
// Antes:
import { getSession } from "@/lib/auth-client";
const session = await getSession();
const user = session?.data?.user;

// Depois:
import { getSession } from "@/lib/auth-client";
const user = await getSession(); // retorna AuthUser | null diretamente
```

#### 4. Vite proxy (verificação)

Confirmar que `vite.config.ts` do Chat proxeia `/api` para o Backbone. Se já configurado, nenhuma mudança necessária.

#### Regras

- Funções standalone (não store Zustand) — manter o padrão existente do Chat
- `credentials: "include"` em todos os fetch
- `ApiError` com `retryAfter` para rate limit
- Anti-enumeração mantida (mesmas mensagens genéricas)

### Feature F-362: Chat login wizard 2 etapas

**Spec:** S-107 seções 3.2, 3.3

Reescrever a tela de login do Chat como wizard de 2 etapas, seguindo o padrão do Hub (PRP-24D).

#### 1. `apps/chat/src/routes/login.tsx` (REESCREVER)

Wizard de 2 etapas com Framer Motion (já instalado no Chat):

**Estrutura do wizard (igual ao Hub):**
- **Etapa 1** — Input de email/username → `/auth/identify`
- **Etapa 2** — Senha, OTP ou escolha (conforme `method`)
- Botão "Voltar" na etapa 2

**Diferenças em relação ao Hub:**
- Logo diferente (usa imagens SVG do Chat)
- Visual existente preservado (gradiente, card translúcido)
- Verificação de role de equipe (`admin`, `manager`, `attendant`) após login bem-sucedido
- `returnUrl` no search params para redirect após login
- Sem store Zustand — usa funções standalone de `auth-client.ts`

**Após login bem-sucedido:**
1. Verificar role via `getSession()`
2. Se role não é `admin`, `manager` ou `attendant` → logout + mensagem "Acesso restrito"
3. Se role válido → redirect para `returnUrl` ou home

#### 2. Componente OTP Input

Reutilizar o `OtpInput`. Opções:
- **Preferível:** mover `OtpInput` para `packages/ui` e importar como `@workspace/ui`
- **Alternativa:** copiar componente de `apps/hub/src/components/otp-input.tsx` para `apps/chat/src/components/otp-input.tsx`

Mesma spec do PRP-24D: 6 dígitos, auto-advance, backspace, paste, auto-submit, touch targets >= 44x44px.

#### 3. Reenvio OTP + Rate limit feedback

Mesmos padrões do Hub:
- "Reenviar código" com countdown de 60s
- Rate limit (429): desabilitar formulário com countdown

#### Regras

- Manter a estética visual existente do Chat (gradiente, card translúcido, logo SVG)
- Mesmas variantes Framer Motion do Hub (slide, 250ms easeInOut)
- Verificação de role de equipe mantida após login
- Não criar store Zustand — funções standalone são suficientes
- Interface em pt-BR
- `credentials: "include"` em todos os fetch

## Limites

- **NÃO** alterar endpoints de backend — já implementados nos PRPs 24A-C
- **NÃO** alterar o Hub — já implementado no PRP-24D
- **NÃO** alterar `packages/ui` se optar por copiar o OtpInput localmente
- **NÃO** alterar a estética visual do Chat — preservar gradiente, card e logo

## Validacao

- [ ] `better-auth` removido do `package.json` do Chat
- [ ] `auth-client.ts` reescrito com funções nativas (identify, loginWithPassword, loginWithOtp, etc.)
- [ ] Login do Chat é wizard de 2 etapas com transição Framer Motion
- [ ] OTP input funciona com auto-advance e auto-submit
- [ ] Reenvio OTP com countdown de 60s
- [ ] Rate limit (429) exibe feedback com countdown
- [ ] Verificação de role de equipe mantida após login
- [ ] `credentials: "include"` em todos os fetch
- [ ] Visual existente do Chat preservado (gradiente, card, logo)
- [ ] Route guard usa `getSession()` nativo
- [ ] `returnUrl` funciona para redirect
- [ ] Interface em pt-BR
- [ ] Build do Chat compila sem erros (`npm run build --workspace=apps/chat`)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-361 chat auth client migration | S-107 | D-011 |
| F-362 chat login wizard | S-107 | D-011 |
