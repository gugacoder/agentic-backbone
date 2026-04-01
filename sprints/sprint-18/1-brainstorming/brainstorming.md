# Brainstorming — Sprint 18
## PRP 24: Secure Login — Wizard + OTP via WhatsApp + Rate Limiting

---

## Contexto

O PRP 24 migra o sistema de autenticação de um login de etapa única (username + senha → JWT no body) para um fluxo seguro em 2 etapas com suporte a OTP via WhatsApp, rate limiting e entrega de JWT via HTTP-only cookie.

**Estado atual identificado no código:**
- `routes/auth.ts` — endpoint único `POST /auth/login`, JWT retornado no body (`c.json({ token })`)
- `users/password.ts` — verificação via `timingSafeEqual` (comparação de strings, sem hash)
- `users/types.ts` — `UserConfig` não possui campo `auth` (sem indicação de método suportado)
- `users/manager.ts` — leitura de `credential.yml`, sem suporte a OTP
- `hub/src/lib/auth.ts` — store Zustand com `persist`, armazena `token` em localStorage
- `hub/src/routes/login.tsx` — formulário único com username + senha
- `chat/src/lib/auth-client.ts` — usa `better-auth` (biblioteca externa, independente do backbone)
- `routes/index.ts` — middleware JWT via `Authorization: Bearer` ou `?token=`, sem rate limiting

**Gaps de segurança evidentes:**
- Sem bcrypt: senha em plaintext encriptado (reversível com `ENCRYPTION_KEY`)
- Sem rate limiting: brute-force viável em `/auth/login`
- JWT em localStorage: XSS pode extrair o token
- Todos os users têm login (incluindo users de sistema que não deveriam)
- Sem 2FA/OTP

---

## Funcionalidades Mapeadas (já implementadas)

| Funcionalidade | Arquivo | Status |
|---|---|---|
| Login etapa única (user + senha) | `routes/auth.ts` | ✅ Implementado |
| JWT gerado e retornado no body | `routes/auth.ts` | ✅ Implementado |
| Verificação de senha por `timingSafeEqual` | `users/password.ts` | ✅ Implementado (inseguro) |
| `UserConfig` com `phoneNumber` | `users/types.ts` | ✅ Implementado |
| `GET /auth/me` protegido | `routes/auth.ts` | ✅ Implementado |
| Middleware JWT (Bearer + query param) | `routes/index.ts` | ✅ Implementado |
| Login form no Hub (single-step) | `hub/src/routes/login.tsx` | ✅ Implementado |
| Auth store Zustand (localStorage) | `hub/src/lib/auth.ts` | ✅ Implementado |

---

## Lacunas e Oportunidades

### Backend

1. **Endpoint `/auth/identify` ausente** — a etapa 1 do wizard (identificação) não existe. É o ponto de entrada do novo fluxo e determina o método de autenticação do user.

2. **bcrypt não está implementado** — `verifyPassword` compara strings diretamente. Senhas em `credential.yml` são encriptadas (AES-256-GCM) mas reversíveis. Precisa migrar para bcrypt com detecção do formato antigo.

3. **Rate limiting ausente** — nenhum middleware de limite de tentativas. Os endpoints `/auth/identify`, `/auth/login`, `/auth/otp-verify` são vetores de brute-force.

4. **OTP não existe** — sem módulo de envio via Evolution (WhatsApp), sem geração/validação de código, sem configuração `otp` em `settings.yml`.

5. **Campo `auth` ausente no UserConfig** — não há como saber se um user suporta OTP, senha ou nenhum dos dois. Sistema de sistema (ex: pneusos) não deveria ter login.

6. **JWT entregue no body** — deve ser via `Set-Cookie: HttpOnly; Secure; SameSite=Strict`. Middleware de auth atual não lê cookie.

7. **Endpoint `/auth/otp-verify` ausente** — validação do código OTP de 6 dígitos não existe.

8. **Módulo `settings/otp.ts` ausente** — sem leitura da config `otp.enabled` + `otp.evolution.*` de `settings.yml`.

### Frontend (Hub)

9. **Login wizard não implementado** — a tela atual é um formulário único. Precisa virar um wizard de 2 etapas com AnimatePresence do Framer Motion.

10. **localStorage deve ser eliminado** — o store Zustand persiste o token em localStorage. Com cookie HttpOnly, o frontend não precisa mais armazenar o token.

11. **Componente OTP input ausente** — input de 6 dígitos com auto-advance não existe em nenhum package.

12. **Tela de escolha de método ausente** — quando `method === "choice"`, o frontend exibe botões para escolher entre OTP e senha.

