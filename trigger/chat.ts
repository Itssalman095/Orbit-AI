import { asc, eq } from "drizzle-orm"
import { stepCountIs, type InferUITools, type UIDataTypes, type UIMessage } from "ai"
import { chat } from "@trigger.dev/sdk/ai"
import { z } from "zod"

import { db } from "@/lib/db"
import { bots, chatMembers, chats } from "@/lib/db/schema"
import { AI_MODEL_ID, nvidia } from "@/lib/ai"
import {
  buildMemoryContext,
  lastUserText,
} from "@/lib/memory-shared"
import { extractMemories, getUserMemories } from "@/lib/memory"
import { createBotTools, type BotTools } from "@/trigger/tools"

// Typed tool parts plus a `botId` metadata field — the agent stamps the
// responding bot onto every assistant message so group chats can render its
// avatar next to the reply (components/chat.tsx).
export type BotChatUIMessage = UIMessage<
  { botId?: string },
  UIDataTypes,
  InferUITools<BotTools>
>

// Client-supplied per-turn data, threaded through the transport's metadata.
// In group chats this carries which bot the user is talking to. Nullish so
// direct chats (and existing sessions) that send no metadata still validate.
const clientDataSchema = z
  .object({ botId: z.string().min(1).optional() })
  .nullish()

