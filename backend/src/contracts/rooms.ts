import { z } from "zod";

const roomName = z.string().trim().min(1).max(100);

// DTO de sala de chat
export const roomDTO = z.object({
  id: z.uuid(),
  name: roomName,
});

export type RoomDTO = z.infer<typeof roomDTO>;

// Input para crear sala
export const createRoomInput = z.object({
  name: roomName,
});

export type CreateRoomInput = z.infer<typeof createRoomInput>;

// Input para eliminar sala
export const deleteRoomInput = z.object({
  id: z.uuid(),
});

export type DeleteRoomInput = z.infer<typeof createRoomInput>;
