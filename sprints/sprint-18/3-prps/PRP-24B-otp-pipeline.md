# PRP-24B — OTP Pipeline: Config + Sender + Verify

Implementar o pipeline completo de OTP: configuração da Evolution API, módulo de geração/envio/validação de códigos via WhatsApp, endpoint de verificação e integração com `/auth/identify`.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- Nenhum módulo OTP existe no projeto
- Nenhuma configuração de Evolution para OTP em `settings.yml`
- `/auth/identify` (PRP-24A) retorna `method: "otp"` mas tem `TODO` para envio real
- Não existe endpoint `/auth/otp-verify` nem `/auth/otp-send`

### Estado desejado

- Seção `otp` em `settings.yml` com config da Evolution API (`enabled`, `host`, `api-key`, `instance`)
- Módulo `otp/sender.ts` gera código de 6 dígitos, envia via WhatsApp (Evolution API), valida com TTL
- `/auth/identify` envia OTP automaticamente quando `method === "otp"`
- `/auth/otp-verify` valida código e autentica o user
- `/auth/otp-send` permite reenvio de código

### Dependencias

- **PRP-24A** — campo `auth` no UserConfig + endpoint `/auth/identify` + rate limiting middleware

## Especificacao

### Feature F-353: Módulo OTP — config + sender + store

**Spec:** S-103 seções 2.1, 2.2, 2.3

Criar os módulos de configuração e envio de OTP.

#### 1. `context/settings.yml` — Nova seção `otp`

```yaml
otp:
  enabled: false
  evolution:
    host: https://evo.example.com
    api-key: ${EVOLUTION_OTP_API_KEY}
    instance: otp-instance
```

- `enabled: false` como padrão seguro — dev local funciona sem configuração
- `api-key` usa interpolação de env var, auto-encriptada pelo sistema existente

#### 2. Novo arquivo: `apps/backbone/src/settings/otp.ts`

```typescript
import { z } from "zod";

const OtpEvolutionSchema = z.object({
  host: z.string().url(),
  "api-key": z.string().min(1),
  instance: z.string().min(1),
});

const OtpConfigSchema = z.object({
  enabled: z.boolean(),
  evolution: OtpEvolutionSchema.optional(),
});

export type OtpConfig = z.infer<typeof OtpConfigSchema>;

export function getOtpConfig(): OtpConfig {
  // Ler seção 'otp' do settings.yml usando readYaml/getSettings existente
  // Se ausente, retornar { enabled: false }
  // Se presente, validar com OtpConfigSchema
  // Lançar erro se enabled: true mas evolution não configurado
}

export function isOtpEnabled(): boolean {
  const config = getOtpConfig();
  return config.enabled && !!config.evolution;
}
```

#### 3. Novo arquivo: `apps/backbone/src/otp/sender.ts`

```typescript
import { getOtpConfig } from "../settings/otp.js";

interface OtpEntry {
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutos
const OTP_LENGTH = 6;

// Limpar entradas expiradas a cada 2 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore) {
    if (entry.expiresAt <= now) {
      otpStore.delete(key);
    }
  }
}, 2 * 60 * 1000).unref();

function generateCode(): string {
  const { randomInt } = require("crypto");
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export async function sendOtp(username: string, phoneNumber: string): Promise<void> {
  const config = getOtpConfig();
  if (!config.enabled || !config.evolution) {
    throw new Error("OTP não está habilitado");
  }

  const code = generateCode();

  otpStore.set(username, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  const { host, "api-key": apiKey, instance } = config.evolution;
  const url = `${host}/message/sendText/${instance}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: phoneNumber,
      text: `Seu código de acesso: ${code}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Evolution API error ${response.status}: ${body}`);
  }
}

export function verifyOtp(username: string, code: string): boolean {
  const entry = otpStore.get(username);
  if (!entry) return false;

  if (entry.expiresAt <= Date.now()) {
    otpStore.delete(username);
    return false;
  }

  const { timingSafeEqual } = require("crypto");
  const a = Buffer.from(code, "utf-8");
  const b = Buffer.from(entry.code, "utf-8");
  if (a.length !== b.length) return false;

  const valid = timingSafeEqual(a, b);
  if (valid) {
    otpStore.delete(username); // One-time use
  }
  return valid;
}
```

#### Regras

- Código de 6 dígitos gerado com `crypto.randomInt` (CSPRNG)
- Store in-memory (`Map`) — sem dependência de banco ou Redis
- TTL de 10 minutos — após expirar, user precisa solicitar reenvio
- Código é **one-time use** — consumido na verificação bem-sucedida
- Comparação do código usa `timingSafeEqual` — previne timing attacks
- Erros da Evolution API são logados mas não expostos ao client

### Feature F-354: Integrar OTP no /auth/identify + endpoint /auth/otp-send

**Spec:** S-103 seções 2.4, 2.5

Conectar o envio real de OTP ao endpoint `/auth/identify` (substituindo o TODO do PRP-24A) e criar endpoint de reenvio.

#### 1. `apps/backbone/src/routes/auth.ts` — Integrar sendOtp no /auth/identify

```typescript
import { sendOtp } from "../otp/sender.js";
import { isOtpEnabled } from "../settings/otp.js";

