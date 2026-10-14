import { z } from "zod"

const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(64, "Keep the name under 64 characters")

// Group chats are assembled from existing bots, so the payload is the chat's
// name plus the bot ids to admit as members — not a column-for-column insert.
export const createGroupChatSchema = z.object({
  name: groupNameSchema,
  // A group is at least two bots; the ids are re-validated against the
  // session user's bots inside the server action.
  botIds: z
    .array(z.string())
    .min(2, "Pick at least 2 bots")
    .max(10, "Keep groups under 10 bots"),
})

export type CreateGroupChatInput = z.output<typeof createGroupChatSchema>

// Renaming an existing group — members are managed through dedicated
// add/remove actions, not the rename payload.
export const updateGroupChatSchema = z.object({
  name: groupNameSchema,
})

export type UpdateGroupChatInput = z.output<typeof updateGroupChatSchema>

// Adding or removing one bot on an existing group — the ids are
// re-validated against the chat and the session user's bots inside the
// server action.
export const groupMemberSchema = z.object({
  chatId: z.string().min(1),
  botId: z.string().min(1),
})

export type GroupMemberInput = z.output<typeof groupMemberSchema>
