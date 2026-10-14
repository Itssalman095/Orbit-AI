"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
  type InferChatUIMessage,
} from "@trigger.dev/sdk/chat/react"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"

import {
  loadChatTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import { ChatAvatar } from "@/components/chat-avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import type { botChat, BotChatUIMessage } from "@/trigger/chat"
import { UPGRADE_ERROR } from "@/lib/billing"
import { useUpgradeToast } from "@/lib/upgrade-toast"
import { ArrowRightLeftIcon, CheckIcon } from "lucide-react"

type ChatMember = {
  id: string
  name: string
  avatar: string
}

// A part narrowed down to one of the bot's tool calls.
type BotToolPart = Extract<
  BotChatUIMessage["parts"][number],
  { type: `tool-${string}` }
>

type BotHandoffPart = Extract<BotToolPart, { type: "tool-handoff" }>

function isToolPart(
  part: BotChatUIMessage["parts"][number]
): part is BotToolPart {
  return part.type.startsWith("tool-")
}

const TOOL_TITLES: Partial<Record<BotToolPart["type"], string>> = {
  "tool-bash": "Ran a command",
  "tool-readFile": "Read a file",
  "tool-writeFile": "Wrote a file",
  "tool-listFiles": "Listed files",
  "tool-mouseClick": "Clicked",
  "tool-mouseMove": "Moved the mouse",
  "tool-mouseScroll": "Scrolled",
  "tool-keyboardType": "Typed",
  "tool-keyboardPress": "Pressed keys",
  "tool-viewScreen": "Looked at the screen",
  "tool-showScreen": "Shared the screen",
  "tool-webSearch": "Searched the web",
}

function BotToolCall({ part }: { part: BotToolPart }) {
  const output = part.state === "output-available" ? part.output : undefined
  // viewScreen's screenshot is for the model only — never rendered in chat.
  const screenshot =
    part.type === "tool-showScreen" && part.state === "output-available"
      ? part.output
      : undefined

  return (
    <Tool defaultOpen={Boolean(screenshot)}>
      <ToolHeader
        type={part.type}
        state={part.state}
        title={TOOL_TITLES[part.type]}
      />
      <ToolContent>
        <ToolInput input={part.input} />
        {screenshot ? (
          // Plain img — ai-elements' Image requires a decoded uint8Array we
          // don't have, and this is the exact markup it renders anyway.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:${screenshot.mediaType};base64,${screenshot.base64}`}
            alt="The bot's screen"
            className="h-auto max-w-full overflow-hidden rounded-md"
          />
        ) : part.type === "tool-viewScreen" ? null : (
          <ToolOutput output={output} errorText={part.errorText} />
        )}
      </ToolContent>
    </Tool>
  )
}

// Handoffs read as a conversational event, not a collapsed JSON tool card.
function BotHandoff({
  part,
  members,
}: {
  part: BotHandoffPart
  members: ChatMember[]
}) {
  const target = members.find((member) => member.id === part.input?.botId)
  const failure =
    part.state === "output-available" && !part.output.ok
      ? part.output.error
      : undefined

  return (
    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
      <ArrowRightLeftIcon className="mt-0.5 size-4 shrink-0" />
      {failure
        ? `Handoff failed: ${failure}`
        : `${part.state === "output-available" ? "Handed off" : "Handing off"} to ${
            target?.name ?? "another bot"
          }${part.input?.reason ? ` — ${part.input.reason}` : ""}`}
    </p>
  )
}

type ChatProps = {
  chatId: string
  name: string
  members: ChatMember[]
}

export function Chat({ chatId, name, members }: ChatProps) {
  // Group chats address one bot per turn; the transport threads this into the
  // per-turn metadata and live-updates when the selection changes.
  const [selectedBotId, setSelectedBotId] = React.useState(
    members[0]?.id ?? null
  )
  const transport = useTriggerChatTransport<typeof botChat>({
    task: "bot-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    clientData: selectedBotId ? { botId: selectedBotId } : undefined,
  })

  const { messages: savedMessages, isLoading } = useLoadTranscript(
    chatId,
    loadChatTranscript,
    { transport }
  )

  // useChat's messages option is initial state, so mount it only once the
  // saved transcript is in — initial messages and the transport's resume
  // cursor must describe the same transcript.
  if (isLoading) {
    return null
  }

  return (
    <ChatMessages
      chatId={chatId}
      name={name}
      members={members}
      transport={transport}
      initialMessages={savedMessages}
      selectedBotId={selectedBotId}
      onSelectBot={setSelectedBotId}
    />
  )
}

type ChatMessagesProps = {
  chatId: string
  name: string
  members: ChatMember[]
  transport: TriggerChatTransport
  initialMessages: InferChatUIMessage<typeof botChat>[]
  selectedBotId: string | null
  onSelectBot: (botId: string) => void
}

function ChatMessages({
  chatId,
  name,
  members,
  transport,
  initialMessages,
  selectedBotId,
  onSelectBot,
}: ChatMessagesProps) {
  const { messages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  })
  const toastUpgrade = useUpgradeToast()

  const selectedBot =
    members.find((member) => member.id === selectedBotId) ?? members[0]

  // The session/token/transcript actions throw UPGRADE_ERROR on the free
  // plan — surface it as the Upgrade toast with a pricing shortcut.
  React.useEffect(() => {
    if (error?.message === UPGRADE_ERROR) {
      toastUpgrade()
    }
  }, [error, toastUpgrade])

  // A handoff reroutes the conversation: follow the latest successful one so
  // the next message is answered by the bot it targeted. Manual re-selection
  // still wins — this only fires when the messages change.
  React.useEffect(() => {
    if (members.length <= 1) return
    for (let i = messages.length - 1; i >= 0; i--) {
      const handoff = messages[i].parts.find(
        (part) => part.type === "tool-handoff"
      )
      if (
        handoff?.state === "output-available" &&
        handoff.output.ok &&
        handoff.input.botId !== selectedBotId
      ) {
        onSelectBot(handoff.input.botId)
        break
      }
    }
  }, [messages, members, selectedBotId, onSelectBot])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title={`Say hi to ${name}`}
              description="Messages are saved in this chat — pick up where you left off."
            />
          ) : (
            messages.map((message) => {
              // Group chats stamp the responding bot's id onto the assistant
              // message metadata; no metadata (older transcripts, direct
              // chats) renders no avatar.
              const bot =
                message.role === "assistant" && members.length > 1
                  ? members.find((member) => member.id === message.metadata?.botId)
                  : undefined

              // The bot this prompt was addressed to — stamped at send time;
              // older messages without it show no badge.
              const addressedBot =
                message.role === "user" && members.length > 1
                  ? members.find((member) => member.id === message.metadata?.botId)
                  : undefined

              const renderPart = (
                part: BotChatUIMessage["parts"][number],
                index: number
              ) =>
                part.type === "text" ? (
                  <MessageResponse key={index}>{part.text}</MessageResponse>
                ) : part.type === "tool-handoff" ? (
                  <BotHandoff key={index} part={part} members={members} />
                ) : isToolPart(part) ? (
                  <BotToolCall key={index} part={part} />
                ) : null

              const [firstPart, ...restParts] = message.parts

              const content = (
                <MessageContent>
                  {addressedBot ? (
                    <>
                      {/* Tag style: the badge sits on the first line, mention-like. */}
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="max-w-32">
                          <ChatAvatar
                            seed={addressedBot.avatar}
                            className="size-3.5 shrink-0 rounded-full"
                          />
                          <span className="truncate">{addressedBot.name}</span>
                        </Badge>
                        {firstPart?.type === "text" && (
                          <MessageResponse className="min-w-0 flex-1">
                            {firstPart.text}
                          </MessageResponse>
                        )}
                      </div>
                      {restParts.map((part, index) => renderPart(part, index))}
                    </>
                  ) : (
                    message.parts.map((part, index) => renderPart(part, index))
                  )}
                </MessageContent>
              )

              return (
                <Message from={message.role} key={message.id}>
                  {bot ? (
                    <div className="flex items-start gap-2">
                      <ChatAvatar
                        seed={bot.avatar}
                        className="mt-0.5 size-6 shrink-0 rounded-full"
                      />
                      {content}
                    </div>
                  ) : (
                    content
                  )}
                </Message>
              )
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {error ? (
        <p className="px-4 pb-2 text-center text-sm text-destructive">
          {error.message === UPGRADE_ERROR
            ? "This chat needs the Pro plan."
            : "Something went wrong. Please try again."}
        </p>
      ) : null}
      <PromptInput
        className="m-4"
        onSubmit={({ text }) => {
          if (text?.trim()) {
            // Stamp the addressed bot onto the message — group chats show it
            // as a badge at the top of the prompt.
            sendMessage({
              text,
              metadata: selectedBotId ? { botId: selectedBotId } : undefined,
            })
          }
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea placeholder={`Message ${name}...`} />
        </PromptInputBody>
        <PromptInputFooter>
          {members.length > 1 && (
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger
                aria-label="Choose which bot replies"
                className="gap-1.5"
              >
                <ChatAvatar
                  seed={selectedBot?.avatar ?? ""}
                  className="size-5 rounded-full"
                />
                <span className="max-w-32 truncate text-xs text-muted-foreground">
                  {selectedBot?.name ?? name}
                </span>
              </PromptInputActionMenuTrigger>
              <PromptInputActionMenuContent>
                {members.map((member) => (
                  <PromptInputActionMenuItem
                    key={member.id}
                    onClick={() => onSelectBot(member.id)}
                  >
                    <ChatAvatar
                      seed={member.avatar}
                      className="size-5 rounded-full"
                    />
                    <span className="truncate">{member.name}</span>
                    {member.id === selectedBotId && (
                      <CheckIcon className="ml-auto" />
                    )}
                  </PromptInputActionMenuItem>
                ))}
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          )}
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
