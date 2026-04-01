# PRP-24D — Hub: Login Wizard 2 Etapas

Reescrever a tela de login do Hub como wizard de 2 etapas com Framer Motion, migrar auth store para cookie, criar componente OTP input e integrar feedback de rate limit.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- Login do Hub é formulário único: username + senha → `POST /auth/login` → token armazenado em localStorage
- Auth store Zustand com `persist` inclui `token` — vulnerável a XSS
- `lib/api.ts` injeta `Authorization: Bearer` em todas as chamadas
- Sem componente OTP input
- Sem tratamento de resposta 429 (rate limit)

### Estado desejado

- Login é wizard de 2 etapas: identificação → autenticação (senha, OTP ou escolha)
- Auth store sem `token` — cookie HttpOnly é gerenciado pelo browser
- Componente OTP input com 6 dígitos, auto-advance, paste, auto-submit
- Feedback de rate limit com countdown
- Transições Framer Motion entre etapas (slide, 250ms easeInOut)

### Dependencias

- **PRP-24A** — endpoint `/auth/identify`, rate limiting
- **PRP-24B** — endpoints `/auth/otp-verify`, `/auth/otp-send`
- **PRP-24C** — JWT via cookie (login retorna `{ success, user }` sem token)

## Especificacao

### Feature F-358: Auth store migration — remover localStorage token

**Spec:** S-106 seções 2.2, 2.3, 2.4

Reescrever o auth store para eliminar `token` do state e adaptar ao fluxo cookie.

#### 1. `apps/hub/src/lib/auth.ts` (REESCREVER)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  role: string;
  displayName: string;
}

export type AuthMethod = "password" | "otp" | "choice";

export interface IdentifyResult {
  method: AuthMethod;
  default?: "otp";
  phoneSuffix?: string;
}

interface AuthState {
  user: AuthUser | null;
  identify: (username: string) => Promise<IdentifyResult>;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  loginWithOtp: (username: string, code: string) => Promise<void>;
  resendOtp: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      identify: async (username) => {
        const res = await fetch("/api/v1/ai/auth/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body.error ?? "Erro desconhecido", body.retryAfter);
        }
        return res.json() as Promise<IdentifyResult>;
      },

      loginWithPassword: async (username, password) => {
        const res = await fetch("/api/v1/ai/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body.error ?? "Erro desconhecido", body.retryAfter);
        }
        const { user } = await res.json();
        set({ user });
      },

      loginWithOtp: async (username, code) => {
        const res = await fetch("/api/v1/ai/auth/otp-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, code }),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body.error ?? "Erro desconhecido", body.retryAfter);
        }
        const { user } = await res.json();
        set({ user });
      },

      resendOtp: async (username) => {
        const res = await fetch("/api/v1/ai/auth/otp-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(res.status, body.error ?? "Erro desconhecido", body.retryAfter);
        }
      },

      logout: async () => {
        await fetch("/api/v1/ai/auth/logout", {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
        set({ user: null });
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      },

      checkAuth: async () => {
        const res = await fetch("/api/v1/ai/auth/me", {
          credentials: "include",
        });
        if (res.ok) {
          const me = await res.json();
          set({ user: { id: me.user, role: me.role, displayName: me.displayName } });
          return true;
        }
        set({ user: null });
        return false;
      },
    }),
    {
      name: "ab-hub-auth",
      partialize: (state) => ({ user: state.user }), // SEM token
    },
  ),
);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
```

**Mudanças-chave:**
- Removido `token` do state e do `partialize`
- `credentials: "include"` em todos os fetch
- `login` dividido em `identify` + `loginWithPassword` + `loginWithOtp`
- `logout` chama `POST /auth/logout`
- `ApiError` com campo `retryAfter` para rate limit

#### 2. `apps/hub/src/lib/api.ts` — credentials: include

Atualizar o wrapper de fetch para incluir `credentials: "include"`. Remover injeção de `Authorization: Bearer` para chamadas que usam cookie.

#### 3. Route guard — `checkAuth()` via `/auth/me`

```typescript
// Antes:
if (!token) redirect("/login");

