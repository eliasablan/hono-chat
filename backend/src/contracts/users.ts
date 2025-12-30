import { z } from "zod";

const userName = z.string().trim().min(1).max(100);

// DTO de usuario
export const userDTO = z.object({
  id: z.uuid(),
  name: userName,
});

export type UserDTO = z.infer<typeof userDTO>;

// Input para crear usuario
export const createUserInput = z.object({
  name: userName,
});

export type CreateUserInput = z.infer<typeof createUserInput>;

export const createUserResponse = userDTO;

export type CreateUserResponse = z.infer<typeof createUserResponse>;
