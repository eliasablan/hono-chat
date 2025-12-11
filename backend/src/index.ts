import { websocket } from "hono/bun";
import app from "./app";

const port = Number(process.env.PORT ?? 8787);

Bun.serve({
  fetch: app.fetch,
  port,
  websocket,
});

console.log(`Backend listening on http://localhost:${port}`);
