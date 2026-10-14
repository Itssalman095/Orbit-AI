import "server-only"

import { generateText } from "ai"
import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { memories } from "@/lib/db/schema"
import { AI_MODEL_ID, nvidia } from "@/lib/ai"
import { parseExtractionOutput, type ExtractedMemory } from "@/lib/memory-shared"

export type Memory = typeof memories.$inferSelect

// Prompt budget: the newest 100 facts, most recently updated first.
const MAX_MEMORIES = 100

export async function getUserMemories(userId: string): Promise<Memory[]> {
  return db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.updatedAt))
    .limit(MAX_MEMORIES)
}

// Insert or overwrite — a corrected fact replaces the old value under the
// same (userId, key) instead of accumulating contradictions.
export async function upsertMemory(input: {
  userId: string
  key: string
  value: string
  category: ExtractedMemory["category"]
  sourceChatId?: string | null
}): Promise<void> {
  await db
    .insert(memories)
    .values({
      userId: input.userId,
      key: input.key,
      value: input.value,
      category: input.category,
      sourceChatId: input.sourceChatId ?? null,
    })
    .onConflictDoUpdate({
      target: [memories.userId, memories.key],
      set: {
        value: input.value,
        category: input.category,
        sourceChatId: input.sourceChatId ?? null,
        updatedAt: new Date(),
      },
    })
}

export async function deleteMemory(userId: string, key: string): Promise<void> {
  await db
    .delete(memories)
    .where(and(eq(memories.userId, userId), eq(memories.key, key)))
}

export async function deleteAllMemories(userId: string): Promise<void> {
  await db.delete(memories).where(eq(memories.userId, userId))
}

// One LLM turn: decide what (if anything) in the user's message is a durable
// fact, and upsert it under the user's id. The model sees the existing
// memories so corrections reuse the original key. Returns how many memories
// were written; throws on infrastructure failure — the caller decides
// whether that may interrupt the chat (it may not).
export async function extractMemories(input: {
  userId: string
  chatId: string
  message: string
}): Promise<number> {
  const existing = await getUserMemories(input.userId)
  const memoryList = existing
    .map((memory) => `- ${memory.key}: ${memory.value}`)
    .join("\n")

  const { text } = await generateText({
    model: nvidia(AI_MODEL_ID),
    temperature: 0,
    maxOutputTokens: 400,
    prompt: [
      "Extract durable facts about the user from their chat message.",
      existing.length > 0
        ? `Existing memories:\n${memoryList}`
        : "The user has no memories yet.",
      `Message: ${input.message}`,
      "",
      'Reply with ONLY JSON: {"memories":[{"key":"snake_case_key","value":"concise fact","category":"personal_fact|preference|relationship|goal|instruction"}]}',
      "Rules:",
      "- Save only stable, durable information: personal facts, preferences, relationships, goals, or an explicit \"remember that ...\" request.",
      "- Never save questions, hypotheticals (\"if I had a cat...\"), jokes, quotes, guesses, or one-time context.",
      '- If the message corrects an existing memory, reuse its exact key with the new value.',
      "- For a new fact, invent a short snake_case key (e.g. favorite_color).",
      "- At most 3 memories. If nothing qualifies, reply {\"memories\":[]}.",
    ].join("\n"),
  })

  const extracted = parseExtractionOutput(text)
  for (const item of extracted) {
    await upsertMemory({ ...item, userId: input.userId, sourceChatId: input.chatId })
  }
  return extracted.length
}
