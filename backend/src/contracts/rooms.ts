import { z } from "zod";
import { messageDTO } from "./chat";

const roomName = z.string().trim().min(1).max(100);

// DTO de sala de chat
export const roomDTO = z.object({
  id: z.uuid(),
  name: roomName,
  createdBy: z.uuid(),
});

export type RoomDTO = z.infer<typeof roomDTO>;

export const roomWithMessagesDTO = roomDTO.extend({
  messages: z.array(messageDTO),
});

export type RoomWithMessagesDTO = z.infer<typeof roomWithMessagesDTO>;

export const roomWithMessagesAndConnectionsDTO = roomWithMessagesDTO.extend({
  activeConnections: z.number().nonnegative().default(0),
});

export type RoomWithMessagesAndConnectionsDTO = z.infer<
  typeof roomWithMessagesAndConnectionsDTO
>;

export const listRoomsResponse = z.array(roomWithMessagesAndConnectionsDTO);

export type ListRoomsResponse = z.infer<typeof listRoomsResponse>;

export const getRoomResponse = roomDTO;

export type GetRoomResponse = z.infer<typeof getRoomResponse>;

// Input para crear sala
export const createRoomInput = z.object({
  name: roomName,
  createdBy: z.uuid(),
});

export type CreateRoomInput = z.infer<typeof createRoomInput>;

export const createRoomResponse = roomDTO;

export type CreateRoomResponse = z.infer<typeof createRoomResponse>;

// Input para eliminar sala
export const deleteRoomInput = z.object({
  id: z.uuid(),
});

export type DeleteRoomInput = z.infer<typeof deleteRoomInput>;

export const deleteRoomResponse = roomDTO;

export type DeleteRoomResponse = z.infer<typeof deleteRoomResponse>;
