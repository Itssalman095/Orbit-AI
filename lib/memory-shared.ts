import type { ModelMessage } from "ai"
import { z } from "zod"

// Pure helpers for the user-memory pipeline: no DB, no LLM, no env — safe to
// unit-test in any environment. Repo + extraction live in lib/memory.ts.

export const MEMORY_CATEGORIES = [
  "personal_fact",
  "preference",
  "relationship",
  "goal",
  "instruction",
] as const

const extractedMemorySchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string().min(1).max(500),
  category: z.enum(MEMORY_CATEGORIES),
})

export type ExtractedMemory = z.output<typeof extractedMemorySchema>

// "My Cat's Name!" -> "my_cat_s_name" — stable, collision-free DB keys.
export function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)
    .replace(/_+$/g, "")
}

// The extraction model replies with JSON, possibly fenced or padded with
// prose. Parse defensively: no JSON, or items failing validation, yield
// nothing rather than garbage memories.
export function parseExtractionOutput(text: string): ExtractedMemory[] {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return []
  }
  const items = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { memories?: unknown }).memories)
      ? (parsed as { memories: unknown[] }).memories
      : []

  // Later items overwrite earlier ones under the same normalized key, so a
  // correction inside one message wins over the value it corrects.
  const byKey = new Map<string, ExtractedMemory>()
  for (const item of items) {
    const validated = extractedMemorySchema.safeParse(item)
    if (!validated.success) {
      continue
    }
    const key = normalizeKey(validated.data.key)
    const value = validated.data.value.trim()
    if (!key) {
      continue
    }
    byKey.set(key, { key, value, category: validated.data.category })
  }
  // Bounded blast radius: at most 3 facts saved per message.
  return [...byKey.values()].slice(0, 3)
}

// The context block injected into every bot's instructions. Empty when the
// user has no memories yet.
export function buildMemoryContext(
  memories: ReadonlyArray<{ key: string; value: string }>
): string {
  if (memories.length === 0) {
    return ""
  }
  return [
    "GLOBAL USER MEMORY (durable facts about this user, shared across all their bots and chats):",
    ...memories.map((memory) => `- ${memory.key}: ${memory.value}`),
    "Treat these facts as authoritative when answering questions about the user. If a question is not answered by this list or the conversation, say you don't know instead of guessing.",
  ].join("\n")
}

// The text of the newest real user turn — string content, or the text parts
// of structured content. Messages whose content carries no text (tool results
// riding in a user message, images only) are skipped so the previous user
// turn is found instead.
export function lastUserText(
  messages: ReadonlyArray<ModelMessage>
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== "user") {
      continue
    }
    const text =
      typeof message.content === "string"
        ? message.content
        : message.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("\n")
    const trimmed = text.trim()
    if (trimmed) {
      return trimmed
    }
  }
  return undefined
}
