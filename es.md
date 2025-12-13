# Hono Chat (ES)

Chat en tiempo real por salas (URL) construido como monorepo con Bun workspaces. Frontend en Next.js (App Router) y backend en Hono sobre Bun, con persistencia en PostgreSQL (Drizzle ORM).

## Qué ofrece

- Salas: crear, listar, ver y eliminar
- Mensajería en vivo por WebSockets (`/ws`) + historial persistido
- API HTTP bajo `/api` con validación (Zod) y DTOs tipados
- Tipado end-to-end: el frontend consume la API con `hono/client` y comparte tipos/eventos desde el backend

## Stack

- Frontend: Next.js + React + TypeScript, TailwindCSS, Radix UI, Zustand
- Backend: Hono + Bun, Zod, Drizzle ORM
- DB: PostgreSQL
- Infra: Docker Compose (local y VPS), build “standalone” para Next
