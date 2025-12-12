# Install deps (monorepo with Bun workspaces)
FROM oven/bun:1 AS deps

WORKDIR /app

# Copy workspace manifests + lockfile for better layer caching
COPY bun.lock package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Install production dependencies (includes drizzle-kit for migrations)
RUN bun install --frozen-lockfile --production
RUN bun install --cwd backend --frozen-lockfile --production

# Runtime
FROM oven/bun:1 AS runner

ENV NODE_ENV=production

ARG PORT=8787
ENV PORT=${PORT}
EXPOSE ${PORT}

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/bun.lock ./bun.lock
COPY --from=deps /app/package.json ./package.json

# App source + migrations
COPY backend ./backend
COPY --from=deps /app/backend/node_modules ./backend/node_modules

WORKDIR /app/backend

# Runs migrations then starts the server (see backend/package.json)
CMD ["bun", "run", "start"]
