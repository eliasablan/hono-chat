import { z } from "zod";

const userName = z.string().trim().min(1).max(100);

export const userDTO = z.object({
  id: z.uuid(),
  name: userName,
});

export type UserDTO = z.infer<typeof userDTO>;

export const createUserInput = z.object({
  name: userName,
});

export type CreateUserInput = z.infer<typeof createUserInput>;
