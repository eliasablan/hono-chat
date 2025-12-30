# hono-chat

Monorepo (Bun workspaces) con:

- **backend**: API HTTP + WebSockets (Hono sobre Bun) + Postgres (Drizzle ORM)
- **frontend**: Next.js (App Router) que consume la API y escucha eventos por WS

## Requisitos

- Bun
- Docker (recomendado para levantar Postgres)

## Puertos y URLs

- **Frontend (Next)**: `http://localhost:3000` (por defecto)
- **Backend (Hono/Bun)**: `http://localhost:8787` (por defecto)
- **WebSocket**: `ws://localhost:8787/ws`
- **Postgres**: `localhost:5432` (si lo levantás con Docker)

En `compose.vps.yml` el frontend se expone como `127.0.0.1:5016->3000` y el backend como `127.0.0.1:8787->8787`. También incluye `pgadmin` (por defecto `127.0.0.1:5057->80`).

## Cómo correrlo (desarrollo)

1. Instalar dependencias (workspaces):

```bash
bun install
```

2. Levantar Postgres (solo DB):

```bash
docker compose up -d postgres
```

3. Backend (migraciones + server):

```bash
bun --cwd backend run start
```

En modo watch:

```bash
bun --cwd backend run dev
```

4. Frontend (Next dev server):

```bash
bun --cwd frontend run dev
```

Abrí `http://localhost:3000`.

## Variables de entorno

### Backend (`backend/.env`)

El backend usa:

- `PORT` (default `8787`)
- `DATABASE_URL` (requerida, ej. `postgres://user:pass@localhost:5432/test-hono-chat`)

Los campos `DB_*` existen en `backend/.env` pero el código conecta usando únicamente `DATABASE_URL` (ver `backend/src/db/client.ts`).

### Frontend (`frontend/.env`)

- `NEXT_PUBLIC_API_URL` (usado en desarrollo como base URL del cliente HTTP)
- `NEXT_PUBLIC_WS_URL` (hoy no se usa en el código; ver nota más abajo)

Nota: el frontend, cuando se build-ea en modo producción, asume **mismo origen** para `/api/*` y `/ws` (base URL vacía + WS a `/<host>/ws`). Para deploy suele requerir un reverse proxy que enrute:

- `/` → frontend
- `/api/*` → backend
- `/ws` → backend

## Backend

### Stack

- Runtime/Server: **Bun** (`Bun.serve`)
- Framework: **Hono**
- Validación: **Zod** + `@hono/zod-validator`
- DB: **Postgres** + **Drizzle ORM** (`drizzle-orm/postgres-js`)
- Logs: `hono/logger`
- CORS: `hono/cors`

Dependencias: `backend/package.json`.

### API HTTP (tipada)

El backend monta la API bajo `basePath("/api")`:

- `GET /api/rooms` → lista salas
- `POST /api/rooms` → crea sala `{ name }`
- `GET /api/rooms/:roomId` → obtiene sala
- `DELETE /api/rooms/:roomId` → borra sala y sus mensajes
- `GET /api/rooms/:roomId/messages` → historial de mensajes (incluye `authorName`)
- `POST /api/users` → crea usuario `{ name }`

Validación:

- Body JSON con `zValidator("json", ...)` para crear salas/usuarios.
- Params con `zValidator("param", z.object({ roomId: z.uuid() }))`.
- Respuestas se validan con contratos Zod por endpoint (inputs y outputs).

### CORS

Se aplica a todas las rutas HTTP:

```ts
app.use("/*", cors({ origin: "*" }));
```

### Base de datos

Esquema Drizzle en `backend/src/db/schema.ts`:

- `users`: `id`, `name`
- `rooms`: `id`, `name`
- `messages`: `id`, `roomId`, `authorId`, `content`, `createdAt`

Migraciones en `backend/drizzle/*`. En Docker, el backend corre `drizzle-kit migrate` antes de iniciar (script `backend:start`).

