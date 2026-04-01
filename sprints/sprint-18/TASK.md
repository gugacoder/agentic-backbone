# PRP 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

Login em 2 etapas com suporte a OTP via WhatsApp (Evolution), rate limiting e JWT via HTTP-only cookie.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

- Login em etapa unica: POST /auth/login com username + password
- JWT retornado no body, frontend armazena manualmente (localStorage)
- Sem rate limiting — brute-force viavel
- Senhas encriptadas em disco (AES-256-GCM) mas nao hasheadas — reversiveis com ENCRYPTION_KEY
- Sem 2FA/OTP
- Todos os users tem login, mesmo users de sistema (ex: pneusos)

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Fluxo | 1 etapa (user + senha) | 2 etapas wizard (identificacao → autenticacao) |
| Metodos de auth | Apenas senha | Senha, OTP (WhatsApp), ou escolha |
| OTP | Nao existe | Via Evolution (WhatsApp) |
| Rate limiting | Nenhum | 5 tentativas / 15 min por IP |
| JWT delivery | Body (localStorage) | HTTP-only cookie (Secure, SameSite=Strict) |
| Hash de senha | Encriptacao reversivel | bcrypt/argon2 |
| Login por user | Todos | Apenas users com auth configurado |

---

## Fluxo

### Etapa 1 — Identificacao

User digita email ou slug e avanca (enter).

```
POST /auth/identify
{ "username": "guga.coder@gmail.com" }
```

Backend valida o user e retorna o metodo de autenticacao:

- `{ method: "otp" }` — tem phoneNumber + OTP habilitado. Backend ja enviou o codigo.
- `{ method: "password" }` — so senha.
- `{ method: "choice", default: "otp" }` — tem os dois, user escolhe.
- User sem auth (ex: pneusos) → 401.
- User inexistente → 401 (mesma mensagem, sem enumeracao).

### Etapa 2 — Autenticacao

Conforme o metodo retornado:

- **otp**: input de 6 digitos. Codigo ja foi enviado por WhatsApp no identify.
  ```
  POST /auth/otp-verify
  { "username": "guga.coder@gmail.com", "code": "482916" }
  ```
- **password**: input de senha.
  ```
  POST /auth/login
  { "username": "guga.coder@gmail.com", "password": "..." }
  ```
- **choice**: frontend mostra opcoes (OTP como default). User escolhe, depois preenche.

Resposta de sucesso: JWT via `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`.

---

## Config OTP — Evolution Instance

Nova secao em `context/settings.yml`:

```yaml
otp:
  enabled: true
  evolution:
    host: https://evo.example.com
    api-key: ${EVOLUTION_OTP_API_KEY}
    instance: otp-instance
```

- `otp.enabled: false` → login funciona so com senha (dev local, fallback).
- Campos sensiveis (`api-key`) auto-encriptados pelo sistema existente.

---

## Atributos do User

No USER.md de cada usuario:

```yaml
auth:
  otp: true        # suporta OTP, requer phoneNumber preenchido
  password: true   # suporta senha, requer credential.yml
```

- Sem nenhum dos dois → user nao tem login (ex: pneusos, users de sistema).
- `phoneNumber` ja existe em UserConfig — usado para envio do OTP.

---

## Rate Limiting

- 5 tentativas por IP a cada 15 min nos endpoints de auth.
- Applies a: /auth/identify, /auth/login, /auth/otp-verify.
- Implementar via middleware no Hono (in-memory ou Redis).

---

## Hash de Senha

- Migrar de comparacao direta (verifyPassword) para bcrypt com cost >= 12.
- Senhas existentes em credential.yml precisam ser re-hasheadas (migration one-time).
- Compatibilidade: detectar formato antigo (plaintext encriptado) vs novo (hash bcrypt).

---

## JWT via HTTP-only Cookie

- Login retorna JWT via Set-Cookie em vez de body.
- Flags: HttpOnly, Secure, SameSite=Strict, Path=/api.
- Frontend deixa de armazenar token em localStorage.
- Manter fallback Authorization: Bearer para API keys (sk_...) e uso programatico.
- Middleware de auth: checar cookie primeiro, depois header, depois query param.

---

## Arquivos impactados

### Backend (apps/backbone/src/)
- `routes/auth.ts` — novo endpoint /auth/identify, /auth/otp-verify, cookie no login
- `users/password.ts` — migrar para bcrypt
- `users/types.ts` — auth config no UserConfig
- `users/manager.ts` — leitura do auth config
- `routes/index.ts` — middleware rate limiting + leitura de cookie
- `settings/` — novo modulo otp.ts para ler config da Evolution OTP

