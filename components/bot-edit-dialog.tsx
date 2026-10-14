"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShuffleIcon, Trash2Icon } from "lucide-react"
import { nanoid } from "nanoid"
import { useForm, useWatch } from "react-hook-form"

import { deleteBot, updateBot } from "@/actions/bot"
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { createBotSchema, type CreateBotInput } from "@/lib/validations/bot"
import type { ChatBot } from "@/queries/chats"

type EditBotDialogProps = {
  bot: ChatBot
  // The chat the bot belongs to — deleted together with the bot.
  chatId: string
  // The trigger content: this chat's avatar and name.
  children: React.ReactNode
}

export function EditBotDialog({ bot, chatId, children }: EditBotDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [isDeleting, startDelete] = React.useTransition()

  const form = useForm<CreateBotInput>({
    resolver: zodResolver(createBotSchema),
    defaultValues: {
      name: bot.name,
      job: bot.job,
      instructions: bot.instructions ?? "",
      avatar: bot.avatar,
    },
  })

  const avatar = useWatch({ control: form.control, name: "avatar" })
  const isSubmitting = form.formState.isSubmitting

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      form.reset({
        name: bot.name,
        job: bot.job,
        instructions: bot.instructions ?? "",
        avatar: bot.avatar,
      })
    }
  }

  const shuffleFace = () => {
    form.setValue("avatar", nanoid())
  }

  const onDelete = () => {
    startDelete(async () => {
      try {
        const result = await deleteBot(bot.id, chatId)
        // On success the action redirects to "/" — no client-side handling.
        if (result && !result.success) {
          setConfirmOpen(false)
          toast.add({
            title: "Couldn't delete bot",
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

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await updateBot(bot.id, values)
      if (!result.success) {
        form.setError("root", { message: result.error })
        return
      }
      toast.add({
        title: `${values.name} updated`,
        description: "Your changes are live.",
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
          <DialogTitle>Edit bot</DialogTitle>
          <DialogDescription>
            Update its face, name, and job to do.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <ChatAvatar seed={avatar} className="size-10" />
            <FieldContent>
              <FieldTitle>Face</FieldTitle>
              <FieldDescription>
                Shuffle until you find one you like.
              </FieldDescription>
            </FieldContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={shuffleFace}
            >
              <ShuffleIcon data-icon="inline-start" />
              Shuffle
            </Button>
          </Field>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                placeholder="Ada"
                {...form.register("name")}
                aria-invalid={!!form.formState.errors.name}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.job}>
              <FieldLabel htmlFor="job">Job</FieldLabel>
              <Input
                id="job"
                placeholder="Research assistant"
                {...form.register("job")}
                aria-invalid={!!form.formState.errors.job}
              />
              <FieldError errors={[form.formState.errors.job]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.instructions}>
              <FieldLabel htmlFor="instructions">How it should work</FieldLabel>
              <Textarea
                id="instructions"
                rows={4}
                placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                {...form.register("instructions")}
                aria-invalid={!!form.formState.errors.instructions}
              />
              <FieldError errors={[form.formState.errors.instructions]} />
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
                  <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the bot and its chat. This cannot
                    be undone.
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
