import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "@backend/db/client";
import { sql } from "drizzle-orm";
import { roomsApp } from "@backend/routes/rooms";
import { usersApp } from "@backend/routes/users";
import { wsHandler } from "@backend/ws/handler";

// --- typesafe HTTP API ---
const app = new Hono();

// 1. Configuración básica
app.use("/*", cors({ origin: "*" }));
app.use(logger());

// 2. Middleware de Validación de Base de Datos
app.use("/api/*", async (c, next) => {
  try {
    // Ejecutamos una consulta ultra rápida para verificar la conexión
    await db.execute(sql`SELECT 1`);
    await next();
  } catch (error) {
    console.error("Database Connection Error:", error);

    // Retornamos un error 503 (Service Unavailable) o 500
    return c.json({
      error: "Database is not responding",
      message: "No se puede establecer conexión con la base de datos en este momento."
    }, 503);
  }
});

const api = app
  .basePath("/api")
  .route("/rooms", roomsApp)
  .route("/users", usersApp);

app.get("/ws", wsHandler);

export type AppType = typeof api;

export default app;
