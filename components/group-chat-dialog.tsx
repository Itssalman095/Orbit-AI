"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import { createGroupChat } from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
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
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  createGroupChatSchema,
  type CreateGroupChatInput,
} from "@/lib/validations/chat"
import type { BotListItem } from "@/queries/bots"

type GroupChatDialogProps = {
  bots: BotListItem[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GroupChatDialog({
  bots,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: GroupChatDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = openProp ?? internalOpen

  const form = useForm<CreateGroupChatInput>({
    resolver: zodResolver(createGroupChatSchema),
    defaultValues: {
      name: "",
      botIds: [],
    },
  })

  const selectedBotIds = useWatch({ control: form.control, name: "botIds" }) ?? []
  const isSubmitting = form.formState.isSubmitting

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChangeProp) {
      onOpenChangeProp(nextOpen)
    } else {
      setInternalOpen(nextOpen)
    }
    if (!nextOpen) {
      form.reset({ name: "", botIds: [] })
    }
  }

  const toggleBot = (botId: string, checked: boolean | "indeterminate") => {
    const current = form.getValues("botIds")
    form.setValue(
      "botIds",
      checked === true
        ? [...current, botId]
        : current.filter((id) => id !== botId),
      { shouldValidate: true }
    )
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await createGroupChat(values)
      if (!result.success) {
        form.setError("root", { message: result.error })
        return
      }
      toast.add({
        title: `${values.name} is ready`,
        description: "Your new group chat is ready.",
        type: "success",
      })
      handleOpenChange(false)
    } catch {
      form.setError("root", {
        message: "Something went wrong. Please try again.",
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the group and pick which bots are in it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                placeholder="Weekend plans"
                {...form.register("name")}
                aria-invalid={!!form.formState.errors.name}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.botIds}>
              <FieldLabel>Bots</FieldLabel>
              {bots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create a bot first — groups are built from your bots.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {bots.map((bot) => (
                    <label
                      key={bot.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedBotIds.includes(bot.id)}
                        onCheckedChange={(checked) => toggleBot(bot.id, checked)}
                        aria-label={`Add ${bot.name}`}
                      />
                      <ChatAvatar seed={bot.avatar} className="size-6" />
                      <span className="text-sm">{bot.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <FieldError errors={[form.formState.errors.botIds]} />
            </Field>
          </FieldGroup>
          <FieldError>{form.formState.errors.root?.message}</FieldError>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" disabled={isSubmitting} />}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || bots.length === 0}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
