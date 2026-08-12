# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Generate Prisma client (needs the schema file)
COPY prisma ./prisma
RUN bunx prisma generate

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine

WORKDIR /app

# openssl is required by Prisma at runtime
RUN apk add --no-cache openssl

# Bring in dependencies + generated Prisma client from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src ./src
COPY package.json ./
COPY prisma ./prisma

# These directories will be bind-mounted as Docker volumes; create them so
# the image is usable even without a mount (e.g. local dev).
RUN mkdir -p /data/storage

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Push Prisma schema → SQLite file (idempotent), then start the API.
CMD ["sh", "-c", "bunx prisma db push --skip-generate && bun run src/index.ts"]
