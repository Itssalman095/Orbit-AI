"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { RefreshCwIcon, XIcon } from "lucide-react"

import { getVncUrl } from "@/actions/sandbox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { isUpgradeError, useUpgradeToast } from "@/lib/upgrade-toast"
import { cn } from "cn"

type VncStatus = "empty" | "loading" | "ready" | "error"

type VncContextValue = {
  status: VncStatus
  error: string | null
  // Mint the signed preview URL once; no-op when already loaded or loading.
  load: () => void
  // Re-mint the URL (expired link, sandbox restarted).
  refresh: () => void
  fullscreen: boolean
  setFullscreen: (open: boolean) => void
  // The elements the VNC screen should overlay, registered by the views.
  setPanelScreen: (element: HTMLElement | null) => void
  setDialogScreen: (element: HTMLElement | null) => void
}

const VncContext = React.createContext<VncContextValue | null>(null)

function useVnc() {
  const context = React.useContext(VncContext)
  if (!context) {
    throw new Error("VNC components must be used within a VncPreviewProvider")
  }
  return context
}

export function VncPreviewProvider({
  chatId,
  name,
  children,
}: {
  chatId: string
  name: string
  children: React.ReactNode
}) {
  const [url, setUrl] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<VncStatus>("empty")
  const [error, setError] = React.useState<string | null>(null)
  const [fullscreen, setFullscreen] = React.useState(false)
  const toastUpgrade = useUpgradeToast()
  const [panelScreen, setPanelScreen] = React.useState<HTMLElement | null>(null)
  const [dialogScreen, setDialogScreen] =
    React.useState<HTMLElement | null>(null)

  // Moving an iframe in the DOM reloads it and drops the VNC connection, so
  // the iframe is rendered exactly once into a portal host on <body> and then
  // repositioned over whichever screen element (panel preview or fullscreen
  // dialog) is currently active.
  const [host] = React.useState(() =>
    typeof document === "undefined" ? null : document.createElement("div")
  )
  React.useEffect(() => {
    if (!host) return
    document.body.appendChild(host)
    return () => {
      host.remove()
    }
  }, [host])

  const loadingRef = React.useRef(false)
  const fetchUrl = React.useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setStatus("loading")
    const result = await getVncUrl(chatId)
    loadingRef.current = false
    if (result.success) {
      setUrl(result.url)
      setError(null)
      setStatus("ready")
    } else {
      setError(result.error)
      setStatus("error")
      if (isUpgradeError(result.error)) {
        toastUpgrade()
      }
    }
  }, [chatId, toastUpgrade])

  const load = React.useCallback(() => {
    if (url || loadingRef.current) return
    void fetchUrl()
  }, [url, fetchUrl])

  const refresh = React.useCallback(() => {
    void fetchUrl()
  }, [fetchUrl])

  const target = fullscreen ? dialogScreen : panelScreen

  // Glue the fixed overlay to the active screen element, surviving resizable
  // panel drags and window resizes.
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  React.useLayoutEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    if (!target) {
      overlay.style.visibility = "hidden"
      return
    }
    const sync = () => {
      const rect = target.getBoundingClientRect()
      overlay.style.top = `${rect.top}px`
      overlay.style.left = `${rect.left}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
    }
    sync()
    overlay.style.visibility = "visible"
    const observer = new ResizeObserver(sync)
    observer.observe(target)
    window.addEventListener("resize", sync)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", sync)
    }
  }, [target, host])

  const value = React.useMemo<VncContextValue>(
    () => ({
      status,
      error,
      load,
      refresh,
      fullscreen,
      setFullscreen,
      setPanelScreen,
      setDialogScreen,
    }),
    [status, error, load, refresh, fullscreen]
  )

  return (
    <VncContext.Provider value={value}>
      {children}
      {host &&
        createPortal(
          <div
            ref={overlayRef}
            className={cn(
              "fixed z-[60] invisible overflow-hidden rounded-lg",
              fullscreen ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            {url && (
              <iframe
                src={url}
                title={`${name}'s screen`}
                allow="clipboard-read; clipboard-write"
                className="size-full border-0"
              />
            )}
          </div>,
          host
        )}
      <VncFullscreenDialog name={name} />
    </VncContext.Provider>
  )
}

// The panel preview: passive screen thumbnail — clicking it opens the
// fullscreen dialog where the VNC accepts input.
export function VncPanelPreview({ name }: { name: string }) {
  const { status, error, load, refresh, setFullscreen, setPanelScreen } =
    useVnc()

  // First time the desktop panel opens; reused afterwards via the context.
  React.useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Reload screen"
          disabled={status === "loading"}
          onClick={refresh}
        >
          {status === "loading" ? <Spinner /> : <RefreshCwIcon />}
        </Button>
      </div>
      <button
        type="button"
        ref={setPanelScreen}
        aria-label={`Open ${name}'s screen in fullscreen`}
        onClick={() => setFullscreen(true)}
        className="relative aspect-video w-full cursor-pointer overflow-hidden rounded-lg border bg-muted/50"
      >
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <Spinner className="size-6" />
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted-foreground">
            {error}
          </div>
        )}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        {name}&apos;s screen
      </p>
    </div>
  )
}

function VncFullscreenDialog({ name }: { name: string }) {
  const { status, fullscreen, setFullscreen, refresh, setDialogScreen } =
    useVnc()

  return (
    <Dialog
      // Non-modal: Base UI's focus trap would fight the VNC iframe for focus,
      // making the desktop impossible to type into.
      modal={false}
      open={fullscreen}
      onOpenChange={(open, details) => {
        // The VNC owns the keyboard — only the close button may dismiss the
        // dialog. Ignore Escape, outside presses and focus loss.
        if (
          !open &&
          details.reason !== "close-press" &&
          details.reason !== "imperative-action"
        ) {
          return
        }
        setFullscreen(open)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] flex-col sm:max-w-[calc(100vw-2rem)]"
      >
        <DialogTitle className="sr-only">{name}&apos;s screen</DialogTitle>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{name}&apos;s screen</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Reload screen"
              disabled={status === "loading"}
              onClick={refresh}
            >
              {status === "loading" ? <Spinner /> : <RefreshCwIcon />}
            </Button>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close fullscreen"
                />
              }
            >
              <XIcon />
            </DialogClose>
          </div>
        </div>
        {/* The VNC overlay glues itself to this element while open. */}
        <div ref={setDialogScreen} className="min-h-0 flex-1" />
      </DialogContent>
    </Dialog>
  )
}
