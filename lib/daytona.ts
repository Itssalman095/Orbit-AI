import { Daytona } from "@daytona/sdk"

// One explicit client for every Daytona call. The SDK auto-loads .env.local
// from the working directory and throws an "ambiguous endpoint" error when
// DAYTONA_API_URL is also already in the process env (Next and trigger dev
// both pre-load it) — passing the config here settles it.
export function daytonaClient(): Daytona {
  return new Daytona({
    apiUrl: process.env.DAYTONA_API_URL,
    apiKey: process.env.DAYTONA_API_KEY,
  })
}

// One sandbox per bot. Creation, deletion and the VNC preview link live here —
// defaults (1 vCPU, 1GB RAM) are fine.

// The bot's persistent memory file, seeded blank at creation — trigger/chat.ts
// instructs the agent to read and maintain it across chats.
const MEMORY_FILE = "MEMORY.md"

export async function createSandbox(): Promise<string> {
  const daytona = daytonaClient()
  const sandbox = await daytona.create()
  // Best-effort: a blank memory file is not worth failing bot creation over —
  // the agent's instructions tell it to create the file if missing.
  try {
    // Relative paths resolve to the sandbox home (same as the bot's file tools).
    await sandbox.fs.uploadFile(Buffer.alloc(0), MEMORY_FILE)
  } catch (error) {
    console.error("MEMORY.md seed failed:", error)
  }
  return sandbox.id
}

export async function deleteSandbox(sandboxId: string): Promise<void> {
  const daytona = daytonaClient()
  const sandbox = await daytona.get(sandboxId)
  await daytona.delete(sandbox)
}

// noVNC web client port in the default sandbox image.
const VNC_PORT = 6080

// One hour — Daytona's recommended signed-URL lifetime. The UI can mint a
// fresh link via its refresh button once it expires.
const VNC_URL_TTL_SECONDS = 3600

// Make sure the sandbox and its VNC desktop are running, then return a
// browser-ready signed preview URL for the noVNC web client. The token is
// embedded in the URL, so an iframe needs no extra headers.
export async function getVncPreviewUrl(sandboxId: string): Promise<string> {
  const daytona = daytonaClient()
  const sandbox = await daytona.get(sandboxId)
  // Sandboxes auto-stop when idle; start() waits until it is ready.
  if (sandbox.state !== "started") {
    await sandbox.start()
  }
  // Bring up the desktop (Xvfb, xfce4, x11vnc, novnc) if it is not running.
  const { status } = await sandbox.computerUse.getStatus()
  if (!status?.includes("running")) {
    await sandbox.computerUse.start()
  }
  const { url } = await sandbox.getSignedPreviewUrl(
    VNC_PORT,
    VNC_URL_TTL_SECONDS
  )
  return url
}
