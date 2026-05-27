# =====================================================================
# Anchor — multi-stage Dockerfile
# Builds a production Next.js standalone image, ~120 MB final.
# =====================================================================

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --only=production --ignore-scripts \
 && npx prisma generate

# ---------- Stage 2: build ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci \
 && npx prisma generate \
 && npm run build

# ---------- Stage 3: runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create unprivileged user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 anchor

# Public assets + Next standalone runtime
COPY --from=builder --chown=anchor:nodejs /app/public ./public
COPY --from=builder --chown=anchor:nodejs /app/.next/standalone ./
COPY --from=builder --chown=anchor:nodejs /app/.next/static ./.next/static

# Prisma client + schema (needed at runtime for adapter-neon)
COPY --from=builder --chown=anchor:nodejs /app/prisma ./prisma
COPY --from=builder --chown=anchor:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=anchor:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Embed-writer scripts (so `docker compose exec app npm run seed` works)
COPY --from=builder --chown=anchor:nodejs /app/scripts ./scripts
COPY --from=builder --chown=anchor:nodejs /app/node_modules/tsx ./node_modules/tsx

USER anchor

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
