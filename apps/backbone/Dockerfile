FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backbone/package.json apps/backbone/
COPY packages/kai-sdk/package.json packages/kai-sdk/
RUN npm ci --workspace=apps/backbone --workspace=packages/kai-sdk

COPY apps/backbone/src apps/backbone/src
COPY apps/backbone/tsconfig.json apps/backbone/
COPY packages/kai-sdk/src packages/kai-sdk/src
COPY packages/kai-sdk/tsconfig.json packages/kai-sdk/
COPY tsconfig.base.json .
RUN npm run build --workspace=packages/kai-sdk && npm run build --workspace=apps/backbone

FROM node:22-slim
WORKDIR /app

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/backbone/node_modules apps/backbone/node_modules
COPY --from=builder /app/apps/backbone/dist apps/backbone/dist
COPY --from=builder /app/apps/backbone/package.json apps/backbone/
COPY --from=builder /app/packages/kai-sdk/node_modules packages/kai-sdk/node_modules
COPY --from=builder /app/packages/kai-sdk/dist packages/kai-sdk/dist
COPY --from=builder /app/packages/kai-sdk/package.json packages/kai-sdk/
RUN mkdir -p apps/backbone/context

WORKDIR /app/apps/backbone
EXPOSE ${BACKBONE_PORT:-8004}
CMD ["node", "dist/index.js"]
