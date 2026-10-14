"use client"

import * as React from "react"

// Replaces next-themes (unmaintained; its inline <script> trips React 19's
// dev warning for client-rendered scripts). The pre-paint script now lives
// in app/layout.tsx as server-rendered HTML.
type Theme = "light" | "dark" | "system"
const STORAGE_KEY = "theme"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey({ setTheme }: { setTheme: (theme: Theme) => void }) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      // Synthetic events (dev tools, browser extensions) may lack `key`.
      if (typeof event.key !== "string" || event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      const isDark = document.documentElement.classList.contains("dark")
      setTheme(isDark ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [setTheme])

  return null
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy init runs client-side only and doesn't affect the rendered tree
  // (ThemeHotkey renders null), so there's no hydration mismatch. The
  // layout's pre-paint script already resolved the theme onto <html>.
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === "undefined") return "system"
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  })

  React.useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = React.useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  return (
    <ThemeContext value={{ theme, setTheme }}>
      <ThemeHotkey setTheme={setTheme} />
      {children}
    </ThemeContext>
  )
}
