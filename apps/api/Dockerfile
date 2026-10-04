FROM node:20-alpine AS base
RUN corepack enable
RUN apk add --no-cache openssl

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install

COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api

RUN pnpm --filter @retimax/shared-types build
RUN pnpm --filter @retimax/api exec prisma generate
RUN pnpm --filter @retimax/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g prisma@6.19.3

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts
COPY --from=builder /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

RUN chmod +x /app/apps/api/docker-entrypoint.sh
RUN mkdir -p /data/uploads/images /data/uploads/thumbnails

WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