// Dentro do handler de /auth/identify, substituir o TODO:
if (method === "otp" && isOtpEnabled()) {
  try {
    await sendOtp(resolved.slug, config.phoneNumber!);
  } catch (err) {
    console.error("Erro ao enviar OTP:", err);
    // Fallback: se tiver senha, usar senha; senão, 500
    if (hasPassword) {
      method = "password";
    } else {
      return c.json({ error: "Erro interno" }, 500);
    }
  }
}
```

**Fallback:** se OTP está habilitado no user mas o envio falha (Evolution fora do ar), e o user tem senha, fallback para `method: "password"`.

#### 2. Novo endpoint: `POST /auth/otp-send` (reenvio)

```typescript
app.post("/auth/otp-send", authRateLimit, async (c) => {
  const { username } = await c.req.json<{ username: string }>();

  const resolved = await getUserByEmail(username) ?? await getUserBySlug(username);
  if (!resolved || !resolved.config.auth?.otp || !resolved.config.phoneNumber) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  await sendOtp(resolved.slug, resolved.config.phoneNumber);
  return c.json({ sent: true });
});
```

#### 3. Rota pública

`/auth/otp-send` é público (sem JWT), protegido apenas pelo rate limiting.

#### Regras

- O `/auth/otp-send` está protegido pelo rate limiting (do PRP-24A)
- Anti-enumeração: mesma mensagem 401 para user inexistente e user sem OTP
- Se `otp.enabled: false` em settings e user tem `auth.otp: true`, tratar como sem OTP (fallback para senha se disponível)

### Feature F-355: Endpoint /auth/otp-verify

**Spec:** S-104

Criar endpoint que valida o código OTP e autentica o user.

#### 1. `apps/backbone/src/routes/auth.ts` — Novo endpoint

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

  // 4. Gerar JWT (usando helper compartilhado)
  const token = await createAuthToken(resolved.slug, resolved.config.role ?? "user");

  // 5. Responder (body temporário — PRP-24C migrará para cookie)
  return c.json({ token });
});
```

#### 2. Extrair `createAuthToken()` — helper compartilhado

A geração de JWT é duplicada entre `/auth/login` e `/auth/otp-verify`. Extrair para função auxiliar:

```typescript
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

#### 3. Rota pública

`/auth/otp-verify` é público (sem JWT), protegido apenas pelo rate limiting.

#### Regras

- Input validation: código deve ser exatamente 6 dígitos numéricos
- Código OTP é consumido na verificação (one-time use, garantido pelo sender)
- Rate limiting já aplicado (do PRP-24A)
- O endpoint retorna JWT no body temporariamente — PRP-24C migrará para cookie

## Limites

- **NÃO** alterar a entrega do JWT (cookie vs body) — isso é PRP-24C
- **NÃO** alterar o frontend — isso é PRP-24D e PRP-24E
- **NÃO** criar connectors Evolution adicionais — este módulo é standalone para OTP
- **NÃO** alterar a lógica do rate limiting — implementado no PRP-24A

## Validacao

- [ ] Seção `otp` adicionada ao `settings.yml` com `enabled: false`
- [ ] `getOtpConfig()` lê e valida a config de `settings.yml`
- [ ] `isOtpEnabled()` retorna `false` quando `otp.enabled: false` ou seção ausente
- [ ] `sendOtp()` gera código de 6 dígitos e envia via Evolution API
- [ ] `verifyOtp()` valida código com timing-safe comparison e consome (one-time)
- [ ] Códigos expiram após 10 minutos
- [ ] `/auth/identify` envia OTP automaticamente quando `method === "otp"`
- [ ] Fallback para senha se envio de OTP falhar e user tem `auth.password: true`
- [ ] `/auth/otp-send` permite reenvio (protegido por rate limit)
- [ ] `POST /auth/otp-verify` aceita `{ username, code }` e retorna JWT se válido
- [ ] Código inválido → 401, input inválido → 400
- [ ] `createAuthToken()` extraída e compartilhada com `/auth/login`
- [ ] Entradas expiradas do store são limpas periodicamente
- [ ] Build compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-353 OTP config + sender | S-103 | D-004, D-005 |
| F-354 OTP integration + resend | S-103 | D-005 |
| F-355 /auth/otp-verify endpoint | S-104 | D-006 |
