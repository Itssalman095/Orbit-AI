import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bots, chatMembers, chats } from "@/lib/db/schema"
import type { ChatKind } from "@/lib/db/schema"

export type ChatBot = {
  id: string
  name: string
  job: string
  instructions: string | null
  avatar: string
}

export type ChatMemberBot = {
  id: string
  name: string
  avatar: string
}

export type ChatDetail = {
  id: string
  kind: ChatKind
  // Group name for group chats, the bot's name for direct chats
  name: string
  // Seed for the chat's first bot's face
  avatarSeed: string
  // The chat's first member (earliest joined) — the direct chat's bot
  bot: ChatBot | null
  // Every member bot, earliest joined first
  members: ChatMemberBot[]
}

export async function getChat(chatId: string): Promise<ChatDetail | null> {
  // Scope to the signed-in Clerk user — never trust a client-provided id.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return null
  }

  // One row per member, earliest joined first.
  const rows = await db
    .select({
      chatName: chats.name,
      kind: chats.kind,
      botId: bots.id,
      botName: bots.name,
      botJob: bots.job,
      botInstructions: bots.instructions,
      botAvatar: bots.avatar,
    })
    .from(chats)
    .leftJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .leftJoin(bots, eq(bots.id, chatMembers.botId))
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .orderBy(asc(chatMembers.createdAt))

  const first = rows[0]
  if (!first) {
    return null
  }

  const members = rows.flatMap((row) =>
    row.botId && row.botName && row.botAvatar
      ? [
          {
            id: row.botId,
            name: row.botName,
            avatar: row.botAvatar,
          },
        ]
      : []
  )
  const firstBot = members[0]
  const firstBotRow = rows.find((row) => row.botId === firstBot?.id)

  return {
    id: chatId,
    kind: first.kind,
    name: first.chatName ?? firstBot?.name ?? "Untitled chat",
    avatarSeed: firstBot?.avatar ?? chatId,
    bot: firstBot
      ? {
          id: firstBot.id,
          name: firstBot.name,
          job: firstBotRow?.botJob ?? "",
          instructions: firstBotRow?.botInstructions ?? null,
          avatar: firstBot.avatar,
        }
      : null,
    members,
  }
}
