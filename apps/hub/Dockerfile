# Dockerfile
# Hub Frontend (Vite + React PWA → Nginx)
#
# Build context: agentic-backbone/ (monorepo root)
# Build: docker compose build ab-hub (from repo root)
# Run:   docker compose up ab-hub

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:22-slim AS builder

WORKDIR /app

# Copiar package files (monorepo root + workspace)
COPY package.json package-lock.json ./
COPY apps/hub/package.json apps/hub/

RUN npm ci

# Copiar codigo do hub
COPY apps/hub/ apps/hub/
COPY tsconfig.base.json .

# Build Vite
RUN npm run build --workspace=apps/hub

# =============================================================================
# Stage 2: Runner (Nginx para servir SPA)
# =============================================================================
FROM nginx:alpine AS runner

# Copiar build do Vite
COPY --from=builder /app/apps/hub/dist /usr/share/nginx/html

# Configuracao Nginx para SPA (fallback para index.html)
RUN echo 'server { \
    listen 3000; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /health { \
        access_log off; \
        return 200 "OK"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
