import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import type { WSContext } from "hono/ws";
import { upgradeWebSocket } from "hono/bun";
import { logger } from "hono/logger";
import type { ServerWebSocket } from "bun";
import { db } from "@backend/db/client";
import z from "zod";
import { messages, rooms, users } from "@backend/db/schema";
import { eq, sql } from "drizzle-orm";
import { createUserInput, createUserResponse } from "@backend/contracts/users";
import {
  createRoomInput,
  createRoomResponse,
  deleteRoomResponse,
  getRoomResponse,
  listRoomsResponse,
} from "@backend/contracts/rooms";
import { listRoomMessagesResponse } from "@backend/contracts/chat";
import {
  clientToServerEvent,
  serverToClientEvent,
} from "@backend/contracts/events";

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
})

// --- WebSocket State ---
type RoomId = string;
type Socket = ServerWebSocket;
const roomSockets = new Map<RoomId, Set<Socket>>();

function getOrCreateRoomClients(roomId: RoomId): Set<Socket> {
  const existing = roomSockets.get(roomId);
  if (existing) return existing;

  const clients = new Set<Socket>();
  roomSockets.set(roomId, clients);
  return clients;
}

function removeSocketFromAllRooms(socket: Socket) {
  for (const [roomId, clients] of roomSockets) {
    if (!clients.delete(socket)) continue;
    if (clients.size === 0) roomSockets.delete(roomId);
  }
}

function broadcastToRoom(roomId: RoomId, payload: unknown) {
  const clients = roomSockets.get(roomId);
  if (!clients) return;

  const message = JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState !== 1) {
      clients.delete(client);
      continue;
    }

    try {
      const status = client.send(message);
      if (status === 0) clients.delete(client);
    } catch {
      clients.delete(client);
    }
  }

  if (clients.size === 0) roomSockets.delete(roomId);
}

const roomsApp = new Hono()
  .get("/", async (c) => {
    const rows = await db.query.rooms.findMany({
      with: {
        messages: true,
      },
    });

    const result = rows.map((room) => ({
      ...room,
      activeConnections: roomSockets.get(room.id)?.size ?? 0,
    }));

    return c.json(listRoomsResponse.parse(result));
  })
  .post("/", zValidator("json", createRoomInput), async (c) => {
    const { name } = c.req.valid("json");

    try {
      const [createdRoom] = await db.insert(rooms).values({ name }).returning();
      if (!createdRoom) return c.text("Failed to create room", 500);

      const dto = createRoomResponse.parse(createdRoom);
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
        return c.json(getRoomResponse.parse(createdRoom));
      } catch (error) {
        console.error("Error retrieving room:", error);
        return c.text("Internal Server Error", 500);
      }
    },
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
        return c.json(deleteRoomResponse.parse(deletedRoom));
      } catch (error) {
        console.error("Error deleting room:", error);
        return c.text("Internal Server Error", 500);
      }
    },
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

      return c.json(listRoomMessagesResponse.parse(result));
    },
  );

const usersApp = new Hono().post(
  "/",
  zValidator("json", createUserInput),
  async (c) => {
    const { name } = c.req.valid("json");

    try {
      const [newUser] = await db.insert(users).values({ name }).returning();
      if (!newUser) return c.text("Failed to create user", 500);

      const dto = createUserResponse.parse(newUser);
      return c.json(dto, 201);
    } catch (error) {
      console.error("Error creating user:", error);
      return c.text("Internal Server Error", 500);
    }
  },
);

const api = app
  .basePath("/api")
  .route("/rooms", roomsApp)
  .route("/users", usersApp);

app.get(
  "/ws",
  upgradeWebSocket((_c) => {
    let currentRoom: string | null = null;

    return {
      async onMessage(event, ws) {
        const socket = ws.raw as Socket | undefined;
        if (!socket) return;

        let parsed: z.infer<typeof clientToServerEvent>;
        try {
          const raw = event.data;
          const text =
            typeof raw === "string"
              ? raw
              : raw instanceof Blob
                ? await raw.text()
                : new TextDecoder().decode(new Uint8Array(raw));
          parsed = clientToServerEvent.parse(JSON.parse(text));
        } catch (error) {
          console.error("WS invalid message:", error);
          return;
        }

        try {
          if (parsed.type === "join-room") {
            removeSocketFromAllRooms(socket);
            currentRoom = parsed.roomId;

            const clients = getOrCreateRoomClients(currentRoom);
            clients.add(socket);

            const payload = serverToClientEvent.parse({
              type: "room-joined",
              roomId: currentRoom,
            });
            socket.send(JSON.stringify(payload));
            return;
          }

          if (parsed.type === "leave-room") {
            if (currentRoom !== parsed.roomId) return;
            removeSocketFromAllRooms(socket);

            const payload = serverToClientEvent.parse({
              type: "room-left",
              roomId: parsed.roomId,
            });
            socket.send(JSON.stringify(payload));
            currentRoom = null;
            return;
          }

          if (parsed.type === "send-message") {
            const roomId = parsed.roomId;

            if (currentRoom !== roomId) {
              removeSocketFromAllRooms(socket);
              currentRoom = roomId;
              getOrCreateRoomClients(roomId).add(socket);
            }

            try {
              const [createdMessage] = await db
                .insert(messages)
                .values({
                  roomId,
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
              const message = { ...createdMessage, authorName: user.name };

              const payload = serverToClientEvent.parse({
                type: "message-created",
                message,
              });

              broadcastToRoom(roomId, payload);
            } catch (error) {
              console.error("WS send-message error:", error);
              try {
                socket.send(
                  JSON.stringify({
                    type: "error",
                    code: "message-create-failed",
                    roomId,
                  }),
                );
              } catch { }
            }
          }
        } catch (error) {
          console.error("WS handler error:", error);
        }
      },
      onClose(_event, ws) {
        const socket = ws.raw as Socket | undefined;
        if (!socket) return;
        removeSocketFromAllRooms(socket);
        currentRoom = null;
      },
      onError(_event, ws) {
        const socket = ws.raw as Socket | undefined;
        if (!socket) return;
        removeSocketFromAllRooms(socket);
        currentRoom = null;
      },
    };
  }),
);

export type AppType = typeof api;

export default app;
