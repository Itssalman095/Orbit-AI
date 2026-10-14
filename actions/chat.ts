"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"
import type { LoadTranscriptResult } from "@trigger.dev/sdk/chat/react"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import { bots, chatMembers, chats } from "@/lib/db/schema"
import { PAID_PLAN, UPGRADE_ERROR } from "@/lib/billing"
import { getChat } from "@/queries/chats"
import {
  createGroupChatSchema,
  type CreateGroupChatInput,
  groupMemberSchema,
  type GroupMemberInput,
  updateGroupChatSchema,
  type UpdateGroupChatInput,
} from "@/lib/validations/chat"
import type { botChat, BotChatUIMessage } from "@/trigger/chat"

const startSession = chat.createStartSessionAction<typeof botChat>("bot-chat")
const loadTranscript = chat.createLoadTranscriptAction(defaultStorage)

// The chatId arrives from the browser — bind it to the signed-in Clerk user
// before touching Trigger.dev.
async function assertChatAccess(chatId: string) {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }
  // Messaging a bot is a paid feature — this one gate covers session start,
  // token minting, and transcript loads. Thrown: the chat transport rejects
  // and the client surfaces the Upgrade toast.
  if (!has({ plan: PAID_PLAN })) {
    throw new Error(UPGRADE_ERROR)
  }
  const owned = await getChat(chatId)
  if (!owned) {
    throw new Error("Unauthorized")
  }
}

// Creates the Session + first run and returns a session-scoped token.
// Idempotent on (env, chatId).
export async function startChatSession(
  params: ChatStartSessionParams<typeof botChat>
) {
  await assertChatAccess(params.chatId)
  return startSession(params)
}

// Pure mint. The transport calls this on 401/403 to refresh an expired token.
export async function mintChatAccessToken(chatId: string) {
  await assertChatAccess(chatId)
  return triggerAuth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}

// Reads the persisted transcript (default platform storage, keyed by chatId).
// createLoadTranscriptAction isn't message-typed, but the transcript is what
// botChat persisted — pin the shape here so useLoadTranscript and useChat
// infer typed tool parts end to end.
export async function loadChatTranscript(params: {
  chatId: string
  limit?: number
  before?: string
}): Promise<LoadTranscriptResult<BotChatUIMessage>> {
  await assertChatAccess(params.chatId)
  return loadTranscript(params) as Promise<
    LoadTranscriptResult<BotChatUIMessage>
  >
}

export type GroupMemberResult =
  | { success: true }
  | { success: false; error: string }

// Removes a bot from a group chat. The bot itself and the chat's history
// survive — only the membership row goes, so the bot stops receiving
// new messages there.
export async function removeBotFromGroup(
  input: GroupMemberInput
): Promise<GroupMemberResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const parsed = groupMemberSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid request." }
  }

  // Ownership and kind are enforced here — a foreign chatId or a direct chat
  // matches nothing.
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(
      and(
        eq(chats.id, parsed.data.chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
  if (!chat) {
    return { success: false, error: "Group not found." }
  }

  const removed = await db
    .delete(chatMembers)
    .where(
      and(
        eq(chatMembers.chatId, chat.id),
        eq(chatMembers.botId, parsed.data.botId)
      )
    )
    .returning({ id: chatMembers.id })

  if (removed.length === 0) {
    return { success: false, error: "That bot is not a member of this group." }
  }

  // "layout" so the sidebar's chat list query re-renders too.
  revalidatePath("/", "layout")

  return { success: true }
}

export type UpdateGroupChatResult =
  | { success: true }
  | { success: false; error: string }

// Renames a group chat. Members are managed through addBotToGroup /
// removeBotFromGroup; ownership and kind are enforced in the where clause —
// a foreign chatId or a direct chat matches nothing.
export async function updateGroupChat(
  chatId: string,
  input: UpdateGroupChatInput
): Promise<UpdateGroupChatResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const parsed = updateGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid group name." }
  }

  const updated = await db
    .update(chats)
    .set({ name: parsed.data.name })
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning({ id: chats.id })

  if (updated.length === 0) {
    return { success: false, error: "Group not found." }
  }

  revalidatePath("/", "layout")

  return { success: true }
}

// Adds one of the session user's bots to a group chat. The bot keeps its
// other memberships — this only inserts the membership row.
export async function addBotToGroup(
  input: GroupMemberInput
): Promise<GroupMemberResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const parsed = groupMemberSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid request." }
  }

  // Both the chat (owned group) and the bot (owned bot) must exist for the
  // session user — a foreign id on either side matches nothing.
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(
      and(
        eq(chats.id, parsed.data.chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
  if (!chat) {
    return { success: false, error: "Group not found." }
  }

  const [bot] = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, parsed.data.botId), eq(bots.userId, userId)))
  if (!bot) {
    return { success: false, error: "Bot not found." }
  }

  // The unique (chatId, botId) constraint backs this check up.
  const [existing] = await db
    .select({ id: chatMembers.id })
    .from(chatMembers)
    .where(
      and(
        eq(chatMembers.chatId, chat.id),
        eq(chatMembers.botId, parsed.data.botId)
      )
    )
  if (existing) {
    return { success: false, error: "That bot is already in this group." }
  }

  try {
    await db
      .insert(chatMembers)
      .values({ chatId: chat.id, botId: parsed.data.botId })
  } catch (error) {
    console.error("Adding bot to group failed:", error)
    return { success: false, error: "Could not add the bot to the group." }
  }

  revalidatePath("/", "layout")

  return { success: true }
}

export type CreateGroupChatResult =
  | { success: true; chatId: string }
  | { success: false; error: string }

export async function createGroupChat(
  input: CreateGroupChatInput
): Promise<CreateGroupChatResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  // Never trust the client: revalidate the payload on the server and take
  // the owner from the session, not from the input.
  const parsed = createGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid group details." }
  }
  const botIds = [...new Set(parsed.data.botIds)]

  // Every member must be one of the session user's bots.
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.userId, userId), inArray(bots.id, botIds)))
  if (owned.length !== botIds.length) {
    return { success: false, error: "Some of those bots don't exist." }
  }

  try {
    const chatId = await db.transaction(async (tx) => {
      const [chat] = await tx
        .insert(chats)
        .values({ userId, kind: "group", name: parsed.data.name })
        .returning({ id: chats.id })

      await tx
        .insert(chatMembers)
        .values(botIds.map((botId) => ({ chatId: chat.id, botId })))

      return chat.id
    })

    // "layout" so the dashboard layout re-renders too — that's where the
    // sidebar's chat list query lives.
    revalidatePath("/", "layout")

    return { success: true, chatId }
  } catch (error) {
    console.error("Group chat creation failed:", error)
    return { success: false, error: "Could not create the group chat." }
  }
}

export type DeleteGroupChatResult =
  | { success: true }
  | { success: false; error: string }

// Deletes a whole group chat, mirroring deleteBot. The chat_members rows
// cascade with the chat; the bots themselves survive — they may live in
// other groups or their own direct chats.
export async function deleteGroupChat(
  chatId: string
): Promise<DeleteGroupChatResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  // Scoped to the session user and to group kind — a foreign chatId or a
  // direct chat matches nothing (direct chats die with their bot instead).
  const [chat] = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning({ id: chats.id })

  if (!chat) {
    return { success: false, error: "Group not found." }
  }

  // "layout" so the sidebar's chat list query re-renders too.
  revalidatePath("/", "layout")

  // The chat page no longer exists — send the user back to the dashboard.
  redirect("/")
}
