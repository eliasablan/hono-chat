import { upgradeWebSocket } from "hono/bun";
import { db } from "@backend/db/client";
import { messages, users } from "@backend/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  clientToServerEvent,
  serverToClientEvent,
} from "@backend/contracts/events";
import {
  type Socket,
  getOrCreateRoomClients,
  removeSocketFromAllRooms,
  broadcastToRoom,
} from "@backend/lib/ws-store";

export const wsHandler = upgradeWebSocket((_c) => {
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
});
