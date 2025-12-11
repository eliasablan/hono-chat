import { z } from "zod";

// DTO de mensaje
export const messageDTO = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  createdAt: z.string(), // ISO string
});

export type MessageDTO = z.infer<typeof messageDTO>;

// Input para crear mensaje
export const createMessageInput = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export type CreateMessageInput = z.infer<typeof createMessageInput>;
