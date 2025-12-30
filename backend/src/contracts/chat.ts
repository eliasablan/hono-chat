import { z } from "zod";

// DTO de mensaje
export const messageDTO = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  authorId: z.uuid(),
  content: z.string().min(1).max(2000),
  createdAt: z.coerce.date().transform((d) => d.toISOString()),
});

export type MessageDTO = z.infer<typeof messageDTO>;

export const messageWithAuthorDTO = messageDTO.extend({
  authorName: z.string(),
});

export type MessageWithAuthorDTO = z.infer<typeof messageWithAuthorDTO>;

export const listRoomMessagesResponse = z.array(messageWithAuthorDTO);

export type ListRoomMessagesResponse = z.infer<
  typeof listRoomMessagesResponse
>;

// Input para crear mensaje
export const createMessageInput = z.object({
  roomId: z.uuid(),
  authorId: z.uuid(),
  content: z.string().min(1).max(2000),
});

export type CreateMessageInput = z.infer<typeof createMessageInput>;
