// Billing gates — shared constants. Client-safe on purpose: no server-only
// imports here, client components match on UPGRADE_ERROR to swap the generic
// failure toast for the Upgrade toast.

export const PAID_PLAN = "pro"

// The exact error string every paid-feature gate returns or throws.
export const UPGRADE_ERROR =
  "Upgrade to the Pro plan to use bots and sandboxes."
