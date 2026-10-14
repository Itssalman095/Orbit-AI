"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import { bots, chatMembers, chats } from "@/lib/db/schema"
import { PAID_PLAN, UPGRADE_ERROR } from "@/lib/billing"
import { createSandbox, deleteSandbox } from "@/lib/daytona"
import { createBotSchema, type CreateBotInput } from "@/lib/validations/bot"

export type CreateBotResult =
  | { success: true; botId: string }
  | { success: false; error: string }

export async function createBot(
  input: CreateBotInput
): Promise<CreateBotResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  // Bots are a paid feature — and their sandbox is created below, so this
  // gate covers both. Checked before any resource is minted.
  if (!has({ plan: PAID_PLAN })) {
    return { success: false, error: UPGRADE_ERROR }
  }

  // Never trust the client: revalidate the payload on the server and take
  // the owner from the session, not from the input.
  const parsed = createBotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid bot details." }
  }

  // Sandbox first: a bot without one is useless, and if the DB write below
  // fails we clean it up instead of leaving an orphan eating quota.
  let sandboxId: string
  try {
    sandboxId = await createSandbox()
  } catch (error) {
    console.error("Sandbox creation failed:", error)
    return { success: false, error: "Could not create the bot's sandbox." }
  }

  try {
    // Create the bot together with its direct chat and chat membership in one
    // transaction — all three succeed or none do.
    const botId = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({ ...parsed.data, userId, sandboxId })
        .returning({ id: bots.id })

      // Direct chats use the bot's name, so name stays null; the preview
      // starts empty until the first message lands.
      const [chat] = await tx
        .insert(chats)
        .values({ userId, kind: "direct" })
        .returning({ id: chats.id })

      await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })

      return bot.id
    })

    // "layout" so the dashboard layout re-renders too — that's where the
    // sidebar's chat list query lives; the page beneath it is covered as well.
    revalidatePath("/", "layout")

    return { success: true, botId }
  } catch (error) {
    await deleteSandbox(sandboxId).catch(() => {})
    throw error
  }
}

export type UpdateBotResult =
  | { success: true }
  | { success: false; error: string }

export async function updateBot(
  botId: string,
  input: CreateBotInput
): Promise<UpdateBotResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  // Never trust the client: revalidate the payload on the server. The bot
  // must also belong to the session user — the where clause enforces it, so
  // a foreign botId updates nothing.
  const parsed = createBotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid bot details." }
  }

  const updated = await db
    .update(bots)
    .set(parsed.data)
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning({ id: bots.id })

  if (updated.length === 0) {
    return { success: false, error: "Bot not found." }
  }

  // "layout" so the sidebar's chat list (name/avatar/preview) and the chat
  // page's header re-render with the new values.
  revalidatePath("/", "layout")

  return { success: true }
}

export type DeleteBotResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteBot(
  botId: string,
  chatId: string
): Promise<DeleteBotResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  // Bots and their direct chat are created as a unit, so they die as one.
  // All deletes are scoped to the session user; a foreign chatId or botId
  // matches nothing. The kind guard keeps a group chatId from wiping the
  // whole group — bots leave groups through removeBotFromGroup. Fetch the
  // sandbox ID first — the rows are about to go.
  const result = await db.transaction(async (tx) => {
    const [bot] = await tx
      .select({ sandboxId: bots.sandboxId })
      .from(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    if (!bot) {
      return null
    }

    // Chat first — cascades its chat_members rows.
    const [chat] = await tx
      .delete(chats)
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, userId),
          eq(chats.kind, "direct")
        )
      )
      .returning({ id: chats.id })
    if (!chat) {
      return null
    }

    await tx
      .delete(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))

    return bot.sandboxId
  })

  if (result === null) {
    return { success: false, error: "Bot not found." }
  }

  // Best-effort: the DB row is the source of truth, so a failed sandbox
  // delete must not stop the bot deletion (it would orphan worse).
  if (result) {
    await deleteSandbox(result).catch((error) =>
      console.error("Sandbox cleanup failed:", error)
    )
  }

  revalidatePath("/", "layout")

  // The chat page no longer exists — send the user back to the dashboard.
  redirect("/")
}
