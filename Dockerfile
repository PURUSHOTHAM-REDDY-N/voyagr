# syntax=docker/dockerfile:1

# Debian-based (not Alpine): Prisma's query engine binaries target glibc by
# default, and matching binaryTargets to musl for Alpine is one more thing to
# keep in sync - node:*-slim avoids that entirely at a small size cost.
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- deps: installed once, re-used unless package files change ----
FROM base AS deps
COPY package.json package-lock.json ./
# --legacy-peer-deps: this project pins next@14.0.4 while some deps (e.g.
# next-auth@beta) declare newer peer ranges - same flag used for local installs.
RUN npm ci --legacy-peer-deps

# ---- migrator: pushes the Prisma schema to Mongo before the app starts ----
# Only needs node_modules (for the prisma CLI) and the schema itself - not
# the built app - so it stays cheap even though it shares the deps layer.
FROM deps AS migrator
COPY prisma ./prisma
COPY prisma.config.ts ./
CMD ["npx", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"]

# ---- builder: generate the Prisma client, then build Next.js ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` only needs the schema to be well-formed, not a reachable
# database - but prisma.config.ts's env("DATABASE_URL") throws if the
# variable is entirely unset, so a placeholder is enough here. The real
# DATABASE_URL is supplied at container *runtime* (see docker-compose.yml).
ENV DATABASE_URL="mongodb://placeholder/placeholder"
RUN npx prisma generate

# Next.js inlines NEXT_PUBLIC_* variables into the client bundle at BUILD
# time, not runtime - unlike every other secret in .env.sample, these two
# must be supplied as build args, not left for docker-compose's `environment:`.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_HOSTING_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_HOSTING_URL=$NEXT_PUBLIC_HOSTING_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner: minimal production image ----
FROM node:20-slim AS runner
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Next's standalone output tracing sometimes misses Prisma's generated
# client/engine binary (it's resolved dynamically at runtime, not via a
# statically-analyzable import) - copy it explicitly rather than relying on
# tracing to have caught it, per Prisma's own Docker deployment guidance.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
