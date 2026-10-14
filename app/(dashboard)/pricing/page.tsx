import { auth } from "@clerk/nextjs/server"
import { PricingTable } from "@clerk/nextjs"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

// Reached from the Upgrade toast — deliberately not in the sidebar.
export default async function PricingPage() {
  await auth.protect()

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to chats
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight">
        Choose a plan
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pro unlocks everything — every bot, every sandbox, no limits.
      </p>
      <div className="mt-6">
        <PricingTable />
      </div>
    </main>
  )
}
