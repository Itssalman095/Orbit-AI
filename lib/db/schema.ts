import { nanoid } from "nanoid";
import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const bots = pgTable(
  "bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Third-party ID (Clerk user ID, e.g. "user_2abc...")
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    // Nanoid seed for the bot's face
    avatar: text("avatar")
      .notNull()
      .$defaultFn(() => nanoid()),
    // What the bot is for, in a phrase
    job: text("job").notNull(),
    // How it should go about the job
    instructions: text("instructions"),
    // Daytona sandbox ID, created with the bot and removed with it
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)],
);

export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;

export const chatKind = pgEnum("chat_kind", ["direct", "group"]);

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Third-party ID (Clerk user ID) of the chat's owner
    userId: text("user_id").notNull(),
    kind: chatKind("kind").default("direct").notNull(),
    // Null for direct chats, which use the bot's name
    name: text("name"),
    lastMessagePreview: text("last_message_preview").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("chats_user_id_idx").on(table.userId)],
);

export const chatMembers = pgTable(
  "chat_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("chat_members_chat_id_bot_id_unique").on(table.chatId, table.botId),
    index("chat_members_bot_id_idx").on(table.botId),
  ],
);

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}));

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, { fields: [chatMembers.chatId], references: [chats.id] }),
  bot: one(bots, { fields: [chatMembers.botId], references: [bots.id] }),
}));

export const botsRelations = relations(bots, ({ many }) => ({
  chatMembers: many(chatMembers),
}));

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type ChatMember = typeof chatMembers.$inferSelect;
export type NewChatMember = typeof chatMembers.$inferInsert;
export type ChatKind = (typeof chatKind.enumValues)[number];

// Durable facts about the USER, shared across all their bots and chats.
// Keyed by (userId, key) so a correction overwrites the old value instead of
// piling up contradictory records.
export const memoryCategory = pgEnum("memory_category", [
  "personal_fact",
  "preference",
  "relationship",
  "goal",
  "instruction",
]);

export const memories = pgTable(
  "memories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Third-party ID (Clerk user ID) the fact belongs to — never a bot or chat.
    userId: text("user_id").notNull(),
    // Short snake_case identifier, e.g. "cat_name"
    key: text("key").notNull(),
    // The fact itself, e.g. "XYZ"
    value: text("value").notNull(),
    category: memoryCategory("category").default("personal_fact").notNull(),
    // Chat the fact was learned in, for provenance only — never used for access
    sourceChatId: text("source_chat_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("memories_user_id_key_unique").on(table.userId, table.key),
    index("memories_user_id_idx").on(table.userId),
  ],
);

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type MemoryCategory = (typeof memoryCategory.enumValues)[number];
