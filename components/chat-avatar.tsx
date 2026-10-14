import { Avatar, Style } from "@dicebear/core"
import gaze from "@dicebear/styles/gaze.json" with { type: "json" }
import Image from "next/image"

const gazeStyle = new Style(gaze)

type ChatAvatarProps = {
  seed: string
  animation?: boolean
  className?: string
}

export function ChatAvatar({ seed, animation = false, className }: ChatAvatarProps) {
  const dataUri = new Avatar(gazeStyle, {
    seed,
    size: 64,
    ...(animation ? { tags: ["animation"] } : {}),
  }).toDataUri()

  return (
    <Image
      src={dataUri}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={className}
    />
  )
}
