# Deploy — Agentic Backbone

## Infraestrutura

| Item | Valor |
|------|-------|
| Production | `ab.codr.studio` — `/srv/apps/ab.codr.studio` |
| Staging | `h.ab.codr.studio` — `/srv/apps/h.ab.codr.studio` |
| Registry | `ghcr.io/codrstudio/agentic-backbone/{backbone,hub,chat}` |
| CI | GitHub Actions (`build.yml`) — builda no push de `develop` e `main` |
| Proxy | Traefik global (TLS via Let's Encrypt) → Caddy por stack |

Convenção de domínio staging: `h.{domain}` (ex: `h.ab.codr.studio`).

## Princípio

**A VPS nunca builda.** Build é pesado e compete por recursos com produção. A VPS só faz `pull` de imagens prontas e `up`.

```
push → GitHub Actions (build) → ghcr.io → VPS (pull + up)
```

---

## Branches e Tags

| Branch | Propósito | Tag no ghcr.io |
|--------|-----------|----------------|
| `develop` | Trabalho diário | `:staging` |
| `main` | Código aprovado | `:latest` + `:release-{n}` |

Tags `release-{n}` marcam versões promovidas a produção e servem para rollback.

---

## Estrutura do projeto

### Dockerfiles (build)

Ficam junto das apps. Build context é sempre a **raiz do monorepo**.

| App | Dockerfile | Base | Porta interna |
|-----|-----------|------|---------------|
| backbone | `apps/backbone/Dockerfile` | node:22-slim | `${BACKBONE_PORT}` |
| hub | `apps/hub/Dockerfile` | nginx:alpine | 80 |
| chat | `apps/chat/Dockerfile` | nginx:alpine | 80 |

### `deploy/` (VPS)

Pasta commitada no repo. Na VPS, `docker compose` roda de dentro dela.

```
deploy/
  docker-compose.yml   ← compose de VPS (pull-only, sem build:)
  Caddyfile            ← roteamento por path
  env/
    staging.env        ← template .env staging (sem secrets reais)
    production.env     ← template .env production (sem secrets reais)
  GUIDE.md             ← (este arquivo, movido para cá no futuro)
```

### `docker-compose.yml` (raiz)

Compose de **desenvolvimento/CI**. Tem `build:` + `image:`. Usado por:
- `npm run docker:build` — build local ou CI
- `npm run docker:up` — teste local com containers

---

## Arquitetura Docker (VPS)

```
Traefik (*.codr.studio, TLS)
  └─ Caddy :80 (único serviço na codr-net)
       ├─ /api/*    → backbone.internal:${BACKBONE_PORT}
       ├─ /hub/*    → hub.internal:80
       ├─ /chat/*   → chat.internal:80
       ├─ /health   → "OK"
       └─ /         → redirect /hub/
```

Todos os serviços na rede `internal`. Caddy é a única ponte com `codr-net` (Traefik).

---

## Fluxos

### 1. Deploy em Staging

**Pré-requisitos (one-time):**
1. Repo no GitHub com Actions configurado (`build.yml`)
2. VPS com Traefik rodando, `codr-net` criada
3. Repo clonado em `/srv/apps/h.ab.codr.studio`
4. `deploy/.env` com secrets reais
5. `docker login ghcr.io` feito na VPS

**Fluxo:**

```
1. Developer faz push em develop
       ↓
2. GitHub Actions dispara build.yml:
   - Checkout do repo
   - Login no ghcr.io
   - Build das 3 imagens em paralelo (matrix):
     - apps/backbone/Dockerfile → ghcr.io/.../backbone:staging
     - apps/hub/Dockerfile      → ghcr.io/.../hub:staging
     - apps/chat/Dockerfile     → ghcr.io/.../chat:staging
   - Push para ghcr.io
       ↓
3. SSH na VPS:
   cd /srv/apps/h.ab.codr.studio
   git pull origin develop
       ↓
4. cd deploy
   docker compose pull
       ↓
5. docker compose up -d
       ↓
6. Validação:
   curl -sk https://h.ab.codr.studio/health
   curl -sk https://h.ab.codr.studio/api/v1/ai/health
   curl -sk https://h.ab.codr.studio/hub/ -o /dev/null -w "%{http_code}"
   curl -sk https://h.ab.codr.studio/chat/ -o /dev/null -w "%{http_code}"
```

### 2. Promover para Production

```bash
# Local:
git checkout main
git merge develop
git push origin main
git tag release-{n}
git push --tags

# Aguardar Actions buildar :latest + :release-{n}

# Na VPS:
cd /srv/apps/ab.codr.studio
git pull origin main
cd deploy
docker compose pull
docker compose up -d

# Validação:
curl -sk https://ab.codr.studio/health
curl -sk https://ab.codr.studio/api/v1/ai/health
```

### 3. Rollback

```bash
cd /srv/apps/ab.codr.studio
git checkout release-{n-1}
cd deploy
TAG=release-{n-1} docker compose pull
TAG=release-{n-1} docker compose up -d
```

Imagens anteriores ficam no ghcr.io. Rollback é só trocar a tag.

### 4. Validação pós-deploy

```bash
/health                  → OK
/api/v1/ai/health        → {"status":"ok"}
/hub/                    → 200
/chat/                   → 200
```

---

## GitHub Actions

CI builda as 3 imagens em paralelo via matrix strategy no push de `develop` e `main`.

Lógica de tags:
- `refs/heads/develop` → `:staging`
- `refs/heads/main` → `:latest`
- `refs/tags/release-*` → `:release-{n}` + `:latest`

Auth na VPS (uma vez):

```bash
docker login ghcr.io -u <github-user> -p <PAT-com-read:packages>
```

---

## Secrets

`.env` na VPS contém todos os secrets. **Nunca commitar no git.**

Variáveis críticas:
- `JWT_SECRET` — gerado via `npm run setup`
- `ENCRYPTION_KEY` — gerado via `npm run setup`
- `OPENROUTER_API_KEY` — acesso à API de LLM

**Importante:** a `ENCRYPTION_KEY` deve ser a mesma que encriptou os YAMLs em `context/credentials/`. Se trocar a chave, os valores `ENC(...)` precisam ser re-encriptados.

Templates sem secrets reais ficam em `deploy/env/`.

---

## Portas (PREFIX)

Cada instância usa um `PREFIX` numérico. Portas derivam dele:

```env
PREFIX=60
PUBLIC_PORT=6000    # Caddy (entry point via Traefik)
BACKBONE_PORT=6002  # porta real do Node.js
HUB_PORT=6001       # usado no dev; em Docker hub serve na 80
CHAT_PORT=6003      # usado no dev; em Docker chat serve na 80
```

Portas ficam na rede interna Docker — não expostas no host.

---

## Notas técnicas (Dockerfiles)

- **Backbone**: `tsconfig.build.json` com `noCheck: true` (transpila sem type-checking)
- **Hub/Chat**: `npm i @rollup/rollup-linux-x64-gnu` após `npm ci` (fix de rollup cross-platform)
- **Hub/Chat**: `.env` copiado para builder (necessário para `VITE_*` em build time)
- **Hub/Chat**: output vai para `/usr/share/nginx/html/{hub,chat}/` (subdiretório)
- **SQLite**: volume `data/` obrigatório — sem ele, DB é perdido no recreate
- **Context**: volume `context/` — agentes, channels, credentials

---

## Guardrails

1. **Staging primeiro, sempre.** Nunca deployar direto em prod.
2. **Não derrubar prod** sem autorização explícita.
3. **Avançar por etapas.** Cada etapa validada antes de avançar.

---

## Setup inicial da VPS (one-time)

```bash
# 1. Rede (se ainda não existir)
docker network create codr-net

# 2. Clonar
git clone git@github.com:codrstudio/agentic-backbone.git /srv/apps/<dominio>
cd /srv/apps/<dominio>
git checkout <branch>

# 3. Secrets
cp deploy/env/<ambiente>.env deploy/.env
# Editar deploy/.env com secrets reais

# 4. Registry
docker login ghcr.io -u <github-user> -p <PAT>

# 5. Subir
cd deploy
docker compose pull
docker compose up -d

# 6. DNS
# Criar registro A apontando <dominio> para a VPS
# Traefik gera TLS automaticamente via Let's Encrypt
```

---

## Checklist

- [ ] Dockerfiles em `apps/{backbone,hub,chat}/Dockerfile`
- [ ] `.dockerignore` na raiz
- [ ] `deploy/docker-compose.yml` (pull-only, sem build)
- [ ] `deploy/Caddyfile`
- [ ] `deploy/env/` com templates
- [ ] `.github/workflows/build.yml` (CI)
- [ ] `image:` no `docker-compose.yml` raiz (para tagear no build)
- [ ] `.env` de produção na VPS
- [ ] Traefik labels no Caddy
- [ ] `docker login ghcr.io` na VPS
- [ ] DNS apontando para a VPS
