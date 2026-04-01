# S-106 — Hub: Login Wizard 2 Etapas com OTP, Cookie Auth e Framer Motion

Reescrever a tela de login do Hub como wizard de 2 etapas, eliminar localStorage, adicionar componente OTP, reenvio com countdown e feedback de rate limit.

**Resolve:** D-008 (Hub login wizard), D-009 (eliminar localStorage), D-010 (OTP input), D-012 (reenvio OTP countdown), D-013 (feedback rate limit UI)
**Score de prioridade:** 7
**Dependência:** S-100 (endpoint /auth/identify), S-105 (JWT cookie — login retorna user no body sem token)
**PRP:** 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

---

## 1. Objetivo

Substituir o formulário de login de etapa única por um wizard de 2 etapas:
- **Etapa 1:** Identificação (email ou slug) → chama `/auth/identify`
- **Etapa 2:** Autenticação (senha, OTP 6 dígitos, ou escolha de método)

Simultaneamente: eliminar `token` do localStorage (cookie HttpOnly é gerenciado pelo browser), criar componente OTP input com auto-advance e integrar feedback de rate limit (429).

---

## 2. Alterações

### 2.1 Dependência: instalar `framer-motion`

```bash
npm install framer-motion --workspace=apps/hub
```

### 2.2 Arquivo: `apps/hub/src/lib/auth.ts` (REESCREVER)

Remover `token` do state e do `persist`. O cookie é enviado automaticamente pelo browser — o frontend não precisa armazená-lo.

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

  /** Etapa 1: identifica o user e retorna o método de auth */
  identify: (username: string) => Promise<IdentifyResult>;

  /** Etapa 2a: login com senha */
  loginWithPassword: (username: string, password: string) => Promise<void>;

  /** Etapa 2b: login com OTP */
  loginWithOtp: (username: string, code: string) => Promise<void>;

  /** Reenviar OTP */
  resendOtp: (username: string) => Promise<void>;

  /** Logout */
  logout: () => Promise<void>;

  /** Checar se está autenticado (via /auth/me) */
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

/** Erro de API com suporte a retryAfter (rate limit) */
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
- Adicionado `credentials: "include"` em todos os fetch (para enviar/receber cookie)
- `login` dividido em `identify` + `loginWithPassword` + `loginWithOtp`
- `logout` chama `POST /auth/logout` (apaga cookie no server)
- `checkAuth` verifica se o cookie é válido via `/auth/me`
- `ApiError` com campo `retryAfter` para rate limit

### 2.3 Arquivo: `apps/hub/src/lib/api.ts` — credentials: include

Atualizar o wrapper de fetch para incluir `credentials: "include"` em todas as chamadas. Remover a injeção de `Authorization: Bearer` para chamadas que usam cookie.

```typescript
// Se existir um wrapper fetch centralizado, adicionar:
credentials: "include",
// E remover:
// headers: { Authorization: `Bearer ${token}` },
```

### 2.4 Arquivo: `apps/hub/src/router/index.tsx` (ou equivalente) — Route guard

Atualizar o guard de autenticação para usar `checkAuth()` em vez de verificar `token`:

```typescript
// Antes:
if (!token) redirect("/login");

// Depois:
const isAuthenticated = await checkAuth();
if (!isAuthenticated) redirect("/login");
```

### 2.5 Novo componente: `apps/hub/src/components/otp-input.tsx`

Input de 6 dígitos com auto-advance, backspace e paste:

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

    // Avançar para próximo
    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    // Checar se todos preenchidos → auto-submit
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
    // Focar no último preenchido ou no próximo vazio
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
          style={{ minWidth: 44, minHeight: 44 }} // touch target
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

### 2.6 Arquivo: `apps/hub/src/routes/login.tsx` (REESCREVER)

Wizard de 2 etapas com Framer Motion:

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { OtpInput } from "@/components/otp-input";
import { useAuthStore, ApiError, type AuthMethod, type IdentifyResult } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// --- Variantes Framer Motion ---
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

