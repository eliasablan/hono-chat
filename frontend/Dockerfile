# -----------------------------------------------------------------------------
# Next.js (standalone) + Bun runtime for a monorepo.
# Build context is repo root so tsconfig extends and @backend/* paths resolve.
# -----------------------------------------------------------------------------

FROM oven/bun:1 AS base

# Install workspace deps (frontend imports backend types)
FROM base AS deps
WORKDIR /app
COPY bun.lock package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN bun install --frozen-lockfile
RUN bun install --cwd frontend --no-save --frozen-lockfile

# Build frontend with access to root tsconfig and backend types
FROM base AS builder
WORKDIR /app
COPY --from=deps /app /app
COPY tsconfig.json ./tsconfig.json
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/frontend
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
RUN bun run build

# Next.js standalone output can be nested in monorepos (e.g. .next/standalone/frontend/server.js).
# Normalize to a flat dir so the runtime CMD is stable.
RUN mkdir -p .next/standalone-flat && \
    if [ -f .next/standalone/server.js ]; then \
      cp -a .next/standalone/. .next/standalone-flat/; \
    else \
      STANDALONE_ROOT=".next/standalone" && \
      STANDALONE_DIR="$(find "$STANDALONE_ROOT" -maxdepth 3 -type f -name server.js -print | head -n 1 | xargs -I{} dirname {})" && \
      test -n "$STANDALONE_DIR" && \
      if [ -d "$STANDALONE_ROOT/node_modules" ]; then \
        cp -a "$STANDALONE_ROOT/node_modules" .next/standalone-flat/; \
      else \
        cp -a node_modules .next/standalone-flat/node_modules; \
      fi && \
      if [ -f "$STANDALONE_ROOT/package.json" ]; then \
        cp -a "$STANDALONE_ROOT/package.json" .next/standalone-flat/; \
      elif [ -f package.json ]; then \
        cp -a package.json .next/standalone-flat/; \
      fi && \
      cp -a "$STANDALONE_DIR"/. .next/standalone-flat/; \
    fi

# Production image
FROM base AS runner
WORKDIR /app/frontend

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/.next/standalone-flat ./
COPY --from=builder /app/frontend/.next/static ./.next/static
# Bun workspaces often symlink packages from frontend/node_modules -> /app/node_modules/.bun.
# Copy the Bun store so those symlinks resolve at runtime.
COPY --from=builder /app/node_modules/.bun /app/node_modules/.bun

EXPOSE 3000

CMD ["bun", "./server.js"]
