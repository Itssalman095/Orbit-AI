// `next dev` has no --open flag, so run it, wait for the server to respond at
// the URL it announces (Local: http://localhost:PORT), and open the browser
// there. Polling the announced URL also handles Next bumping the port when
// 3000 is busy, and avoids opening a tab when the server fails to start.
import { exec, spawn } from "node:child_process"
import http from "node:http"
import { createRequire } from "node:module"
import process from "node:process"

const OPEN_TIMEOUT_MS = 60_000
const ANSI = /\x1B\[[0-9;]*[A-Za-z]/g

const require = createRequire(import.meta.url)

function isUp(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 1000 }, (response) => {
      response.resume()
      resolve(true)
    })
    request.on("error", () => resolve(false))
    request.on("timeout", () => {
      request.destroy()
      resolve(false)
    })
  })
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isUp(url)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

function openBrowser(url) {
  const command =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`
  exec(command, (error) => {
    if (error) {
      console.error(
        `Could not open the browser automatically: ${error.message}`,
      )
    }
  })
}

const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev"],
  { stdio: ["inherit", "pipe", "pipe"] },
)

// Chat messages execute as Trigger.dev runs, not inside Next — without this
// worker they queue forever and the chat UI spins. Inherits stdio so it keeps
// its interactive session in this terminal.
const triggerChild = spawn(
  "npx",
  ["trigger", "dev", "start", "--env-file", ".env.local"],
  { stdio: "inherit", shell: process.platform === "win32" },
)
triggerChild.on("error", (error) => {
  console.error(`Failed to start the Trigger.dev worker: ${error.message}`)
})

child.on("error", (error) => {
  console.error(`Failed to start \`next dev\`: ${error.message}`)
  process.exit(1)
})

let output = ""
let announced = false

for (const name of ["stdout", "stderr"]) {
  child[name].on("data", (chunk) => {
    process[name].write(chunk)
    if (announced) {
      return
    }
    output = (output + chunk.toString().replace(ANSI, "")).slice(-2000)
    const match = output.match(/Local:\s*(https?:\/\/\S+)/)
    if (match) {
      announced = true
      waitForServer(match[1], OPEN_TIMEOUT_MS).then((up) => {
        if (up) {
          openBrowser(match[1])
        } else {
          console.error(
            `\nServer did not respond at ${match[1]} within ${
              OPEN_TIMEOUT_MS / 1000
            }s. Open the address shown above manually.`,
          )
        }
      })
    }
  })
}

child.on("exit", (code, signal) => {
  if (!announced) {
    console.error(
      "\nDev server exited before announcing a URL. Check the output above.",
    )
  }
  triggerChild.kill()
  process.exit(code ?? (signal ? 1 : 0))
})
