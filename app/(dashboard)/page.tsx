import { auth } from "@clerk/nextjs/server"
import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default async function Page() {
  await auth.protect()

  const seed = crypto.randomUUID()

  return (
    <div className="flex min-h-svh p-6">
      <Empty className="border border-solid">
        <EmptyHeader>
          <EmptyMedia>
            <ChatAvatar seed={seed} className="size-10" />
          </EmptyMedia>
          <EmptyTitle>Meet your first bot</EmptyTitle>
          <EmptyDescription>
            Every bot gets its own personality, memory, and face. Spin one up
            and start the conversation.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BotDialog />
        </EmptyContent>
      </Empty>
    </div>
  )
}
