import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import type { WSContext } from "hono/ws";
import { upgradeWebSocket } from "hono/bun";
import { logger } from "hono/logger";
import { db } from "@backend/db/client";
import z from "zod";
import { messages, rooms, users } from "@backend/db/schema";
import { eq } from "drizzle-orm";
import { createUserInput, userDTO } from "@backend/contracts/users";
import { createRoomInput, roomDTO } from "@backend/contracts/rooms";
import {
  clientToServerEvent,
  serverToClientEvent,
} from "@backend/contracts/events";

// --- typesafe HTTP API ---
const app = new Hono();
app.use("/*", cors({ origin: "*" }));
app.use(logger());

const roomsApp = new Hono()
  .get("/", async (c) => {
    const rows = await db.select().from(rooms).orderBy(rooms.name);
    return c.json(rows);
  })
  .post("/", zValidator("json", createRoomInput), async (c) => {
    const { name } = c.req.valid("json");

    try {
      const [createdRoom] = await db.insert(rooms).values({ name }).returning();
      if (!createdRoom) return c.text("Failed to create room", 500);

      const dto = roomDTO.parse(createdRoom);
      return c.json(dto, 201);
    } catch (error) {
      console.error("Error creating room:", error);
      return c.text("Internal Server Error", 500);
    }
  })
  .get(
    "/:roomId",
    zValidator("param", z.object({ roomId: z.uuid() })),
    async (c) => {
      const { roomId } = c.req.valid("param");

      try {
        const [createdRoom] = await db
          .select()
          .from(rooms)
          .where(eq(rooms.id, roomId))
          .limit(1);

        if (!createdRoom) return c.text("Room not found", 404);
        return c.json(roomDTO.parse(createdRoom));
      } catch (error) {
        console.error("Error retrieving room:", error);
        return c.text("Internal Server Error", 500);
      }
    }
  )
  .delete(
    "/:roomId",
    zValidator("param", z.object({ roomId: z.uuid() })),
    async (c) => {
      const { roomId } = c.req.valid("param");

      try {
        await db.delete(messages).where(eq(messages.roomId, roomId));
        const [deletedRoom] = await db
          .delete(rooms)
          .where(eq(rooms.id, roomId))
          .returning();

        if (!deletedRoom) return c.text("Room not found", 404);
        return c.json(roomDTO.parse(deletedRoom));
      } catch (error) {
        console.error("Error deleting room:", error);
        return c.text("Internal Server Error", 500);
      }
    }
  )
  .get(
    "/:roomId/messages",
    zValidator("param", z.object({ roomId: z.uuid() })),
    async (c) => {
      const { roomId } = c.req.valid("param");

      const result = await db
        .select({
          id: messages.id,
          roomId: messages.roomId,
          authorId: messages.authorId,
          authorName: users.name,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .innerJoin(users, eq(messages.authorId, users.id))
        .where(eq(messages.roomId, roomId))
        .orderBy(messages.createdAt);

      return c.json(result);
    }
  );

const usersApp = new Hono().post(
  "/",
  zValidator("json", createUserInput),
  async (c) => {
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
  }
);

const api = app
  .basePath("/api")
  .route("/rooms", roomsApp)
  .route("/users", usersApp);

// --- WebSocket ---
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

          const [createdMessage] = await db
            .insert(messages)
            .values({
              roomId: currentRoom,
              authorId: parsed.authorId,
              content: parsed.content,
            })
            .returning();

          if (!createdMessage) return;

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, createdMessage.authorId))
            .limit(1);
          if (!user) return;
          const message = { ...createdMessage, authorName: user?.name };

          const payload = serverToClientEvent.parse({
            type: "message-created",
            message,
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

export type AppType = typeof api;

export default app;
