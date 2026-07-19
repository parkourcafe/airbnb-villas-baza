# Worker image for Fly.io (apps/worker).
#
# tsup bundles the @bai/* workspace packages into dist/, so only third-party
# runtime deps (postgres, @supabase/supabase-js, zod) need to ship. `pnpm deploy`
# produces a self-contained /app with exactly those production deps.
#
# Build context is the REPO ROOT (see .dockerignore). Build locally with:
#   docker build -f apps/worker/Dockerfile -t bai-worker .
# Fly builds it automatically on `flyctl deploy`.

FROM node:24-slim AS build
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @bai/worker build
# Bundle the worker + its production dependencies into /app (--legacy: pnpm v10
# deploys non-injected workspaces only with this flag).
RUN pnpm --filter @bai/worker deploy --prod --legacy /app

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# Long-running poller; no inbound HTTP.
CMD ["node", "dist/index.js"]
