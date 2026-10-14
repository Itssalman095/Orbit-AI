"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { useForm, useWatch } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
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
import { isUpgradeError, useUpgradeToast } from "@/lib/upgrade-toast"
import { createBotSchema, type CreateBotInput } from "@/lib/validations/bot"

const PRESETS = [
  {
    label: "Research assistant",
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    label: "Code reviewer",
    job: "Code reviewer",
    instructions:
      "Review diffs for correctness, style, and security. Explain your reasoning.",
  },
  {
    label: "Writing editor",
    job: "Writing editor",
    instructions:
      "Tighten the prose, preserve the author's voice, and flag unsupported claims.",
  },
  {
    label: "Tutor",
    job: "Tutor",
    instructions:
      "Explain step by step with examples, then check understanding before moving on.",
  },
] as const

type BotDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function BotDialog({
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: BotDialogProps = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = openProp ?? internalOpen
  const toastUpgrade = useUpgradeToast()

  const form = useForm<CreateBotInput>({
    resolver: zodResolver(createBotSchema),
    defaultValues: {
      name: "",
      job: "",
      instructions: "",
      avatar: nanoid(),
    },
  })

  const avatar = useWatch({ control: form.control, name: "avatar" })
  const isSubmitting = form.formState.isSubmitting

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChangeProp) {
      onOpenChangeProp(nextOpen)
    } else {
      setInternalOpen(nextOpen)
    }
    if (!nextOpen) {
      form.reset({
        name: "",
        job: "",
        instructions: "",
        avatar: nanoid(),
      })
    }
  }

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    form.setValue("job", preset.job)
    form.setValue("instructions", preset.instructions)
  }

  const shuffleFace = () => {
    form.setValue("avatar", nanoid())
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await createBot(values)
      if (!result.success) {
        // The billing gate gets the Upgrade toast (with a pricing shortcut)
        // instead of the plain form error.
        if (isUpgradeError(result.error)) {
          toastUpgrade()
          return
        }
        form.setError("root", { message: result.error })
        return
      }
      toast.add({
        title: `${values.name} is ready`,
        description: "Your new bot is ready to chat.",
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
      {openProp === undefined && (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          Create a new bot
        </DialogTrigger>
      )}      <DialogContent>
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Field orientation="horizontal">
            <ChatAvatar seed={avatar} className="size-10" />
            <FieldContent>
              <FieldTitle>Face</FieldTitle>
              <FieldDescription>
                Shuffle until you find one you like.
              </FieldDescription>
            </FieldContent>
            <Button type="button" variant="outline" size="sm" onClick={shuffleFace}>
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
            <DialogClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Create bot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
