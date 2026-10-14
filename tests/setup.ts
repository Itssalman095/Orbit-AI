import { config } from "dotenv"

// Next.js loads .env.local with the highest precedence; mirror that here.
config({ path: ".env.local" })
config()
