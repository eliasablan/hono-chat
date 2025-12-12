import { relations } from "drizzle-orm";
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
});

export const roomsRelations = relations(rooms, ({ many }) => ({
  messages: many(messages),
}));

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  content: varchar("content", { length: 2000 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
  room: one(rooms, { fields: [messages.roomId], references: [rooms.id] }),
}));

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
