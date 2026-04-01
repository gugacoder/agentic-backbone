FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/chat/package.json apps/chat/
COPY packages/ui/package.json packages/ui/
RUN npm ci --workspace=apps/chat --workspace=packages/ui --include=optional \
    && npm i @rollup/rollup-linux-x64-gnu --save-optional 2>/dev/null || true

COPY apps/chat/ apps/chat/
COPY packages/ui/ packages/ui/
COPY tsconfig.base.json .
COPY .env .env
RUN npm run build --workspace=apps/chat

FROM nginx:alpine
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location /chat/assets/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
\n\
    location /chat/ {\n\
        try_files $uri $uri/ /chat/index.html;\n\
    }\n\
\n\
    location = / {\n\
        return 301 /chat/;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/apps/chat/dist /usr/share/nginx/html/chat
EXPOSE 80
