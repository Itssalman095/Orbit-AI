import { ChatAvatar } from "@/components/chat-avatar"
import { cn } from "cn"

type GroupChatAvatarProps = {
  // All member bot avatar seeds, earliest member first.
  seeds: string[]
  className?: string
}

// Tile positions inside the square (each tile is 52%, so neighbours overlap):
// 1 member: the face alone. 2: side by side, vertically centered. 3: triangle
// (top center, bottom left, bottom right). 4+: 2x2 grid, the fourth slot
// counts the rest ("+N").
const TILE_POSITIONS: Record<number, string[]> = {
  2: ["top-1/4 left-0", "top-1/4 right-0"],
  3: ["top-0 left-1/4", "bottom-0 left-0", "bottom-0 right-0"],
  4: ["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"],
}

export function GroupChatAvatar({ seeds, className }: GroupChatAvatarProps) {
  if (seeds.length <= 1) {
    return <ChatAvatar seed={seeds[0] ?? ""} className={className} />
  }

  const shown = seeds.slice(0, 3)
  const rest = seeds.length - shown.length
  const positions = TILE_POSITIONS[rest > 0 ? 4 : shown.length]

  return (
    <div className={cn("relative shrink-0", className)}>
      {shown.map((seed, index) => (
        <ChatAvatar
          key={index}
          seed={seed}
          className={cn(
            "absolute size-[52%] rounded-full ring-1 ring-background",
            positions[index]
          )}
        />
      ))}
      {rest > 0 && (
        <div className="absolute right-0 bottom-0 flex size-[52%] items-center justify-center rounded-full bg-muted ring-1 ring-background">
          <span className="text-[10px] leading-none font-medium text-foreground">
            +{rest}
          </span>
        </div>
      )}
    </div>
  )
}