### Frontend (apps/hub/ e apps/chat/)
- Tela de login — wizard 2 etapas
- Auth client — deixar de usar localStorage, confiar no cookie

---

## Referências UX

Guias para criar uma experiência estado da arte no wizard de login:

- **`guides/ux/framer-motion.md`** — Animações e transições. Usar para:
  - Transição entre etapas do wizard (slide/fade com `AnimatePresence mode="wait"`)
  - Stagger nos inputs ao aparecer
  - Spring configs para botões (whileHover/whileTap)
  - Timing: 200-300ms para transição entre etapas, 100-200ms para micro-interações

- **`guides/ux/mobile-patterns.md`** — Padrões mobile-first. Usar para:
  - Touch targets mínimos de 44x44px nos botões e inputs
  - Thumb zone: ações principais na parte inferior da tela
  - Feedback tátil (haptic) ao enviar OTP e confirmar login
  - Breakpoints mobile-first (Drawer em mobile, Dialog em desktop se necessário)

- **`guides/ux/shadcn-v4/`** — Projeto de referência shadcn v4. Usar para:
  - Componentes base (Input, Button, Card) com tokens CSS corretos
  - Padrões de theming e variáveis de design atualizados

---

## Conceito de Tela (validado)

### Etapa 1 — Identificação

```
┌─────────────────────────────┐
│                             │
│                             │
│         ┌───────┐           │
│         │ LOGO  │           │
│         └───────┘           │
│                             │
│      Entrar no sistema      │
│                             │
│  ┌─────────────────────┐    │
│  │ Email ou usuário     │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │     Continuar    →   │    │
│  └─────────────────────┘    │
│                             │
│                             │
│                             │
│                             │
│                             │
└─────────────────────────────┘
```

### Etapa 2a — Senha (`method: "password"`)

```
┌─────────────────────────────┐
│                             │
│  ← Voltar                   │
│                             │
│         ┌───────┐           │
│         │ LOGO  │           │
│         └───────┘           │
│                             │
│      guga.coder@gmail.com   │
│                             │
│  ┌─────────────────────┐    │
│  │ Senha            👁  │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │       Entrar     →   │    │
│  └─────────────────────┘    │
│                             │
│                             │
│                             │
│                             │
│                             │
└─────────────────────────────┘
```

### Etapa 2b — OTP (`method: "otp"`)

```
┌─────────────────────────────┐
│                             │
│  ← Voltar                   │
│                             │
│         ┌───────┐           │
│         │ LOGO  │           │
│         └───────┘           │
│                             │
│   Código enviado para       │
│   WhatsApp (•••61)          │
│                             │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
│   │  │ │  │ │  │ │  │ │  │ │  │  │
│   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘  │
│                             │
│  ┌─────────────────────┐    │
│  │     Verificar    →   │    │
│  └─────────────────────┘    │
│                             │
│   Reenviar código (0:45)    │
│                             │
│                             │
└─────────────────────────────┘
```

### Etapa 2c — Escolha (`method: "choice"`)

```
┌─────────────────────────────┐
│                             │
│  ← Voltar                   │
│                             │
│         ┌───────┐           │
│         │ LOGO  │           │
│         └───────┘           │
│                             │
│      guga.coder@gmail.com   │
│                             │
│   Como deseja entrar?       │
│                             │
│  ┌─────────────────────┐    │
│  │ 💬  Código WhatsApp  │    │
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │ 🔒  Senha            │    │
│  └─────────────────────┘    │
│                             │
│                             │
│                             │
└─────────────────────────────┘
```

### Transições (Framer Motion)

```
Etapa 1 ──slide left──→ Etapa 2
Etapa 2 ──slide right──→ Etapa 1 (voltar)

AnimatePresence mode="wait"
  enter:  { opacity: 0, x: +30 } → { opacity: 1, x: 0 }
  exit:   { opacity: 0, x: -30 }
  voltar: direção invertida
  timing: 250ms easeInOut
```

### Notas de UX

- Inputs e botões na metade inferior — thumb zone friendly
- Logo + contexto em cima, ações embaixo — hierarquia clara
- Um foco por etapa — sem campos desnecessários
- OTP auto-advance — ao preencher 6 dígitos, submete automaticamente
- Rate limit feedback — após 5 tentativas: "Tente novamente em X minutos"
