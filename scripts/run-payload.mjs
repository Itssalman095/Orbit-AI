import { config } from "dotenv"
config({ path: ".env.local" })
import { runs } from "@trigger.dev/sdk"

const run = await runs.retrieve("run_06gjd7hphqespm8fb1c8brpi01")
const p = run.payload
console.log("payload keys:", Object.keys(p ?? {}))
console.log("chatId:", JSON.stringify(p?.chatId))
console.log("trigger:", JSON.stringify(p?.trigger))
console.log("messages count:", p?.messages?.length)
console.log("metadata:", JSON.stringify(p?.metadata)?.slice(0, 300))
console.log("externalId:", run.externalId ?? "(none)")
