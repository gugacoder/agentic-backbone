# Dockerfile
# Agentic Hub Frontend (Vite + React 19 PWA)
#
# Build context: monorepo root (.)
# Build: docker compose build ab-hub
#
# Produces a minimal image with static files in /static/hub/.
# At runtime, files are copied to a shared volume and served by Caddy.

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:22-slim AS builder

WORKDIR /app

# All workspace package.json files (required for npm ci with lockfile)
COPY package.json package-lock.json ./
COPY apps/agentic-hub/package.json apps/agentic-hub/
COPY apps/agentic-backbone/package.json apps/agentic-backbone/
COPY apps/cia-api/package.json apps/cia-api/
COPY apps/cia-app/package.json apps/cia-app/
COPY packages/kai-sdk/package.json packages/kai-sdk/
COPY packages/cia-auth/package.json packages/cia-auth/
COPY packages/notification-gateway/package.json packages/notification-gateway/

RUN npm ci

# Copy source and build
COPY apps/agentic-hub/ apps/agentic-hub/
COPY tsconfig.base.json .
RUN npm run build -w agentic-hub

# =============================================================================
# Stage 2: Static assets only (no web server)
# =============================================================================
FROM alpine:3.20 AS runner

RUN mkdir -p /static/hub
COPY --from=builder /app/apps/agentic-hub/dist/ /static/hub/

CMD ["sh", "-c", "cp -a /static/. /shared/ && touch /tmp/ready && exec sleep infinity"]
