import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@backend/db/client";
import { users } from "@backend/db/schema";
import { createUserInput, createUserResponse } from "@backend/contracts/users";

export const usersApp = new Hono().post(
  "/",
  zValidator("json", createUserInput),
  async (c) => {
    const { name } = c.req.valid("json");

    try {
      const [newUser] = await db.insert(users).values({ name }).returning();
      if (!newUser) return c.text("Failed to create user", 500);

      const dto = createUserResponse.parse(newUser);
      return c.json(dto, 201);
    } catch (error) {
      console.error("Error creating user:", error);
      return c.text("Internal Server Error", 500);
    }
  },
);
