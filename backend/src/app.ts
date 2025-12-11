import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { createMessageInput, messageDTO } from "@contracts/chat";
import { createUserInput, userDTO } from "@contracts/users";
import { createRoomInput, roomDTO } from "@contracts/rooms";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { clientToServerEvent, serverToClientEvent } from "@contracts/events";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { messages, rooms, users } from "./db/schema";

const MOCK_AUTHOR_ID = "8b48593b-18e9-4bc4-9692-6ceb23544636";

const app = new Hono();

// CORS para frontend en localhost:3000 (o cualquier origen en dev)
app.use("/*", cors({ origin: "*" }));

// --- Sub-apps ---
const roomsApp = new Hono()
  .get("/", async (c) => {
    const rows = await db.select().from(rooms).orderBy(rooms.name);
    return c.json(rows);
  })
  .post("/", zValidator("json", createRoomInput), async (c) => {
    const { name } = c.req.valid("json");

    try {
      const [newRoom] = await db.insert(rooms).values({ name }).returning();
      if (!newRoom) return c.text("Failed to create room", 500);

      const dto = roomDTO.parse({ id: newRoom.id, name: newRoom.name });
      return c.json(dto, 201);
    } catch (error) {
      console.error("Error creating room:", error);
      return c.text("Internal Server Error", 500);
    }
  })
  .delete("/:roomId", async (c) => {
    const roomId = c.req.param("roomId");

    try {
      await db.delete(messages).where(eq(messages.roomId, roomId));
      const [deletedRoom] = await db
        .delete(rooms)
        .where(eq(rooms.id, roomId))
        .returning();

      if (!deletedRoom) return c.text("Room not found", 404);
      return c.json(roomDTO.parse({ id: deletedRoom.id, name: deletedRoom.name }));
    } catch (error) {
      console.error("Error deleting room:", error);
      return c.text("Internal Server Error", 500);
    }
  })
  .get("/:roomId/messages", async (c) => {
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

const usersApp = new Hono()
  .post("/", zValidator("json", createUserInput), async (c) => {
    const { name } = c.req.valid("json");

    try {
      const [newUser] = await db.insert(users).values({ name }).returning();
      if (!newUser) return c.text("Failed to create user", 500);

      const dto = userDTO.parse({ id: newUser.id, name: newUser.name });
      return c.json(dto, 201);
    } catch (error) {
      console.error("Error creating user:", error);
      return c.text("Internal Server Error", 500);
    }
  })
  .get("/:userId", async (c) => {
    const userId = c.req.param("userId");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return c.text("User not found", 404);
    return c.json(userDTO.parse({ id: user.id, name: user.name }));
  });

const messagesApp = new Hono()
  .post("/", zValidator("json", createMessageInput), async (c) => {
    const { roomId, content } = c.req.valid("json");

    // TODO: obtener authorId real (usuario logueado); por ahora mock
    const authorId = MOCK_AUTHOR_ID;

    const [inserted] = await db
      .insert(messages)
      .values({ roomId, content, authorId })
      .returning();

    if (!inserted) return c.text("Failed to create message", 500);

    const dto = messageDTO.parse({
      id: inserted.id,
      roomId: inserted.roomId,
      authorId: inserted.authorId,
      content: inserted.content,
      createdAt: inserted.createdAt.toISOString(),
    });

    return c.json(dto, 201);
  })
  .delete("/:messageId", async (c) => {
    const messageId = c.req.param("messageId");
    const [deleted] = await db
      .delete(messages)
      .where(eq(messages.id, messageId))
      .returning();

    if (!deleted) return c.text("Message not found", 404);
    return c.json(messageDTO.parse({
      id: deleted.id,
      roomId: deleted.roomId,
      authorId: deleted.authorId,
      content: deleted.content,
      createdAt: deleted.createdAt.toISOString(),
    }));
  });

// --- API HTTP tipo-safe (basePath /api) ---
const api = app
  .basePath("/api")
  .route("/rooms", roomsApp)
  .route("/users", usersApp)
  .route("/messages", messagesApp);

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

        if (parsed.type === "send-message" && currentRoom) {
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
