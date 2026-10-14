import { EditBotDialog } from "@/components/bot-edit-dialog"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { GroupEditDialog } from "@/components/group-edit-dialog"
import type { BotListItem } from "@/queries/bots"
import type { ChatDetail } from "@/queries/chats"

type ChatHeaderProps = {
  chat: ChatDetail
  // The user's bots — the group edit dialog's member picker.
  bots: BotListItem[]
}

export function ChatHeader({ chat, bots }: ChatHeaderProps) {
  const isDirect = chat.kind === "direct"

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
      <div className="flex min-w-0 items-center gap-2">
        <GroupChatAvatar
          seeds={chat.members.map((member) => member.avatar)}
          className="size-6 shrink-0"
        />
        {isDirect && chat.bot ? (
          <EditBotDialog bot={chat.bot} chatId={chat.id}>
            <span className="truncate text-sm font-semibold">
              {chat.bot.name}
            </span>
          </EditBotDialog>
        ) : (
          <GroupEditDialog chat={chat} bots={bots}>
            <span className="truncate text-sm font-semibold">
              {chat.name}
            </span>
          </GroupEditDialog>
        )}
      </div>
      {/* The sandbox desktop is a per-bot feature — direct chats only. */}
      {isDirect && <DesktopPanelToggle />}
    </header>
  )
}
