import { nanoid } from "nanoid"
import { afterAll, describe, expect, it } from "vitest"

import {
  deleteAllMemories,
  deleteMemory,
  getUserMemories,
  upsertMemory,
} from "@/lib/memory"

// Integration tests against the real database (DATABASE_URL from .env.local).
// Each run uses throwaway user ids and cleans up after itself.

const userA = `memtest_a_${nanoid()}`
const userB = `memtest_b_${nanoid()}`

afterAll(async () => {
  await deleteAllMemories(userA)
  await deleteAllMemories(userB)
})

describe("memories table", () => {
  it("persists a memory across queries (Test 3: persistence)", async () => {
    await upsertMemory({
      userId: userA,
      key: "cat_name",
      value: "XYZ",
      category: "personal_fact",
      sourceChatId: "chat_a1",
    })
    // A fresh query — same code path a new process/session would take.
    const rows = await getUserMemories(userA)
    const memory = rows.find((row) => row.key === "cat_name")
    expect(memory).toBeDefined()
    expect(memory!.value).toBe("XYZ")
  })

  it("serves one user's memory to any of their chats (Tests 1/2/8: cross-bot, cross-conversation)", async () => {
    // Learned in chat_a1 under bot A; a different chat/bot of the same user
    // reads the identical row — memory is keyed by userId alone.
    await upsertMemory({
      userId: userA,
      key: "dog_name",
      value: "Rex",
      category: "personal_fact",
      sourceChatId: "chat_a1",
    })
    const rowsForOtherChat = await getUserMemories(userA)
    expect(
      rowsForOtherChat.find((row) => row.key === "dog_name")?.value
    ).toBe("Rex")
  })

  it("updates in place instead of duplicating (Test 4: updates, Test 8: no duplicates)", async () => {
    await upsertMemory({
      userId: userA,
      key: "cat_name",
      value: "XYZ",
      category: "personal_fact",
    })
    await upsertMemory({
      userId: userA,
      key: "cat_name",
      value: "ABC",
      category: "personal_fact",
    })
    const rows = await getUserMemories(userA).then((all) =>
      all.filter((row) => row.key === "cat_name")
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBe("ABC")
    expect(rows[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
      rows[0].createdAt.getTime()
    )
  })

  it("isolates users (Test 5: user isolation)", async () => {
    await upsertMemory({
      userId: userB,
      key: "cat_name",
      value: "B-cats-cat",
      category: "personal_fact",
    })
    const rowsB = await getUserMemories(userB)
    // B sees only B's own fact...
    expect(rowsB.map((row) => row.value)).toEqual(["B-cats-cat"])
    // ...and A's rows are untouched by B's writes.
    const rowsA = await getUserMemories(userA)
    expect(rowsA.find((row) => row.key === "cat_name")?.value).toBe("ABC")
  })

  it("deletes only the owner's row (memory deletion)", async () => {
    await deleteMemory(userA, "dog_name")
    const rowsA = await getUserMemories(userA)
    expect(rowsA.find((row) => row.key === "dog_name")).toBeUndefined()
    // Same key for another user survives.
    expect(
      (await getUserMemories(userB)).find((row) => row.key === "cat_name")
    ).toBeDefined()
  })
})
