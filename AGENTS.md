# Agent Instructions

These instructions apply to this repository regardless of the agent harness.

## Runtime And Package Management

- Use Bun by default.
- Use `bun <file>` instead of `node <file>` or `ts-node <file>`.
- Use `bun install` instead of npm, Yarn, or pnpm installs.
- Use `bun run <script>` instead of npm, Yarn, or pnpm script runners.
- Use `bun test` for tests.
- Use `bunx <package> <command>` instead of `npx`.
- Bun automatically loads `.env`; do not add `dotenv`.

## Project Shape

- This is a Bun workspace monorepo.
- `backend` contains the Hono HTTP/WebSocket backend.
- `frontend` contains the Next.js frontend.
- Shared TypeScript contracts live in `backend/src/contracts` and are imported by the frontend through the configured TypeScript path alias.

## Backend Conventions

- Prefer `Bun.serve()` and Hono patterns already used in the backend.
- WebSocket support is built in; do not add `ws`.
- Prefer Bun-native APIs when adding new infrastructure:
  - `Bun.redis` for Redis.
  - `Bun.sql` for Postgres when introducing new direct SQL code.
  - `bun:sqlite` for SQLite.
- Do not add Express.
- Keep request/response and WebSocket event contracts validated with Zod.
- Keep database schema changes in Drizzle migrations.

## Frontend Conventions

- Use the existing Next.js App Router structure.
- Use the existing UI primitives in `frontend/components/ui` before adding new primitives.
- Use the typed Hono client in `frontend/lib/api-client.ts` for backend HTTP calls.
- Use contracts from `@backend/contracts/*` instead of duplicating frontend-only DTO types.

## Quality Checks

Run the smallest relevant checks for the change:

```sh
bun --cwd backend run typecheck
bun --cwd frontend run typecheck
bun --cwd frontend run lint
```

For tests, use:

```sh
bun test
```

## Repository Hygiene

- Keep `AGENTS.md` as the single source of agent instructions.
- `CLAUDE.md` should be a symlink to `AGENTS.md`.
- Do not keep separate agent instruction files inside `backend/` or `frontend/`.
- Do not revert user changes unless explicitly asked.
