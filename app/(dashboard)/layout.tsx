import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getBots, getChats } from "@/queries/bots"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [chats, bots, cookieStore] = await Promise.all([
    getChats(),
    getBots(),
    cookies(),
  ])
  const sidebarWidth = Number.parseInt(
    cookieStore.get("sidebar_width")?.value ?? "",
    10
  )
  // Only pass the cookie value when present, so the provider's default still
  // applies for first-time visitors.
  const sidebarState = cookieStore.get("sidebar_state")?.value

  return (
    <SidebarProvider
      defaultOpen={sidebarState === undefined ? undefined : sidebarState === "true"}
      defaultWidth={Number.isNaN(sidebarWidth) ? undefined : sidebarWidth}
    >
      <AppSidebar chats={chats} bots={bots} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
