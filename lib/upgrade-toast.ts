"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { toast } from "@/components/ui/toast"
import { UPGRADE_ERROR } from "@/lib/billing"

// True when a server action failed because of the billing gate.
export function isUpgradeError(error: string | null | undefined): boolean {
  return error === UPGRADE_ERROR
}

// The blocked-feature toast: error styling plus an Upgrade shortcut that
// opens the pricing page (kept out of the sidebar on purpose).
export function useUpgradeToast() {
  const router = useRouter()

  return React.useCallback(() => {
    toast.add({
      title: "Upgrade required",
      description: "Bots and sandboxes are part of the Pro plan.",
      type: "error",
      actionProps: {
        children: "Upgrade",
        onClick: () => {
          router.push("/pricing")
        },
      },
    })
  }, [router])
}
