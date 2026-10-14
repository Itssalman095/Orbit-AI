import { z } from "zod"

// Deleting one of the user's global memories by its key. The user comes from
// the session inside the server action, never from the payload.
export const deleteMemorySchema = z.object({
  key: z.string().trim().min(1).max(64),
})

export type DeleteMemoryInput = z.output<typeof deleteMemorySchema>
