# syntax=docker/dockerfile:1
# =============================================================================
# Front Next.js 16 (App Router) : build standalone multi-stage.
# NEXT_PUBLIC_* sont INLINÉES au build : à passer en --build-arg (Dockploy :
# onglet "Build-time arguments"), les changer exige un rebuild. Idem pour
# toute valeur lue par next.config.ts (headers(), NEXT_PUBLIC_ALLOW_INDEXING).
# API_INTERNAL_URL et SESSION_COOKIE_NAME sont lues À L'EXÉCUTION (env runtime).
# =============================================================================
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_USE_MOCKS=0
ARG NEXT_PUBLIC_ALLOW_INDEXING=0
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG NEXT_PUBLIC_MEDIA_ORIGINS=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_USE_MOCKS=$NEXT_PUBLIC_USE_MOCKS \
    NEXT_PUBLIC_ALLOW_INDEXING=$NEXT_PUBLIC_ALLOW_INDEXING \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_MEDIA_ORIGINS=$NEXT_PUBLIC_MEDIA_ORIGINS \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Le build ne doit joindre AUCUN service (l'API n'est pas démarrée pendant
# `docker build`) : les pages qui appellent l'API doivent être dynamiques/ISR.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
