"use server"

import { auth } from "@clerk/nextjs/server"

import { deleteMemory } from "@/lib/memory"
import {
  deleteMemorySchema,
  type DeleteMemoryInput,
} from "@/lib/validations/memory"

export type DeleteMemoryResult =
  | { success: true }
  | { success: false; error: string }

// Removes one of the signed-in user's global memories. No revalidatePath —
// memories are only rendered inside the model's instructions, not on a page.
export async function deleteMemoryAction(
  input: DeleteMemoryInput
): Promise<DeleteMemoryResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const parsed = deleteMemorySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid request." }
  }

  await deleteMemory(userId, parsed.data.key)
  return { success: true }
}