Nota: las migraciones usan `gen_random_uuid()` (por `defaultRandom()`), que requiere tener habilitada la extensión **pgcrypto** en la DB:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### WebSockets (`GET /ws`)

El WS se “upgradea” con `upgradeWebSocket` (Hono/Bun). El backend mantiene un mapa en memoria:

- `Map<roomId, Set<ServerWebSocket>>`

Esto implica que el broadcast es **in-memory** (no sirve para múltiples réplicas sin un pub/sub externo).

#### Eventos (protocol)

Los eventos son JSON con `type` (discriminated union) definidos en `backend/src/contracts/events.ts`.

Cliente → servidor (`ClientToServerEvent`):

- `join-room`: `{ roomId }`
- `leave-room`: `{ roomId }`
- `send-message`: `{ roomId, authorId, content }`

Servidor → cliente (`ServerToClientEvent`):

- `room-joined`: `{ roomId }` (respuesta al `join-room`)
- `room-left`: `{ roomId }` (respuesta al `leave-room`)
- `message-created`: `{ message: { id, roomId, authorId, authorName, content, createdAt } }` (broadcast a la sala)

Comportamiento importante:

- Si llega `send-message` y el socket no está unido a esa sala, el backend lo mueve a esa sala y luego procesa el mensaje.
- El backend persiste el mensaje en Postgres y luego hace broadcast a todos los sockets de la sala.
- En caso de error al crear mensaje, puede enviar un payload no tipado:
  - `{ type: "error", code: "message-create-failed", roomId }`

## Frontend

### Stack

- Next.js (App Router) + React
- UI: TailwindCSS + Radix UI + Lucide
- Estado: Zustand (persistido en `localStorage`)

Dependencias: `frontend/package.json`.

### Cliente HTTP tipado (Hono client)

El frontend usa `hono/client` para generar un cliente tipado desde el tipo exportado por el backend:

- Backend exporta `export type AppType = typeof api;` en `backend/src/app.ts`
- Frontend crea `apiClient` en `frontend/lib/api-client.ts`:
  - `hc<AppType>(baseUrl)`

Esto permite llamadas tipadas como:

- `apiClient.api.rooms.$get()`
- `apiClient.api.rooms[":roomId"].messages.$get({ param: { roomId } })`

### Tipos compartidos TypeScript (sin paquete npm)

El frontend importa tipos y contratos directamente desde el código del backend usando `paths` en `frontend/tsconfig.json`:

```json
{
  "paths": {
    "@backend/*": ["../backend/src/*"]
  }
}
```

Se comparten contratos por endpoint (inputs/outputs) y eventos de WS
(`ClientToServerEvent`, `ServerToClientEvent`).

### WebSocket (reconexión + “sticky join”)

La conexión se maneja en `frontend/lib/ws.ts`:

- Cola de eventos mientras no hay conexión (`pending`)
- “Sticky join”: re-envía `join-room` al reconectar
- Reintentos con backoff exponencial + jitter
- Maneja mensajes `type: "error"` logueándolos

## Docker

### `compose.yml` (local)

Servicios:

- `postgres`: Postgres 15
- `backend`: expone `${BACKEND_PORT:-8787}`
- `frontend`: expone `${FRONTEND_PORT:-3000}`

Imágenes/build:

- `backend/Dockerfile`: instala deps del workspace y corre `bun run start` (migrate + server)
- `frontend/Dockerfile`: build de Next standalone con soporte para importar tipos del backend

### `compose.vps.yml` (VPS)

Orienta el deploy usando imágenes `ghcr.io/eliasablan/hono-chat-*` e incluye `pgadmin`.

## Scripts útiles

Backend:

- `bun --cwd backend run dev`
- `bun --cwd backend run typecheck`
- `bun --cwd backend run db:generate`
- `bun --cwd backend run db:migrate`

Frontend:

- `bun --cwd frontend run dev`
- `bun --cwd frontend run build`
- `bun --cwd frontend run start`
- `bun --cwd frontend run typecheck`
