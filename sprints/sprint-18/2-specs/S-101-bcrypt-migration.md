# S-101 — Migrar Verificação de Senha para bcrypt

Substituir a comparação direta de strings por hashing bcrypt com detecção de formato antigo e re-hash transparente.

**Resolve:** D-002 (bcrypt migration para users/password.ts)
**Score de prioridade:** 9
**Dependência:** Nenhuma — pode rodar em paralelo com S-100, S-102
**PRP:** 24 — Secure Login: Wizard + OTP via WhatsApp + Rate Limiting

---

## 1. Objetivo

A implementação atual em `users/password.ts` usa `timingSafeEqual` para comparar a senha fornecida com a senha armazenada em plaintext (encriptada em AES-256-GCM no `credential.yml`, mas reversível). Migrar para bcrypt com cost factor 12, mantendo compatibilidade com senhas existentes no formato antigo.

---

## 2. Alterações

### 2.1 Dependência: instalar `bcrypt`

```bash
npm install bcrypt --workspace=apps/backbone
npm install -D @types/bcrypt --workspace=apps/backbone
```

**Alternativa:** se `bcrypt` nativo causar problemas de compilação, usar `bcryptjs` (JavaScript puro, mesma API).

### 2.2 Arquivo: `apps/backbone/src/users/password.ts` (REESCREVER)

```typescript
import bcrypt from "bcrypt";

const BCRYPT_COST = 12;

/**
 * Detecta se o valor armazenado é um hash bcrypt.
 * Hashes bcrypt começam com $2b$, $2a$ ou $2y$.
 */
function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$/.test(stored);
}

/**
 * Verifica senha contra o valor armazenado.
 * Suporta dois formatos:
 * - bcrypt hash ($2b$12$...) → bcrypt.compare
 * - plaintext (formato antigo, decriptado do credential.yml) → comparação direta
 *
 * Retorna { valid: boolean, needsRehash: boolean }
 */
export async function verifyPassword(
  input: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isBcryptHash(stored)) {
    const valid = await bcrypt.compare(input, stored);
    return { valid, needsRehash: false };
  }

  // Formato antigo: comparação direta (timing-safe)
  const a = Buffer.from(input, "utf-8");
  const b = Buffer.from(stored, "utf-8");
  if (a.length !== b.length) {
    return { valid: false, needsRehash: false };
  }
  const { timingSafeEqual } = await import("crypto");
  const valid = timingSafeEqual(a, b);
  return { valid, needsRehash: valid }; // se válido, precisa re-hash
}

/**
 * Gera hash bcrypt para uma senha plaintext.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}
```

**IMPORTANTE:** A assinatura de `verifyPassword` muda de síncrona para assíncrona (`Promise`). Todos os call sites devem ser atualizados com `await`.

### 2.3 Arquivo: `apps/backbone/src/routes/auth.ts` — Atualizar login

No handler de `POST /auth/login`:

```typescript
// Antes:
const valid = verifyPassword(password, record.password);

// Depois:
const { valid, needsRehash } = await verifyPassword(password, record.password);

// Se válido e precisa re-hash, atualizar em background
if (valid && needsRehash) {
  const hashed = await hashPassword(password);
  // Atualizar credential.yml do user com o hash bcrypt
  await updateUserCredentialPassword(record.slug, hashed);
}
```

### 2.4 Arquivo: `apps/backbone/src/users/manager.ts` — Criar/atualizar com hash

#### `createUser()`

Ao criar um user com senha, hashear antes de gravar:

```typescript
// Antes:
// grava senha plaintext no credential.yml

// Depois:
const hashed = await hashPassword(password);
// grava hash bcrypt no credential.yml
```

#### `updateUser()` (quando atualiza senha)

```typescript
// Antes:
// grava senha plaintext no credential.yml

// Depois:
const hashed = await hashPassword(password);
// grava hash bcrypt no credential.yml
```

#### Nova função: `updateUserCredentialPassword(slug, hashedPassword)`

Função interna para atualizar apenas o campo `password` do `credential.yml` de um user. Usada pelo re-hash transparente no login.

---

## 3. Estratégia de Migração

A migração é **lazy** (on-login):

1. User faz login com senha
2. `verifyPassword` detecta formato antigo (não começa com `$2b$`)
3. Compara plaintext (timing-safe) → válido
4. Retorna `needsRehash: true`
5. `auth.ts` chama `hashPassword` + `updateUserCredentialPassword`
6. Próximo login já usa bcrypt.compare

**Não há script de migração em massa** — cada user é migrado na primeira vez que faz login. Senhas de users que nunca mais fazem login permanecem no formato antigo (mas continuam funcionando).

---

## 4. Regras de Implementação

- `bcrypt.compare` é timing-safe por design — não precisa de proteção adicional
- Cost factor 12 é o mínimo recomendado (OWASP 2024)
- A função `verifyPassword` deve permanecer timing-safe no fallback plaintext
- O re-hash em background não deve bloquear a resposta do login — mas `await` é aceitável dado que é operação rápida (~200ms)
- Não remover a lógica de decriptação do `credential.yml` (AES-256-GCM) — o bcrypt hash será encriptado em disco da mesma forma que o plaintext era

---

## 5. Critérios de Aceite

- [ ] `verifyPassword` é async e retorna `{ valid, needsRehash }`
- [ ] Senhas novas (createUser, updateUser) são hasheadas com bcrypt cost 12
- [ ] Login com senha no formato antigo (plaintext) funciona e re-hasheia automaticamente
- [ ] Login com senha já hasheada (bcrypt) funciona normalmente
- [ ] `POST /auth/login` usa `await verifyPassword()`
- [ ] Todos os call sites de `verifyPassword` atualizados para async
- [ ] Build compila sem erros