function LoginPage() {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuthStore();

  // State do wizard
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState(1); // 1 = avançar, -1 = voltar
  const [username, setUsername] = useState("");
  const [identifyResult, setIdentifyResult] = useState<IdentifyResult | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"password" | "otp" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Redirect se já autenticado
  useEffect(() => {
    if (user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  // Countdown do rate limit
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  // Handler de erro com suporte a rate limit
  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 429 && err.retryAfter) {
        setRateLimitSeconds(err.retryAfter);
        setError(`Muitas tentativas. Tente novamente em ${formatTime(err.retryAfter)}.`);
        return;
      }
      setError(err.message);
    } else {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }, []);

  const isRateLimited = rateLimitSeconds > 0;

  // --- Etapa 1: Identificação ---
  async function handleIdentify(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || isRateLimited) return;

    setError("");
    setLoading(true);
    try {
      const result = await useAuthStore.getState().identify(username);
      setIdentifyResult(result);

      if (result.method === "choice") {
        setSelectedMethod(null); // user escolhe
      } else {
        setSelectedMethod(result.method);
      }

      setDirection(1);
      setStep(2);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  // --- Voltar para etapa 1 ---
  function handleBack() {
    setDirection(-1);
    setStep(1);
    setIdentifyResult(null);
    setSelectedMethod(null);
    setError("");
  }

  // --- Etapa 2a: Senha ---
  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (isRateLimited) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const password = formData.get("password") as string;
    if (!password) return;

    setError("");
    setLoading(true);
    try {
      await useAuthStore.getState().loginWithPassword(username, password);
      navigate({ to: "/" });
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  // --- Etapa 2b: OTP ---
  async function handleOtpComplete(code: string) {
    if (isRateLimited) return;

    setError("");
    setLoading(true);
    try {
      await useAuthStore.getState().loginWithOtp(username, code);
      navigate({ to: "/" });
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  // --- Escolha de método ---
  async function handleChooseOtp() {
    setSelectedMethod("otp");
    // Enviar OTP ao escolher
    try {
      await useAuthStore.getState().resendOtp(username);
    } catch (err) {
      handleError(err);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          {/* Logo */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold">Agentic Backbone</h1>
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transition}
              >
                <StepIdentify ... />
              </motion.div>
            )}

            {step === 2 && identifyResult && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transition}
              >
                <StepAuth
                  username={username}
                  method={identifyResult.method}
                  selectedMethod={selectedMethod}
                  phoneSuffix={identifyResult.phoneSuffix}
                  onBack={handleBack}
                  onPasswordSubmit={handlePasswordSubmit}
                  onOtpComplete={handleOtpComplete}
                  onChooseOtp={handleChooseOtp}
                  onChoosePassword={() => setSelectedMethod("password")}
                  onResendOtp={...}
                  error={error}
                  loading={loading}
                  rateLimitSeconds={rateLimitSeconds}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
```

**Subcomponentes internos** (podem ser definidos no mesmo arquivo ou extraídos):

- **StepIdentify** — Input de email/username + botão "Continuar"
- **StepAuth** — Renderiza conforme `method`:
  - `"password"` → input de senha + botão "Entrar"
  - `"otp"` → OtpInput + botão "Verificar" + "Reenviar código (countdown)"
  - `"choice"` → dois botões (WhatsApp OTP / Senha)
- Botão "Voltar" na etapa 2
- Feedback de rate limit: formulário desabilitado + countdown

### 2.7 Reenvio OTP com countdown

Na etapa OTP, exibir botão "Reenviar código" com countdown de 60 segundos:

```typescript
const [resendCooldown, setResendCooldown] = useState(60);

useEffect(() => {
  if (resendCooldown <= 0) return;
  const timer = setInterval(() => setResendCooldown((s) => s - 1), 1000);
  return () => clearInterval(timer);
}, [resendCooldown]);

async function handleResend() {
  await useAuthStore.getState().resendOtp(username);
  setResendCooldown(60);
  // Limpar OTP input
}

// No JSX:
<button disabled={resendCooldown > 0} onClick={handleResend}>
  {resendCooldown > 0
    ? `Reenviar código (0:${String(resendCooldown).padStart(2, "0")})`
    : "Reenviar código"
  }
</button>
```

### 2.8 Feedback de rate limit (429)

Quando qualquer chamada de auth retorna 429:
- Exibir mensagem "Muitas tentativas. Tente novamente em X:XX."
- Desabilitar todos os inputs e botões do formulário
- Countdown automático — ao chegar em 0, reabilitar

---

## 3. Layout e UX

Seguir o conceito de tela validado no TASK.md:
- **Logo + título** no topo
- **Inputs e ações** na metade inferior (thumb zone)
- **Um foco por etapa** — sem campos desnecessários
- **Transições:** slide horizontal com `AnimatePresence mode="wait"`, 250ms easeInOut
- **OTP auto-advance:** ao preencher 6 dígitos, submeter automaticamente
- **Touch targets:** mínimo 44x44px em inputs e botões (via min-width/min-height)
- **Toggle de visibilidade** na senha (ícone olho)

---

## 4. Regras de Implementação

- Usar shadcn components (Button, Input, Card) — não criar HTML customizado
- Framer Motion apenas para transições de etapa — não sobrecarregar com micro-animações
- `credentials: "include"` em todos os fetch — necessário para cookies cross-origin
- Não armazenar `token` em nenhum lugar (localStorage, state, etc.)
- O store `persist` mantém apenas `user` (info de display para UI)
- `checkAuth()` via `/auth/me` é a forma canônica de verificar se está autenticado
- Interface em pt-BR

---

## 5. Critérios de Aceite

- [ ] Login é wizard de 2 etapas com transição slide (Framer Motion)
- [ ] Etapa 1: input de email/slug → chama `/auth/identify`
- [ ] Etapa 2 varia por método: senha, OTP (6 dígitos), ou escolha
- [ ] OtpInput com auto-advance, backspace, paste e auto-submit ao completar
- [ ] Botão "Reenviar código" com countdown de 60s
- [ ] `token` removido do localStorage e do Zustand state
- [ ] `credentials: "include"` em todos os fetch de auth
- [ ] Logout chama `POST /auth/logout`
- [ ] Rate limit (429) desabilita formulário com countdown
- [ ] Transições 250ms easeInOut entre etapas
- [ ] Touch targets >= 44x44px
- [ ] Build compila sem erros
