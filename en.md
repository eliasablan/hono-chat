# Hono Chat (EN)

Real-time, room-based (URL) chat built as a Bun workspaces monorepo. Next.js (App Router) frontend + Hono-on-Bun backend, with PostgreSQL persistence via Drizzle ORM.

## Highlights

- Rooms: create, list, fetch, and delete
- Live messaging over WebSockets (`/ws`) plus persisted message history
- HTTP API under `/api` with Zod validation and typed DTOs
- End-to-end typing: frontend uses `hono/client` and shares types/events directly from the backend

## Tech Stack

- Frontend: Next.js + React + TypeScript, TailwindCSS, Radix UI, Zustand
- Backend: Hono + Bun, Zod, Drizzle ORM
- DB: PostgreSQL
- Infra: Docker Compose (local + VPS), Next “standalone” build