13. **Feedback de rate limit ausente** — UI não trata resposta 429 com mensagem "Tente novamente em X minutos".

### Frontend (Chat)

14. **Chat usa `better-auth`** — `auth-client.ts` usa biblioteca externa (`better-auth/react`), divergindo do padrão do backbone. O novo fluxo de login deve ser alinhado ao backbone.

---

## Priorização

### Score 10 — Crítico / Desbloqueador

- **D-001** — Endpoint `/auth/identify` + campo `auth` no UserConfig  
  Desbloqueador de todo o fluxo. Sem esse endpoint, a etapa 1 não existe e o método de auth não pode ser determinado. Inclui adicionar `auth: { otp, password }` a `UserConfig` e `USER.md`.

### Score 9 — Alta Prioridade / Segurança

- **D-002** — bcrypt migration para `users/password.ts`  
  Segurança crítica. Comparação direta é insegura. Migrar `verifyPassword` para bcrypt com detecção de formato antigo (plaintext encriptado vs. hash bcrypt).

- **D-003** — Rate limiting middleware (5 req / 15 min por IP)  
  Elimina vetor de brute-force. Aplicar em `/auth/identify`, `/auth/login`, `/auth/otp-verify`. Implementação in-memory (Map com TTL) é suficiente para o escopo.

### Score 8 — Importante / Entrega de Valor

- **D-004** — Módulo `settings/otp.ts` + configuração em `settings.yml`  
  Pré-requisito para D-005. Lê `otp.enabled` e `otp.evolution.*`. Sem ele, o sistema não sabe se OTP está habilitado.

- **D-005** — Integração Evolution para envio de OTP via WhatsApp  
  Envia código de 6 dígitos para o `phoneNumber` do user. Disparado em `/auth/identify` quando `auth.otp === true`. Depende de D-004.

- **D-006** — Endpoint `/auth/otp-verify` + validação do código  
  Valida o código OTP (TTL 5-10 min, armazenado in-memory ou Redis). Retorna JWT via cookie. Depende de D-005.

- **D-007** — JWT via HTTP-only cookie + middleware cookie-first  
  Login bem-sucedido responde com `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`. Middleware de auth passa a checar cookie primeiro, depois header Bearer, depois `?token=`. Backward-compatible com API keys.

### Score 7 — Relevante / Frontend

- **D-008** — Hub: login wizard 2 etapas com Framer Motion  
  Substitui o formulário único. Etapa 1: identificação. Etapa 2: senha, OTP ou escolha (conforme retorno de `/auth/identify`). Transições slide com `AnimatePresence mode="wait"`, 250ms easeInOut.

- **D-009** — Hub: eliminar localStorage + adaptar auth store ao cookie  
  Remove `persist` com `token` do Zustand. Frontend passa a confiar no cookie (enviado automaticamente pelo browser). Store mantém apenas `user` (info de display).

### Score 6 — Complementar

- **D-010** — Componente OTP input (6 dígitos, auto-advance)  
  Input que avança automaticamente entre campos ao digitar. Auto-submit ao completar 6 dígitos. Acessível (aria-label, paste support). Pode ir em `packages/ui` ou componente local no hub.

- **D-011** — Chat: login wizard alinhado ao backbone  
  Migrar `chat/src/lib/auth-client.ts` de `better-auth` para o novo fluxo do backbone. Aplicar o mesmo wizard de 2 etapas.

### Score 5 — Nice-to-have

- **D-012** — Reenvio OTP com countdown (45-60s)  
  Botão "Reenviar código" desabilitado durante contagem regressiva. Ativa nova chamada a `/auth/identify` para reenviar. UX conforme conceito de tela validado.

- **D-013** — Feedback de rate limit na UI  
  Captura resposta 429 e exibe "Muitas tentativas. Tente novamente em X minutos". Desabilita formulário durante o período de bloqueio.

---

### Ordem lógica de implementação

```
D-001 (identify + UserConfig auth)
  └─ D-003 (rate limiting) — paralelo
  └─ D-002 (bcrypt) — paralelo
  └─ D-004 (settings/otp.ts)
       └─ D-005 (Evolution OTP send)
            └─ D-006 (otp-verify endpoint)
  └─ D-007 (cookie JWT + middleware)
       └─ D-008 (hub wizard frontend)
            └─ D-009 (eliminar localStorage)
            └─ D-010 (OTP input component)
                 └─ D-011 (chat wizard)
                 └─ D-012 (reenvio OTP)
                 └─ D-013 (rate limit UI feedback)
```
