# Secrets — SOPS + age

Gerenciamento de `.env` encriptados no repositório.

## Pré-requisitos

```bash
scoop install extras/age main/sops    # Windows
brew install age sops                 # macOS
apt install age sops                  # Linux
```

## Arquivos

| Arquivo | Commitado | Descrição |
|---|---|---|
| `.env.development.enc` | sim | Secrets de dev (encriptado) |
| `.env.staging.enc` | sim | Secrets de staging (encriptado) |
| `.env.production.enc` | sim | Secrets de production (encriptado) |
| `.env` | não | Plaintext ativo (gitignored) |
| `.enc.key` | não | Chave age local (gitignored, opcional) |
| `.sops.yaml` | sim | Config do SOPS (chave pública age) |

## Uso

```bash
# Decriptar (gera .env a partir do .enc)
npm run secrets:decrypt                  # default: development
npm run secrets:decrypt -- staging       # staging
npm run secrets:decrypt -- production    # production

# Encriptar (gera .enc a partir do .env)
npm run secrets:encrypt                  # default: development
npm run secrets:encrypt -- staging       # staging
npm run secrets:encrypt -- production    # production
```

## Chave age

A chave privada age é o único segredo compartilhado entre devs. Peça a um colega.

### Resolução da chave (ordem de prioridade)

1. **`SOPS_AGE_KEY` env var** — CI/automação. Nunca abre prompt.
2. **`.enc.key` arquivo** — conveniência local. Crie manualmente ou aceite a oferta do script no primeiro uso.
3. **Prompt interativo** — o script pede a chave e oferece salvar em `.enc.key`.

### CI/Automação

Em pipelines, passe a chave como variável de ambiente:

```bash
SOPS_AGE_KEY="AGE-SECRET-KEY-..." npm run secrets:decrypt -- staging
```

## Workflow típico

### Primeiro setup (dev novo)

```bash
git clone <repo>
npm install
npm run secrets:decrypt        # digita a chave, salva em .enc.key
npm run platform:up
npm run dev:all
```

### Alterar um secret

```bash
# Edite .env normalmente
vim .env

# Encripte de volta
npm run secrets:encrypt

# Commit
git add .env.development.enc
git commit -m "chore: update dev secrets"
```

### Trocar de ambiente

```bash
npm run secrets:decrypt -- staging     # .env agora tem valores de staging
```

## Notas

- O formato dotenv do SOPS preserva nomes de variáveis visíveis no diff — apenas valores são encriptados.
- Linhas em branco do `.env` original são removidas no roundtrip (limitação do parser dotenv do SOPS). Não afeta funcionalidade.
- CRLF (Windows) é convertido para LF automaticamente antes de encriptar.
