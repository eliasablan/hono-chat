import { z } from "zod";
import { messageDTO } from "./chat";

export const clientToServerEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join-room"),
    roomId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("leave-room"),
    roomId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("send-message"),
    roomId: z.string().uuid(),
    content: z.string().min(1).max(2000),
  }),
]);

export type ClientToServerEvent = z.infer<typeof clientToServerEvent>;

export const serverToClientEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message-created"),
    message: messageDTO,
  }),
  z.object({
    type: z.literal("room-joined"),
    roomId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("room-left"),
    roomId: z.string().uuid(),
  }),
]);

export type ServerToClientEvent = z.infer<typeof serverToClientEvent>;
