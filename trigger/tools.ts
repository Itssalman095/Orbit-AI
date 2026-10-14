import { asc, eq } from "drizzle-orm"
import { tool } from "ai"
import type { Sandbox } from "@daytona/sdk"
import { z } from "zod"

import { db } from "@/lib/db"
import { bots, chatMembers, chats } from "@/lib/db/schema"
import { daytonaClient } from "@/lib/daytona"

// Computer-use tools for the bot's own Daytona sandbox. Tool executes never
// receive the chatId, so createBotTools(chatId) closes over it per turn.

// Keep tool results from flooding the model's context.
const OUTPUT_LIMIT = 20_000
const COMMAND_TIMEOUT_SECONDS = 30

async function getBotSandboxId(chatId: string): Promise<string> {
  // Same join as trigger/chat.ts — Sessions are only created through the
  // Clerk-authorized server action, so the chatId is trusted here.
  const [row] = await db
    .select({ sandboxId: bots.sandboxId })
    .from(chats)
    .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .innerJoin(bots, eq(bots.id, chatMembers.botId))
    .where(eq(chats.id, chatId))
    .orderBy(asc(chatMembers.createdAt))
    .limit(1)

  if (!row?.sandboxId) {
    throw new Error("This bot has no sandbox attached.")
  }
  return row.sandboxId
}

// Every member of the chat, in join order — used by the handoff tool.
async function getChatMembers(chatId: string) {
  return db
    .select({ botId: bots.id, name: bots.name, job: bots.job })
    .from(chats)
    .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .innerJoin(bots, eq(bots.id, chatMembers.botId))
    .where(eq(chats.id, chatId))
    .orderBy(asc(chatMembers.createdAt))
}

async function getRunningSandbox(sandboxId: string): Promise<Sandbox> {
  const daytona = daytonaClient()
  const sandbox = await daytona.get(sandboxId)
  // Sandboxes auto-stop when idle; start() waits until it is ready.
  if (sandbox.state !== "started") {
    await sandbox.start()
  }
  return sandbox
}

// Mouse/keyboard/screen tools need the desktop (Xvfb, VNC) running inside
// the sandbox.
async function withDesktop(sandbox: Sandbox): Promise<Sandbox> {
  const { status } = await sandbox.computerUse.getStatus()
  if (!status?.includes("running")) {
    await sandbox.computerUse.start()
  }
  return sandbox
}

function truncate(text: string): string {
  return text.length > OUTPUT_LIMIT
    ? `${text.slice(0, OUTPUT_LIMIT)}\n... (truncated)`
    : text
}

// Web search runs in the task process, not the sandbox: plain fetch against
// Bing and DuckDuckGo's HTML endpoints (no API key).
// shortcut: scrapes engine markup, breaks if they change it or under rate
// limits (DDG especially flags scripted IPs after a few requests) —
// upgrade to a search API (Tavily/Brave) when that happens.
const SEARCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

const SEARCH_HEADERS = {
  "User-Agent": SEARCH_USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    // \u0026 is "&" — kept escaped so the entities aren't decoded by tooling.
    .replace(/\u0026amp;/g, "\u0026")
    .replace(/\u0026lt;/g, "<")
    .replace(/\u0026gt;/g, ">")
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#x27;|\u0026#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

// Organic results are direct URLs in `result-link` anchors, paired in order
// with `result-snippet` cells. Ad links (duckduckgo.com/y.js) are skipped.
function parseDuckDuckGo(html: string) {
  const links = [
    ...html.matchAll(/<a\s+([^>]*class='result-link'[^>]*)>([\s\S]*?)<\/a>/g),
  ]
  const snippets = [
    ...html.matchAll(/<td class='result-snippet'>([\s\S]*?)<\/td>/g),
  ]
  return links
    .map((match, index) => ({
      url: /href="([^"]+)"/.exec(match[1])?.[1] ?? "",
      title: stripTags(match[2]),
      snippet: snippets[index] ? stripTags(snippets[index][1]) : "",
    }))
    .filter(
      (result) =>
        result.url &&
        !result.url.startsWith("//") &&
        !result.url.includes("duckduckgo.com/y.js")
    )
}

// Bing wraps result URLs in a click tracker: /ck/a?...&u=a1<base64url>.
// The HTML also double-escapes the ampersands, hence the loose boundary.
function decodeBingUrl(href: string): string {
  const encoded = /\bu=a1([A-Za-z0-9_-]+)/.exec(href)?.[1]
  if (!encoded) return href
  const decoded = Buffer.from(encoded, "base64").toString("utf8")
  return decoded.startsWith("http") ? decoded : href
}

