FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/hub/package.json apps/hub/
RUN npm ci --workspace=apps/hub --include=optional \
    && npm i @rollup/rollup-linux-x64-gnu --save-optional 2>/dev/null || true

COPY apps/hub/ apps/hub/
COPY tsconfig.base.json .
COPY .env .env
RUN cd apps/hub && npx vite build

FROM nginx:alpine
COPY --from=builder /app/apps/hub/dist /usr/share/nginx/html/hub
COPY apps/hub/nginx.prod.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
