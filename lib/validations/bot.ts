import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

import { bots } from "@/lib/db/schema"

// Insert schema for the bots table, generated from the Drizzle table
// definition, with per-column rules layered on top of the inferred types.
export const insertBotSchema = createInsertSchema(bots, {
  name: (schema) => schema.trim().min(1, "Name is required").max(64),
  job: (schema) => schema.trim().min(1, "Job is required").max(120),
  instructions: (schema) =>
    schema.max(2000, "Keep instructions under 2000 characters"),
  avatar: (schema) => schema.min(1).max(64),
})

export type InsertBot = z.output<typeof insertBotSchema>

// What the client may send: the user-editable columns only. The owner
// (userId) is derived from the Clerk session inside the server action.
export const createBotSchema = insertBotSchema.pick({
  name: true,
  job: true,
  instructions: true,
  avatar: true,
})

export type CreateBotInput = z.output<typeof createBotSchema>
