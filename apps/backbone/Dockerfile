FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backbone/package.json apps/backbone/
COPY packages/gitlab/v4/package.json packages/gitlab/v4/
RUN npm ci --workspace=apps/backbone --workspace=packages/gitlab/v4

COPY apps/backbone/src apps/backbone/src
COPY apps/backbone/tsconfig.json apps/backbone/tsconfig.build.json apps/backbone/
COPY packages/gitlab/v4/src packages/gitlab/v4/src
COPY packages/gitlab/v4/tsconfig.json packages/gitlab/v4/
COPY tsconfig.base.json .
RUN npm run build --workspace=packages/gitlab/v4 \
    && cd apps/backbone && npx tsc -p tsconfig.build.json

FROM node:22-slim
WORKDIR /app

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/backbone/node_modules apps/backbone/node_modules
COPY --from=builder /app/apps/backbone/dist apps/backbone/dist
COPY --from=builder /app/apps/backbone/package.json apps/backbone/
COPY --from=builder /app/packages/gitlab/v4/node_modules packages/gitlab/v4/node_modules
COPY --from=builder /app/packages/gitlab/v4/dist packages/gitlab/v4/dist
COPY --from=builder /app/packages/gitlab/v4/package.json packages/gitlab/v4/

RUN mkdir -p apps/backbone/context apps/backbone/data

WORKDIR /app/apps/backbone
EXPOSE ${BACKBONE_PORT:-6002}
CMD ["node", "dist/index.js"]
