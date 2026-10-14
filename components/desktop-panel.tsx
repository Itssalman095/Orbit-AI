"use client"

import * as React from "react"
import { MonitorIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable"

type DesktopPanelContextValue = {
  open: boolean
  toggle: () => void
}

const DesktopPanelContext = React.createContext<DesktopPanelContextValue | null>(
  null
)

function useDesktopPanel() {
  const context = React.useContext(DesktopPanelContext)
  if (!context) {
    throw new Error(
      "DesktopPanel components must be used within a DesktopPanelProvider"
    )
  }
  return context
}

export function DesktopPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((value) => !value), [])

  return (
    <DesktopPanelContext.Provider value={{ open, toggle }}>
      {children}
    </DesktopPanelContext.Provider>
  )
}

export function DesktopPanelToggle() {
  const { open, toggle } = useDesktopPanel()

  return (
    <Button
      variant={open ? "secondary" : "ghost"}
      size="icon"
      aria-label="Toggle desktop panel"
      aria-pressed={open}
      onClick={toggle}
    >
      <MonitorIcon />
    </Button>
  )
}

export function DesktopPanel({ children }: { children?: React.ReactNode }) {
  const { open } = useDesktopPanel()
  if (!open) {
    return null
  }

  return (
    <>
      <ResizableHandle />
      <ResizablePanel defaultSize="30">{children}</ResizablePanel>
    </>
  )
}
