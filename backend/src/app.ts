import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { db } from "./db/client";
import { messages, rooms } from "./db/schema";
import { createMessageInput, messageDTO } from "@contracts/chat";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import {
  clientToServerEvent,
  serverToClientEvent,
} from "@contracts/events";
import { eq } from "drizzle-orm";

const MOCK_AUTHOR_ID = "8b48593b-18e9-4bc4-9692-6ceb23544636";

const app = new Hono();

// CORS para frontend en localhost:3000 (o cualquier origen en dev)
app.use("/*", cors({ origin: "*" }));

// --- API HTTP tipo-safe (basePath /api) ---
const api = app
  .basePath("/api")
  // Crear mensaje
  .post("/messages", zValidator("json", createMessageInput), async (c) => {
    const { roomId, content } = c.req.valid("json");

    // TODO: obtener authorId real (usuario logueado); por ahora mock
    const authorId = MOCK_AUTHOR_ID;

    const [inserted] = await db
      .insert(messages)
      .values({ roomId, content, authorId })
      .returning();

    if (!inserted) return;

    const dto = messageDTO.parse({
      id: inserted.id,
      roomId: inserted.roomId,
      authorId: inserted.authorId,
      content: inserted.content,
      createdAt: inserted.createdAt.toISOString(),
    });

    return c.json(dto);
  })
  .get("/rooms", async (c) => {
    const rows = await db.select().from(rooms).orderBy(rooms.name);

    return c.json(rows);
  })
  // Listar mensajes de una sala
  .get("/rooms/:roomId/messages", async (c) => {
    const roomId = c.req.param("roomId");

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(messages.createdAt);

    const result = rows.map((m) =>
      messageDTO.parse({
        id: m.id,
        roomId: m.roomId,
        authorId: m.authorId,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })
    );

    return c.json(result);
  });

// --- WebSocket /ws ---
type RoomId = string;
const roomSockets = new Map<RoomId, Set<WSContext>>();

app.get(
  "/ws",
  upgradeWebSocket((_c) => {
    let currentRoom: string | null = null;

    return {
      async onMessage(event, ws) {
        const data = JSON.parse(event.data.toString());
        const parsed = clientToServerEvent.parse(data);
        currentRoom = parsed.roomId;
        console.log({ data });

        if (parsed.type === "join-room") {
          if (!roomSockets.has(currentRoom))
            roomSockets.set(currentRoom, new Set());
          roomSockets.get(currentRoom)!.add(ws);

          const payload = serverToClientEvent.parse({
            type: "room-joined",
            roomId: currentRoom,
          });
          ws.send(JSON.stringify(payload));
        }

        if (parsed.type === "leave-room" && currentRoom) {
          roomSockets.get(currentRoom)?.delete(ws);
          const payload = serverToClientEvent.parse({
            type: "room-left",
            roomId: currentRoom,
          });
          ws.send(JSON.stringify(payload));
          currentRoom = null;
        }

        console.log({ currentRoom });
        if (parsed.type === "send-message" && currentRoom) {
          console.log({ returned: parsed.roomId !== currentRoom });
          if (parsed.roomId !== currentRoom) return;
          const [inserted] = await db
            .insert(messages)
            .values({
              roomId: currentRoom,
              authorId: MOCK_AUTHOR_ID,
              content: parsed.content,
            })
            .returning();

          if (!inserted) return;

          const payload = serverToClientEvent.parse({
            type: "message-created",
            message: {
              id: inserted.id,
              roomId: inserted.roomId,
              authorId: inserted.authorId,
              content: inserted.content,
              createdAt: inserted.createdAt.toISOString(),
            },
          });

          const clients = roomSockets.get(currentRoom) ?? new Set();
          for (const client of clients) {
            client.send(JSON.stringify(payload));
          }
        }
      },
      onClose(_event, ws) {
        if (!currentRoom) return;

        roomSockets.get(currentRoom)?.delete(ws);

        if (roomSockets.get(currentRoom)?.size === 0) {
          roomSockets.delete(currentRoom);
        }

        currentRoom = null;
      },
    };
  })
);

// Exportamos solo la parte de API para el cliente de Hono
export type AppType = typeof api;

export default app;
