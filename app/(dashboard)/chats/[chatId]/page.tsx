import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { VncPanelPreview, VncPreviewProvider } from "@/components/vnc-preview"
import { getChat } from "@/queries/chats"
import { getBots } from "@/queries/bots"

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  await auth.protect()
  const { chatId } = await params
  const chat = await getChat(chatId)
  if (!chat) {
    notFound()
  }

  // Group chats have no bot sandbox to preview — plain column, no desktop
  // panel option. The edit dialog needs all of the user's bots as the
  // member picker.
  if (chat.kind === "group") {
    const bots = await getBots()
    return (
      <div className="flex h-svh flex-col">
        <ChatHeader chat={chat} bots={bots} />
        <Chat
          chatId={chat.id}
          name={chat.name}
          members={chat.members}
        />
      </div>
    )
  }

  return (
    <DesktopPanelProvider>
      <VncPreviewProvider chatId={chat.id} name={chat.name}>
        <ResizablePanelGroup orientation="horizontal" style={{ height: "100svh" }}>
          <ResizablePanel minSize="30">
            <div className="flex h-full flex-col">
              <ChatHeader chat={chat} bots={[]} />
              <Chat
                chatId={chat.id}
                name={chat.name}
                members={chat.members}
              />
            </div>
          </ResizablePanel>
          <DesktopPanel>
            <VncPanelPreview name={chat.name} />
          </DesktopPanel>
        </ResizablePanelGroup>
      </VncPreviewProvider>
    </DesktopPanelProvider>
  )
}
