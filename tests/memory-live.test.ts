import { generateText } from "ai"
import { nanoid } from "nanoid"
import { afterAll, describe, expect, it } from "vitest"

import { AI_MODEL_ID, nvidia } from "@/lib/ai"
import { extractMemories, getUserMemories } from "@/lib/memory"
import { buildMemoryContext } from "@/lib/memory-shared"

// Live pipeline tests against the real LLM gateway + database. Skipped when
// the gateway key is absent (e.g. CI without secrets).

const live = Boolean(process.env.NEXT_PUBLIC_AI_GATEWAY_KEY)
const userId = `memtest_live_${nanoid()}`

afterAll(async () => {
  if (live) {
    const { deleteAllMemories } = await import("@/lib/memory")
    await deleteAllMemories(userId)
  }
})

describe.skipIf(!live)("extraction pipeline", () => {
  it("saves a stated personal fact (Test 1 pipeline)", async () => {
    const written = await extractMemories({
      userId,
      chatId: "chat_test",
      message: "My cat's name is XYZ.",
    })
    expect(written).toBeGreaterThan(0)
    const rows = await getUserMemories(userId)
    const cat = rows.find(
      (row) => row.key.includes("cat") && /xyz/i.test(row.value)
    )
    expect(cat).toBeDefined()
  })

  it("does not save a hypothetical (Test 7)", async () => {
    await extractMemories({
      userId,
      chatId: "chat_test",
      message: "If I ever got a second cat, I would name it DEF.",
    })
    const rows = await getUserMemories(userId)
    expect(rows.some((row) => /def/i.test(row.value))).toBe(false)
  })

  it("does not save a question (Test 6 pipeline)", async () => {
    const before = (await getUserMemories(userId)).length
    await extractMemories({
      userId,
      chatId: "chat_test",
      message: "What is my cat's name?",
    })
    expect((await getUserMemories(userId)).length).toBe(before)
  })

  it("updates the fact on correction, keeping one record (Test 4)", async () => {
    await extractMemories({
      userId,
      chatId: "chat_test",
      message: "I renamed my cat to ABC.",
    })
    const rows = (await getUserMemories(userId)).filter((row) =>
      /cat/i.test(`${row.key} ${row.value}`)
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toMatch(/abc/i)
  })

  it("answers from global memory alone (Tests 1/2: cross-bot recall)", async () => {
    const block = buildMemoryContext(await getUserMemories(userId))
    const { text } = await generateText({
      model: nvidia(AI_MODEL_ID),
      system: `You are a helpful assistant. ${block}`,
      prompt: "What is my cat's name? Answer in one short sentence.",
    })
    expect(text).toMatch(/abc/i)
  })

  it("admits not knowing without memory (Test 6)", async () => {
    const { text } = await generateText({
      model: nvidia(AI_MODEL_ID),
      system:
        "You are a helpful assistant. GLOBAL USER MEMORY (durable facts about this user, shared across all their bots and chats):\n- pet_count: 1\nTreat these facts as authoritative when answering questions about the user. If a question is not answered by this list or the conversation, say you don't know instead of guessing.",
      prompt: "What is my goldfish's name? Answer in one short sentence.",
    })
    expect(text).toMatch(/don't know|do not know|haven't|not sure|didn't tell/i)
  })
})
