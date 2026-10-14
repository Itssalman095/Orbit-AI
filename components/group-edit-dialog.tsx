"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Trash2Icon } from "lucide-react"

import {
  addBotToGroup,
  deleteGroupChat,
  removeBotFromGroup,
  updateGroupChat,
} from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  updateGroupChatSchema,
  type UpdateGroupChatInput,
} from "@/lib/validations/chat"
import type { ChatDetail } from "@/queries/chats"
import type { BotListItem } from "@/queries/bots"

type GroupEditDialogProps = {
  chat: Pick<ChatDetail, "id" | "name" | "members">
  // All of the user's bots — members are toggled against this list.
  bots: BotListItem[]
  // The trigger content: this group's name.
  children: React.ReactNode
}

// Opens from the group's name in the header, mirroring EditBotDialog: rename
// the group, add/remove member bots, or delete the whole group.
export function GroupEditDialog({
  chat,
  bots,
  children,
}: GroupEditDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [isDeleting, startDelete] = React.useTransition()
  // One member toggle in flight at a time — the checkbox spins while its
  // action runs and the revalidated props take over from there.
  const [pendingBotId, setPendingBotId] = React.useState<string | null>(null)

  const form = useForm<UpdateGroupChatInput>({
    resolver: zodResolver(updateGroupChatSchema),
    defaultValues: { name: chat.name },
  })

  const isSubmitting = form.formState.isSubmitting
  const memberIds = new Set(chat.members.map((member) => member.id))

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      form.reset({ name: chat.name })
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await updateGroupChat(chat.id, values)
      if (!result.success) {
        form.setError("root", { message: result.error })
        return
      }
      toast.add({
        title: "Group renamed",
        description: `The group is now called ${values.name}.`,
        type: "success",
      })
      handleOpenChange(false)
    } catch {
      form.setError("root", {
        message: "Something went wrong. Please try again.",
      })
    }
  })

  const toggleMember = (bot: BotListItem, add: boolean) => {
    setPendingBotId(bot.id)
    ;(async () => {
      try {
        const result = add
          ? await addBotToGroup({ chatId: chat.id, botId: bot.id })
          : await removeBotFromGroup({ chatId: chat.id, botId: bot.id })
        if (!result.success) {
          toast.add({
            title: add ? `Couldn't add ${bot.name}` : `Couldn't remove ${bot.name}`,
            description: result.error,
            type: "error",
          })
        }
      } catch {
        toast.add({
          title: "Something went wrong",
          description: "Please try again.",
          type: "error",
        })
      } finally {
        setPendingBotId(null)
      }
    })()
  }

  const onDelete = () => {
    startDelete(async () => {
      try {
        const result = await deleteGroupChat(chat.id)
        // On success the action redirects to "/" — no client-side handling.
        if (result && !result.success) {
          setConfirmOpen(false)
          toast.add({
            title: "Couldn't delete group",
            description: result.error,
            type: "error",
          })
        }
      } catch (error) {
        // redirect() in the action rejects the action promise with a
        // NEXT_REDIRECT digest error even on success — the navigation itself
        // already ran, so it's not a failure.
        if (
          error &&
          typeof error === "object" &&
          "digest" in error &&
          typeof error.digest === "string" &&
          error.digest.startsWith("NEXT_REDIRECT")
        ) {
          return
        }
        setConfirmOpen(false)
        toast.add({
          title: "Something went wrong",
          description: "Please try again.",
          type: "error",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto min-w-0 justify-start gap-2 px-2"
          />
        }
      >
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
          <DialogDescription>
            Rename the group and pick which bots are in it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="group-name">Name</FieldLabel>
              <Input
                id="group-name"
                placeholder="Weekend plans"
                {...form.register("name")}
                aria-invalid={!!form.formState.errors.name}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field>
              <FieldLabel>Bots</FieldLabel>
              <FieldDescription>
                Checked bots are in the group — changes save right away.
              </FieldDescription>
              {bots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create a bot first — groups are built from your bots.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {bots.map((bot) => {
                    const isMember = memberIds.has(bot.id)
                    const isPending = pendingBotId === bot.id
                    return (
                      <label
                        key={bot.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"
                      >
                        {isPending ? (
                          <Spinner className="size-4" />
                        ) : (
                          <Checkbox
                            checked={isMember}
                            onCheckedChange={(checked) =>
                              toggleMember(bot, checked === true)
                            }
                            aria-label={`${isMember ? "Remove" : "Add"} ${bot.name}`}
                          />
                        )}
                        <ChatAvatar seed={bot.avatar} className="size-6" />
                        <span className="truncate text-sm">{bot.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </Field>
          </FieldGroup>
          <FieldError>{form.formState.errors.root?.message}</FieldError>
          <DialogFooter>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="destructive"
                    className="sm:mr-auto"
                    disabled={isDeleting}
                  />
                }
              >
                <Trash2Icon data-icon="inline-start" />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the group and its history. The
                    bots stay — only the group goes. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    variant="destructive"
                    onClick={onDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Spinner data-icon="inline-start" /> : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={isSubmitting} />
              }
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