export const botChat = chat
  .withUIMessage<BotChatUIMessage>()
  .withClientData({ schema: clientDataSchema })
  .agent({
    id: "bot-chat",
    // Tool loops (computer use, long commands) legitimately run long; the
    // cap exists so a hung AI stream self-terminates instead of showing
    // "currently being executed" forever.
    maxDuration: 900,
    // Resolved per turn so every execute closes over this chat's sandbox.
    tools: ({ chatId, clientData }) => createBotTools(chatId, clientData?.botId),
    // The transcript persists via the default platform storage, keyed by chatId
    // (the Session's externalId) — loaded back through the actions in
    // actions/chat.ts.
    run: async ({ messages, chatId, clientData, tools, signal, streamText }) => {
      // Sessions are only created through the Clerk-authorized server action,
      // so the chatId is trusted here. Clerk's auth() has no request context
      // inside a task, so the bot is scoped by chat id only.
      const rows = await db
        .select({
          botId: bots.id,
          name: bots.name,
          job: bots.job,
          instructions: bots.instructions,
          sandboxId: bots.sandboxId,
          // The chat's owner — global memory is scoped to this user.
          userId: chats.userId,
        })
        .from(chats)
        .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
        .innerJoin(bots, eq(bots.id, chatMembers.botId))
        .where(eq(chats.id, chatId))
        .orderBy(asc(chatMembers.createdAt))

      // Group chats answer as the bot the user picked from the composer
      // (transport metadata). A botId that isn't a chat member — or no
      // selection at all — falls back to the chat's first member.
      const row =
        (clientData?.botId
          ? rows.find((candidate) => candidate.botId === clientData.botId)
          : undefined) ?? rows[0]

      // Tag the response with the bot that wrote it — group chats show its
      // avatar next to the message. Undefined when the chat has no members,
      // in which case no avatar renders.
      chat.setUIMessageStreamOptions({
        messageMetadata: () => (row ? { botId: row.botId } : undefined),
        // The ai package redacts stream/tool error text to "An error occurred."
        // by default; pass the real message through so tool failures (sandbox
        // start, Daytona API, timeouts) are readable in the chat itself.
        onError: (error) =>
          error instanceof Error ? error.message : "An error occurred.",
      })

      // User memory pipeline. Global memory is scoped to the chat's owner, so
      // every bot of the same user reads (and feeds) the same fact store.
      // Extraction and retrieval failures must never break the chat — the
      // model just answers without memory that turn.
      let memories: { key: string; value: string }[] = []
      const userId = rows[0]?.userId
      if (userId) {
        const userText = lastUserText(messages)
        if (userText) {
          // shortcut: fire-and-forget — extraction is a full LLM call, so
          // awaiting it delayed every reply by seconds. It may be cut short
          // if the run ends before it finishes; it just lands next turn.
          extractMemories({ userId, chatId, message: userText }).catch(
            (error) => {
              console.error("[chat] memory extraction failed:", error)
            }
          )
        }
        try {
          memories = await getUserMemories(userId)
        } catch (error) {
          console.error("[chat] memory retrieval failed:", error)
        }
      }
      const memoryBlock = buildMemoryContext(memories)

      // Group-chat context: who else is here (with botIds so the handoff tool
      // can target them), when to hand off, and whose sandbox the tools act in.
      const groupInstructions =
        row && rows.length > 1
          ? [
              `You are one of several bots in a group chat. The other members: ${rows
                .filter((candidate) => candidate.botId !== row.botId)
                .map(
                  (candidate) =>
                    `${candidate.name} (botId: ${candidate.botId}${candidate.job ? ` — job: ${candidate.job}` : ""})`
                )
                .join("; ")}.`,
              "The user is talking to you, but if their request clearly fits another bot's job better, call the handoff tool with that bot's botId and a short reason, then briefly tell the user you are handing them over. Handle everything you are suited for yourself — don't hand off casually.",
              "Your tools act only inside your own sandbox; every other bot has its own.",
            ]
          : []

    // streamText is the SDK's, from the run argument — the one imported from
    // "ai" would silently drop compaction/steering.
    return streamText({
      model: nvidia(AI_MODEL_ID),
      instructions: row
        ? [
            `You are ${row.name}, a witty, direct, and helpful AI assistant. You give clear answers, have a bit of personality, and never lecture.`,
            row.job && `Your job: ${row.job}.`,
            // Base bot prompt: style and honesty rules.
            "Style: lead with the answer, then add detail only if needed. Be concise, casual, and a little sarcastic when it fits, but never rude. Use markdown (lists, code blocks) only when it helps readability. For code, give working examples with a one-line explanation.",
            `Rules: don't invent facts, quotes, or links — if you don't know, say so. Today's date is ${new Date().toISOString().slice(0, 10)}; use it to judge what is recent. Be honest about uncertainty and don't pretend to have done things you didn't do. Decline requests that are harmful or illegal, briefly and without preaching.`,
            // Web search — backed by the webSearch tool in trigger/tools.ts.
            "You have a webSearch tool. Use it when the question is about news, prices, scores, weather, releases, or anything that may have changed recently; when the user asks about the latest, current, today or now; and whenever you are unsure of a fact or don't recognize a name, product, or event. Don't search for timeless knowledge (math, definitions, coding concepts, history). Use short, specific queries (2-6 words) and search again with different wording if results are weak; run multiple searches for comparisons or multi-part questions. Base your answer on the results — if they conflict or are thin, say so instead of guessing. Mention sources by name (e.g. \"According to Reuters...\") and include links when useful. Never say you can't browse the internet: you can, through the tool.",
            // The bot drives this sandbox through its tools.
            row.sandboxId &&
              "You have your own private sandbox: an isolated Linux cloud environment with its own filesystem and network, reserved just for you. You act inside it through your tools (shell, files, mouse, keyboard, screen). The sandbox has full internet access, with curl and Chromium preinstalled: to fetch or read a web page, run `curl -L <url>` with the bash tool; to actually open a site, launch it on your desktop with `DISPLAY=:0 chromium <url> &` via bash, then drive it with your mouse, keyboard and screen tools.",
            // Cross-chat memory: the file persists in the sandbox, so notes
            // made in a private chat are recallable in group chats.
            row.sandboxId &&
              "Your sandbox also holds MEMORY.md in your home directory — your scratchpad for notes and decisions that should survive across your chats. Durable facts about the user are stored for you automatically and appear in your instructions below; don't duplicate them into MEMORY.md.",
            ...groupInstructions,
            row.instructions,
            memoryBlock,
          ]
            .filter(Boolean)
            .join(" ")
        : "You are a personal AI bot in a chat app.",
      messages,
      tools,
      abortSignal: signal,
      // streamText defaults to a single step; the agent loop must continue
      // past tool calls until the model answers in plain text.
      stopWhen: stepCountIs(15),
      // The real error also reaches the client via setUIMessageStreamOptions
      // above; this keeps the stack trace in the run logs for diagnosis.
      onError: ({ error }) => {
        console.error("[chat] AI gateway error:", error)
      },
    })
  },
})
