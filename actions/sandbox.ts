"use server"

import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { PAID_PLAN, UPGRADE_ERROR } from "@/lib/billing"
import { getVncPreviewUrl } from "@/lib/daytona"
import { bots, chatMembers, chats } from "@/lib/db/schema"

export type GetVncUrlResult =
  | { success: true; url: string }
  | { success: false; error: string }

export async function getVncUrl(chatId: string): Promise<GetVncUrlResult> {
  // Server Actions are public endpoints — verify the session first.
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  // Connecting to a sandbox is a paid feature — the VNC preview link is the
  // connection point.
  if (!has({ plan: PAID_PLAN })) {
    return { success: false, error: UPGRADE_ERROR }
  }

  // The chat's first bot owns the sandbox — scoped to the signed-in user,
  // never to a client-provided sandbox id.
  const rows = await db
    .select({ sandboxId: bots.sandboxId })
    .from(chats)
    .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .innerJoin(bots, eq(bots.id, chatMembers.botId))
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .orderBy(asc(chatMembers.createdAt))
    .limit(1)

  const sandboxId = rows[0]?.sandboxId
  if (!sandboxId) {
    return { success: false, error: "This chat's bot has no sandbox." }
  }

  try {
    const url = await getVncPreviewUrl(sandboxId)
    return { success: true, url }
  } catch (error) {
    console.error("VNC preview link failed:", error)
    return { success: false, error: "Could not open the sandbox screen." }
  }
}
