# S-103 — Configuração OTP + Envio via Evolution (WhatsApp)

Criar módulo de configuração OTP e integração com a Evolution API para envio e validação de códigos OTP via WhatsApp.

**Resolve:** D-004 (Módulo settings/otp.ts), D-005 (Integração Evolution para envio de OTP)
**Score de prioridade:** 8
**Dependência:** S-100 (campo auth no UserConfig + endpoint /auth/identify)
**PRP:** 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

---

## 1. Objetivo

Implementar o subsistema OTP completo: leitura de configuração da Evolution em `settings.yml`, geração de código de 6 dígitos, envio via WhatsApp (Evolution API) e validação com TTL. Este módulo é consumido por `/auth/identify` (S-100) e `/auth/otp-verify` (S-104).

---

## 2. Alterações

### 2.1 Arquivo: `context/settings.yml` — Nova seção `otp`

Adicionar seção `otp` ao arquivo de settings:

```yaml
otp:
  enabled: false
  evolution:
    host: https://evo.example.com
    api-key: ${EVOLUTION_OTP_API_KEY}
    instance: otp-instance
```

- `enabled: false` como padrão seguro — dev local funciona sem configuração
- `api-key` usa interpolação de env var e será auto-encriptada pelo sistema existente de encriptação de campos sensíveis

### 2.2 Novo arquivo: `apps/backbone/src/settings/otp.ts`

Módulo de leitura da configuração OTP:

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

/**
 * Lê a configuração OTP de settings.yml.
 * Retorna config validada ou { enabled: false } se seção ausente.
 */
export function getOtpConfig(): OtpConfig {
  // Ler seção 'otp' do settings.yml usando readYaml/getSettings existente
  // Se ausente, retornar { enabled: false }
  // Se presente, validar com OtpConfigSchema
  // Lançar erro se enabled: true mas evolution não configurado
}

/**
 * Verifica se OTP está habilitado e configurado.
 */
export function isOtpEnabled(): boolean {
  const config = getOtpConfig();
  return config.enabled && !!config.evolution;
}
```

### 2.3 Novo arquivo: `apps/backbone/src/otp/sender.ts`

Módulo de geração, envio e validação de OTP:

```typescript
import { getOtpConfig } from "../settings/otp.js";

interface OtpEntry {
  code: string;
  expiresAt: number;
}

/** Store in-memory de códigos OTP ativos. Chave: username (slug) */
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

/**
 * Gera código numérico de 6 dígitos criptograficamente seguro.
 */
function generateCode(): string {
  const { randomInt } = await import("crypto");
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/**
 * Envia OTP via WhatsApp (Evolution API).
 * Armazena código no store in-memory com TTL de 10 min.
 *
 * @param username Slug do user (chave no store)
 * @param phoneNumber Número de telefone completo (ex: "5511999991234")
 */
export async function sendOtp(username: string, phoneNumber: string): Promise<void> {
  const config = getOtpConfig();
  if (!config.enabled || !config.evolution) {
    throw new Error("OTP não está habilitado");
  }

  const code = generateCode();

  // Armazenar no store (substitui código anterior se existir)
  otpStore.set(username, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  // Enviar via Evolution API
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

/**
 * Verifica código OTP.
 * Consome o código se válido (one-time use).
 *
 * @returns true se código válido e dentro do TTL
 */
export function verifyOtp(username: string, code: string): boolean {
  const entry = otpStore.get(username);
  if (!entry) return false;

  if (entry.expiresAt <= Date.now()) {
    otpStore.delete(username);
    return false;
  }

  // Comparação timing-safe para evitar timing attacks
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

### 2.4 Arquivo: `apps/backbone/src/routes/auth.ts` — Integrar sendOtp no /auth/identify

No endpoint `POST /auth/identify` (criado em S-100), conectar o envio real:

```typescript
import { sendOtp } from "../otp/sender.js";
import { isOtpEnabled } from "../settings/otp.js";

// Dentro do handler de /auth/identify:
if (method === "otp" && isOtpEnabled()) {
  try {
    await sendOtp(resolved.slug, config.phoneNumber!);
  } catch (err) {
    // Log do erro mas não expor ao client
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

**Fallback:** se OTP está habilitado no user mas o envio falha (Evolution fora do ar), e o user tem senha, fallback para `method: "password"`. Se não tem senha, retorna 500.

### 2.5 Novo endpoint: `POST /auth/otp-send` (reenvio)

Endpoint para reenvio de OTP (usado pelo botão "Reenviar código" no frontend):

```typescript
app.post("/auth/otp-send", authRateLimit, async (c) => {
  const { username } = await c.req.json<{ username: string }>();

  // Mesma lógica de resolução de user do /auth/identify
  const resolved = /* resolver user */;
  if (!resolved || !resolved.config.auth?.otp || !resolved.config.phoneNumber) {
    return c.json({ error: "Credenciais inválidas" }, 401);
  }

  await sendOtp(resolved.slug, resolved.config.phoneNumber);
  return c.json({ sent: true });
});
```

---

## 3. Regras de Implementação

- O código OTP é numérico de 6 dígitos, gerado com `crypto.randomInt` (CSPRNG)
- Store in-memory (`Map`) — sem dependência de banco ou Redis
- TTL de 10 minutos — após expirar, o user precisa solicitar reenvio
- Código é **one-time use** — consumido na verificação bem-sucedida
- A comparação do código usa `timingSafeEqual` — previne timing attacks
- Erros da Evolution API são logados mas não expostos ao client
- O endpoint `/auth/otp-send` está protegido pelo rate limiting (S-102)
- Usar `import()` dinâmico ou import estático de `crypto` conforme padrão do projeto

---

## 4. Critérios de Aceite

- [ ] Seção `otp` adicionada ao `settings.yml` com `enabled: false`
- [ ] `getOtpConfig()` lê e valida a config de `settings.yml`
- [ ] `isOtpEnabled()` retorna `false` quando `otp.enabled: false` ou seção ausente
- [ ] `sendOtp()` gera código de 6 dígitos e envia via Evolution API
- [ ] `verifyOtp()` valida código com timing-safe comparison e consome (one-time)
- [ ] Códigos expiram após 10 minutos
- [ ] `/auth/identify` envia OTP automaticamente quando `method === "otp"`
- [ ] Fallback para senha se envio de OTP falhar e user tem `auth.password: true`
- [ ] `/auth/otp-send` permite reenvio (protegido por rate limit)
- [ ] Entradas expiradas são limpas periodicamente
- [ ] Build compila sem erros
