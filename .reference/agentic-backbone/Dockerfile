# Dockerfile
# Agentic Backbone (Hono + Claude Agent SDK)
#
# Build context: monorepo root (.)
# Build: docker compose build ab-backbone
# Run:   docker compose up ab-backbone

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:22-slim AS builder

# better-sqlite3 requires native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# All workspace package.json files (required for npm ci with lockfile)
COPY package.json package-lock.json ./
COPY apps/agentic-backbone/package.json apps/agentic-backbone/
COPY apps/agentic-hub/package.json apps/agentic-hub/
COPY apps/cia-api/package.json apps/cia-api/
COPY apps/cia-app/package.json apps/cia-app/
COPY packages/kai-sdk/package.json packages/kai-sdk/
COPY packages/cia-auth/package.json packages/cia-auth/
COPY packages/notification-gateway/package.json packages/notification-gateway/

RUN npm ci

# Build shared packages (backbone depends on them)
COPY packages/kai-sdk/ packages/kai-sdk/
COPY packages/cia-auth/ packages/cia-auth/
COPY packages/notification-gateway/ packages/notification-gateway/
COPY tsconfig.base.json .
RUN npm run build -w @agentic-backbone/kai-sdk && npm run build -w @cia-auth/core && npm run build -w @cia/notification-gateway

# Build backbone
COPY apps/agentic-backbone/src apps/agentic-backbone/src
COPY apps/agentic-backbone/tsconfig.json apps/agentic-backbone/
RUN npm run build -w agentic-backbone

# =============================================================================
# Stage 2: Runner
# =============================================================================
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/kai-sdk/dist packages/kai-sdk/dist
COPY --from=builder /app/packages/kai-sdk/package.json packages/kai-sdk/
COPY --from=builder /app/packages/cia-auth/dist packages/cia-auth/dist
COPY --from=builder /app/packages/cia-auth/package.json packages/cia-auth/
COPY --from=builder /app/packages/notification-gateway/dist packages/notification-gateway/dist
COPY --from=builder /app/packages/notification-gateway/package.json packages/notification-gateway/
COPY --from=builder /app/apps/agentic-backbone/dist apps/agentic-backbone/dist
COPY --from=builder /app/apps/agentic-backbone/package.json apps/agentic-backbone/

WORKDIR /app/apps/agentic-backbone

EXPOSE 8004

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${BACKBONE_PORT}/api/v2/agents/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "--import", "tsx/esm", "dist/index.js"]
