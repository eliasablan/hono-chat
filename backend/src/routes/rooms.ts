import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@backend/db/client";
import z from "zod";
import { messages, rooms, users } from "@backend/db/schema";
import { eq } from "drizzle-orm";
import {
  createRoomInput,
  createRoomResponse,
  deleteRoomResponse,
  getRoomResponse,
  listRoomsResponse,
} from "@backend/contracts/rooms";
import { listRoomMessagesResponse } from "@backend/contracts/chat";
import { getRoomConnectionCount } from "@backend/lib/ws-store";

export const roomsApp = new Hono()
  .get("/", async (c) => {
    const rows = await db.query.rooms.findMany({
      with: {
        messages: true,
      },
    });

    const result = rows.map((room) => ({
      ...room,
      activeConnections: getRoomConnectionCount(room.id),
    }));

    return c.json(listRoomsResponse.parse(result));
  })
  .post("/", zValidator("json", createRoomInput), async (c) => {
    const { name, createdBy } = c.req.valid("json");

    try {
      const [createdRoom] = await db
        .insert(rooms)
        .values({ name, createdBy })
        .returning();
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
