import "server-only"

import { auth } from "@clerk/nextjs/server"
import { formatDistanceToNowStrict } from "date-fns"
import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bots, chatMembers, chats } from "@/lib/db/schema"

export type ChatListItem = {
  id: string
  // Group name for group chats, the bot's name for direct chats
  name: string
  // Avatar seeds of every member bot, earliest member first
  avatarSeeds: string[]
  preview: string
  // Relative timestamp (e.g. "2 days"), formatted on the server so client
  // hydration renders the exact same string
  timeLabel: string
}

export async function getChats(): Promise<ChatListItem[]> {
  // Scope to the signed-in Clerk user — never trust a client-provided id.
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return []
  }

  // One row per (chat, member) pair, members in join order — grouped into
  // chats below. Direct chats have exactly one member, group chats many.
  const rows = await db
    .select({
      id: chats.id,
      name: chats.name,
      preview: chats.lastMessagePreview,
      createdAt: chats.createdAt,
      botName: bots.name,
      botAvatar: bots.avatar,
    })
    .from(chats)
    .leftJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .leftJoin(bots, eq(bots.id, chatMembers.botId))
    .where(eq(chats.userId, userId))
    .orderBy(asc(chatMembers.createdAt))

  const grouped = new Map<
    string,
    {
      id: string
      name: string | null
      preview: string
      createdAt: Date
      firstBotName: string | null
      avatarSeeds: string[]
    }
  >()
  for (const row of rows) {
    const chat = grouped.get(row.id) ?? {
      id: row.id,
      name: row.name,
      preview: row.preview,
      createdAt: row.createdAt,
      firstBotName: null as string | null,
      avatarSeeds: [] as string[],
    }
    if (row.botAvatar) {
      chat.avatarSeeds.push(row.botAvatar)
    }
    if (chat.firstBotName === null && row.botName) {
      chat.firstBotName = row.botName
    }
    grouped.set(row.id, chat)
  }

  // Sort chats by recency.
  return [...grouped.values()]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((chat) => ({
      id: chat.id,
      name: chat.name ?? chat.firstBotName ?? "Untitled chat",
      avatarSeeds: chat.avatarSeeds.length > 0 ? chat.avatarSeeds : [chat.id],
      preview: chat.preview,
      timeLabel: formatDistanceToNowStrict(chat.createdAt),
    }))
}

export type BotListItem = {
  id: string
  name: string
  avatar: string
}

// The user's bots, for the group-chat dialog's member picker.
export async function getBots(): Promise<BotListItem[]> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated || !userId) {
    return []
  }

  return db
    .select({ id: bots.id, name: bots.name, avatar: bots.avatar })
    .from(bots)
    .where(eq(bots.userId, userId))
    .orderBy(asc(bots.createdAt))
}