// Depois:
const isAuthenticated = await checkAuth();
if (!isAuthenticated) redirect("/login");
```

#### Regras

- O store `persist` mantém apenas `user` (info de display) — SEM token
- `credentials: "include"` é obrigatório em todos os fetch
- `checkAuth()` é a forma canônica de verificar autenticação

### Feature F-359: Componente OTP input

**Spec:** S-106 seção 2.5

Input de 6 dígitos com auto-advance, backspace, paste e auto-submit.

#### 1. Novo arquivo: `apps/hub/src/components/otp-input.tsx`

```typescript
import { useRef, useCallback, type ClipboardEvent, type KeyboardEvent, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export function OtpInput({ length = 6, onComplete, disabled }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback((index: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!/^\d$/.test(value)) {
      e.target.value = "";
      return;
    }
    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
    const code = inputsRef.current.map((el) => el?.value ?? "").join("");
    if (code.length === length) {
      onComplete(code);
    }
  }, [length, onComplete]);

  const handleKeyDown = useCallback((index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    pasted.split("").forEach((char, i) => {
      if (inputsRef.current[i]) {
        inputsRef.current[i]!.value = char;
      }
    });
    const nextIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[nextIndex]?.focus();
    if (pasted.length === length) {
      onComplete(pasted);
    }
  }, [length, onComplete]);

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }, (_, i) => (
        <Input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          className="w-12 h-14 text-center text-lg font-mono"
          style={{ minWidth: 44, minHeight: 44 }}
          disabled={disabled}
          aria-label={`Dígito ${i + 1} de ${length}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
        />
      ))}
    </div>
  );
}
```

#### Regras

- Cada dígito é um `<Input>` separado com `maxLength={1}`
- Auto-advance: ao digitar, move foco para o próximo
- Backspace: ao apagar campo vazio, volta ao anterior
- Paste: suporta colar 6 dígitos de uma vez
- Auto-submit: ao completar 6 dígitos, chama `onComplete`
- Touch targets >= 44x44px
- Aceita apenas dígitos numéricos
- `aria-label` para acessibilidade

### Feature F-360: Login wizard 2 etapas com Framer Motion

**Spec:** S-106 seções 2.1, 2.6, 2.7, 2.8

Reescrever a tela de login como wizard com transições animadas.

#### 1. Dependência: instalar `framer-motion`

```bash
npm install framer-motion --workspace=apps/hub
```

#### 2. `apps/hub/src/routes/login.tsx` (REESCREVER)

Wizard de 2 etapas com `AnimatePresence mode="wait"`:

**Estrutura do wizard:**
- **Etapa 1 — Identificação:** Input de email/username + botão "Continuar". Chama `identify()`.
- **Etapa 2 — Autenticação:** Varia conforme `method`:
  - `"password"` → input de senha + toggle visibilidade + botão "Entrar"
  - `"otp"` → `OtpInput` (6 dígitos) + botão "Verificar" + "Reenviar código (countdown)"
  - `"choice"` → dois botões: "Código WhatsApp" (default) e "Senha"
- Botão "Voltar" na etapa 2

**Variantes Framer Motion:**

```typescript
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -30 : 30,
    opacity: 0,
  }),
};

const transition = { duration: 0.25, ease: "easeInOut" };
```

**Reenvio OTP com countdown:**
- Botão "Reenviar código" desabilitado por 60 segundos após envio
- Countdown visível: `Reenviar código (0:45)`
- Ao acionar, chama `resendOtp()` e reseta o timer e o OTP input

**Feedback de rate limit (429):**
- Ao receber 429 de qualquer chamada de auth:
  - Exibir "Muitas tentativas. Tente novamente em X:XX."
  - Desabilitar todos os inputs e botões
  - Countdown automático — ao chegar em 0, reabilitar

#### Layout e UX (conceito validado no TASK.md)

- **Logo + título** no topo do card
- **Inputs e ações** na metade inferior (thumb zone)
- **Um foco por etapa** — sem campos desnecessários
- Transições slide horizontal, 250ms easeInOut
- Touch targets mínimo 44x44px em inputs e botões
- Toggle de visibilidade na senha (ícone olho)
- Card centralizado (`max-w-sm`, centralizado vertical e horizontalmente)
- Interface em pt-BR

#### Regras

- Usar shadcn components (Button, Input, Card) — não criar HTML customizado
- Framer Motion apenas para transições de etapa — não sobrecarregar com micro-animações
- `credentials: "include"` em todos os fetch
- Não armazenar `token` em nenhum lugar
- `checkAuth()` via `/auth/me` para verificar autenticação no route guard

## Limites

- **NÃO** alterar endpoints de backend — isso é PRP-24A, 24B, 24C
- **NÃO** alterar o app Chat — isso é PRP-24E
- **NÃO** mover `OtpInput` para `packages/ui` neste PRP — o PRP-24E decidirá se copia ou compartilha
- **NÃO** adicionar micro-animações em cada input/botão — apenas transição entre etapas

## Validacao

- [ ] Login é wizard de 2 etapas com transição slide (Framer Motion)
- [ ] Etapa 1: input de email/slug → chama `/auth/identify`
- [ ] Etapa 2 varia por método: senha, OTP (6 dígitos), ou escolha
- [ ] OtpInput com auto-advance, backspace, paste e auto-submit ao completar
- [ ] Botão "Reenviar código" com countdown de 60s
- [ ] `token` removido do localStorage e do Zustand state
- [ ] `credentials: "include"` em todos os fetch de auth e no wrapper de API
- [ ] Logout chama `POST /auth/logout`
- [ ] Rate limit (429) desabilita formulário com countdown
- [ ] Transições 250ms easeInOut entre etapas
- [ ] Touch targets >= 44x44px
- [ ] Route guard usa `checkAuth()` em vez de verificar token
- [ ] Interface em pt-BR
- [ ] Build compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-358 auth store migration | S-106 | D-009 |
| F-359 OTP input component | S-106 | D-010 |
| F-360 login wizard 2 etapas | S-106 | D-008, D-012, D-013 |