// Bing organic results: h2 anchors paired in order with b_lineclamp snippets.
function parseBing(html: string) {
  const links = [
    ...html.matchAll(
      /<h2[^>]*><a[^>]+href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    ),
  ]
  const snippets = [
    ...html.matchAll(/<p class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/g),
  ]
  return links.map((match, index) => ({
    url: decodeBingUrl(match[1]),
    title: stripTags(match[2]),
    snippet: snippets[index] ? stripTags(snippets[index][1]) : "",
  }))
}

export function createBotTools(chatId: string, currentBotId?: string) {
  // One DB lookup per turn; every execute reuses it. The sandbox handle is
  // fetched per call so a stop between tools is transparently recovered.
  let sandboxIdPromise: Promise<string> | undefined
  const sandbox = () =>
    (sandboxIdPromise ??= getBotSandboxId(chatId)).then(getRunningSandbox)
  const desktop = () => sandbox().then(withDesktop)

  return {
    // Only meaningful in group chats: hands the conversation to another
    // member. The client routes the next message to that bot.
    handoff: tool({
      description:
        "Hand the conversation over to another bot in this group chat whose job fits the user's request better. That bot answers their next message. Never hand off to yourself.",
      inputSchema: z.object({
        botId: z.string().describe("botId of the chat member to hand off to"),
        reason: z
          .string()
          .describe("One line, shown to the user: why that bot is the better fit"),
      }),
      execute: async ({ botId, reason }) => {
        const members = await getChatMembers(chatId)
        if (members.length <= 1) {
          return {
            ok: false as const,
            error: "This chat has no other bots to hand off to.",
          }
        }
        // Mirror the run's fallback: an absent or non-member selection
        // resolves to the chat's first member.
        const callerId =
          members.find((member) => member.botId === currentBotId)?.botId ??
          members[0].botId
        const target = members.find((member) => member.botId === botId)
        if (!target) {
          return {
            ok: false as const,
            error: `No bot with botId "${botId}" in this chat. Members: ${members
              .map((member) => `${member.name} (${member.botId})`)
              .join(", ")}.`,
          }
        }
        if (target.botId === callerId) {
          return { ok: false as const, error: "You cannot hand off to yourself." }
        }
        return { ok: true as const, handedTo: target.name, reason }
      },
    }),
    webSearch: tool({
      description:
        "Search the web for current information — news, prices, scores, weather, releases, or facts you are unsure of. Returns results with title, url and snippet.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Short, specific search query (2-6 words)"),
      }),
      execute: async ({ query }) => {
        // Bing first (tolerates scripted traffic); DuckDuckGo as fallback.
        // Both are keyless HTML scrapes, so they break for different reasons.
        const providers = [
          [
            "Bing",
            `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`,
            parseBing,
          ],
          [
            "DuckDuckGo",
            `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
            parseDuckDuckGo,
          ],
        ] as const
        for (const [, url, parse] of providers) {
          try {
            const response = await fetch(url, {
              headers: SEARCH_HEADERS,
              signal: AbortSignal.timeout(15_000),
            })
            if (!response.ok) continue
            const results = parse(await response.text()).slice(0, 8)
            if (results.length > 0) return { results }
          } catch {
            // Network error or timeout — try the next provider.
          }
        }
        return {
          results: [],
          error:
            "No search results right now — the search engines may be rate-limiting. Wait a moment, then try different wording.",
        }
      },
    }),
    bash: tool({
      description:
        "Run a shell command in your sandbox and return its output with the exit code.",
      inputSchema: z.object({
        command: z.string().describe("Shell command to run, e.g. 'ls -la'"),
        cwd: z
          .string()
          .optional()
          .describe("Working directory relative to the sandbox home"),
        timeoutSeconds: z
          .number()
          .int()
          .positive()
          .max(120)
          .optional()
          .describe(`Max seconds to wait (default ${COMMAND_TIMEOUT_SECONDS})`),
      }),
      execute: async ({ command, cwd, timeoutSeconds }) => {
        const response = await (
          await sandbox()
        ).process.executeCommand(
          command,
          cwd,
          undefined,
          timeoutSeconds ?? COMMAND_TIMEOUT_SECONDS
        )
        return {
          exitCode: response.exitCode,
          output: truncate(response.result),
        }
      },
    }),
    readFile: tool({
      description: "Read a text file from your sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("File path, absolute or relative to the sandbox home"),
      }),
      execute: async ({ path }) => {
        const content = (
          await (await sandbox()).fs.downloadFile(path)
        ).toString("utf8")
        return { path, content: truncate(content) }
      },
    }),
    writeFile: tool({
      description: "Create or overwrite a text file in your sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("File path, absolute or relative to the sandbox home"),
        content: z.string(),
      }),
      execute: async ({ path, content }) => {
        await (
          await sandbox()
        ).fs.uploadFile(Buffer.from(content, "utf8"), path)
        return { path, bytes: Buffer.byteLength(content, "utf8") }
      },
    }),
    listFiles: tool({
      description: "List the entries of a directory in your sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("Directory path, e.g. '.' for the sandbox home"),
      }),
      execute: async ({ path }) => {
        const files = await (await sandbox()).fs.listFiles(path)
        return {
          path,
          entries: files.map((file) => ({
            name: file.name,
            type: file.isDir ? ("directory" as const) : ("file" as const),
            size: file.size,
          })),
        }
      },
    }),
    mouseClick: tool({
      description: "Click the mouse at screen coordinates.",
      inputSchema: z.object({
        x: z.number().int(),
        y: z.number().int(),
        button: z.enum(["left", "right", "middle"]).optional(),
        double: z.boolean().optional().describe("Double-click"),
      }),
      execute: async ({ x, y, button, double }) => {
        await (await desktop()).computerUse.mouse.click(x, y, button, double)
        return { clicked: [x, y] }
      },
    }),
    mouseMove: tool({
      description: "Move the mouse cursor to screen coordinates.",
      inputSchema: z.object({ x: z.number().int(), y: z.number().int() }),
      execute: async ({ x, y }) => {
        await (await desktop()).computerUse.mouse.move(x, y)
        return { movedTo: [x, y] }
      },
    }),
    mouseScroll: tool({
      description: "Scroll the mouse wheel at screen coordinates.",
      inputSchema: z.object({
        x: z.number().int(),
        y: z.number().int(),
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Wheel ticks (default 1)"),
      }),
      execute: async ({ x, y, direction, amount }) => {
        await (
          await desktop()
        ).computerUse.mouse.scroll(x, y, direction, amount)
        return { scrolled: direction, amount: amount ?? 1 }
      },
    }),
    keyboardType: tool({
      description:
        "Type text into whatever has keyboard focus. Newlines are sent as Enter presses.",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        await (await desktop()).computerUse.keyboard.type(text)
        return { typed: text.length }
      },
    }),
    keyboardPress: tool({
      description:
        "Press a key (e.g. 'enter', 'tab', 'escape', 'a', 'f5') with optional modifiers.",
      inputSchema: z.object({
        key: z.string(),
        modifiers: z.array(z.enum(["ctrl", "alt", "shift", "cmd"])).optional(),
      }),
      execute: async ({ key, modifiers }) => {
        await (await desktop()).computerUse.keyboard.press(key, modifiers)
        return {
          pressed: modifiers?.length ? `${modifiers.join("+")}+${key}` : key,
        }
      },
    }),
    viewScreen: tool({
      description:
        "Take a screenshot for yourself. Use it to look at what is on the screen — the user never sees this image.",
      inputSchema: z.object({}),
      execute: async () => takeScreenshot(await desktop()),
      toModelOutput: screenshotToModelOutput,
    }),
    showScreen: tool({
      description:
        "Take a screenshot and show it to the user in the chat. Use it when they ask what is on the screen.",
      inputSchema: z.object({}),
      execute: async () => takeScreenshot(await desktop()),
      toModelOutput: screenshotToModelOutput,
    }),
  }
}

async function takeScreenshot(sandbox: Sandbox) {
  const shot = await sandbox.computerUse.screenshot.takeCompressed({
    format: "jpeg",
    quality: 80,
  })
  if (!shot.screenshot) {
    throw new Error("Screenshot capture returned no image.")
  }
  return {
    base64: shot.screenshot.replace(/^data:image\/\w+;base64,/, ""),
    mediaType: "image/jpeg" as const,
  }
}

// The model sees an image part, not base64 bytes in its context.
function screenshotToModelOutput({
  output,
}: {
  output: { base64: string; mediaType: string }
}) {
  return {
    type: "content" as const,
    value: [
      {
        type: "image-data" as const,
        mediaType: output.mediaType,
        data: output.base64,
      },
    ],
  }
}

export type BotTools = ReturnType<typeof createBotTools>
