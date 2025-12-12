import { z } from "zod";
import { messageDTO } from "./chat";

// Incoming Event from Client Websocket
export const clientToServerEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join-room"),
    roomId: z.uuid(),
  }),
  z.object({
    type: z.literal("leave-room"),
    roomId: z.uuid(),
  }),
  z.object({
    type: z.literal("send-message"),
    roomId: z.uuid(),
    authorId: z.uuid(),
    content: z.string().min(1).max(2000),
  }),
]);

export type ClientToServerEvent = z.infer<typeof clientToServerEvent>;

// Outcoming Event to Client Websocket
export const serverToClientEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message-created"),
    message: messageDTO.extend({
      authorName: z.string(),
    }),
  }),
  z.object({
    type: z.literal("room-joined"),
    roomId: z.uuid(),
  }),
  z.object({
    type: z.literal("room-left"),
    roomId: z.uuid(),
  }),
]);

export type ServerToClientEvent = z.infer<typeof serverToClientEvent>;
