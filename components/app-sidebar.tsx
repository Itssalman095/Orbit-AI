"use client"

import * as React from "react"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { BotListItem, ChatListItem } from "@/queries/bots"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  chats: ChatListItem[]
  bots: BotListItem[]
}

export function AppSidebar({ chats, bots, ...props }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)

  // Toggle the search dialog with ⌘K / Ctrl+K from anywhere on the page.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="items-end group-data-[collapsible=icon]:items-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="New chat" />
            }
          >
            <PlusIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            <DropdownMenuItem onClick={() => setBotDialogOpen(true)}>
              <PlusIcon />
              Create new bot
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupDialogOpen(true)}>
              <UsersIcon />
              Create group chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Input-styled ghost button: keeps the button hover on an input look. */}
        <Button
          variant="ghost"
          className="h-8 w-full justify-between gap-2 border border-input bg-transparent px-2.5 text-base font-normal text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent! group-data-[collapsible=icon]:bg-transparent! group-data-[collapsible=icon]:px-0 md:text-sm dark:bg-input/30"
          onClick={() => setSearchOpen(true)}
        >
          <span className="flex items-center gap-2">
            <SearchIcon className="opacity-50" />
            <span className="group-data-[collapsible=icon]:hidden">Search</span>
          </span>
          <Kbd className="group-data-[collapsible=icon]:hidden">⌘K</Kbd>
        </Button>
      </SidebarHeader>
      <SidebarContent>
        {chats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      size="lg"
                      className="h-auto"
                      tooltip={chat.name}
                      isActive={pathname === `/chats/${chat.id}`}
                      render={<Link href={`/chats/${chat.id}`} />}
                    >
                      <GroupChatAvatar
                        seeds={chat.avatarSeeds}
                        className="size-8"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">
                            {chat.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {chat.timeLabel}
                          </span>
                        </div>
                        <span className="truncate text-xs text-muted-foreground">
                          {chat.preview}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserButton
              showName
              appearance={{
                elements: {
                  // Clerk's injected styles are unlayered and beat Tailwind's
                  // utility layer, so conflicting utilities need "!" to win:
                  // rootBox defaults to width: fit-content, and the trigger
                  // button gets width: unset / padding: 0 from Clerk.
                  rootBox: "w-full!",
                  // Same box, spacing, and states as SidebarMenuButton.
                  userButtonTrigger:
                    "flex w-full! items-center justify-start! gap-2 overflow-hidden rounded-md p-2! text-left text-sm! text-sidebar-foreground! outline-hidden transition-[width,height,padding]! hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground! focus-visible:ring-2 focus-visible:ring-sidebar-ring active:bg-sidebar-accent! active:text-sidebar-accent-foreground! aria-expanded:bg-sidebar-accent! aria-expanded:text-sidebar-accent-foreground! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!",
                  // Avatar on the left, name on the right, like other
                  // sidebar rows (DOM order is name, then avatar).
                  userButtonBox: "flex-row-reverse justify-end",
                  userButtonOuterIdentifier:
                    "truncate text-sm group-data-[collapsible=icon]:hidden",
                  userButtonAvatarBox: "size-8 shrink-0 rounded-lg",
                },
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
      <GroupChatDialog
        bots={bots}
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
      />
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search chats"
        description="Search for a chat by name or message preview..."
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => (
                <CommandItem
                  key={chat.id}
                  onSelect={() => {
                    setSearchOpen(false)
                    router.push(`/chats/${chat.id}`)
                  }}
                >
                  <GroupChatAvatar
                    seeds={chat.avatarSeeds}
                    className="size-8"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{chat.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {chat.preview}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </Sidebar>
  )
}
