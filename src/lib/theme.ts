export type ThemeMode = "system" | "light" | "dark"

const STORAGE_KEY = "frpc-theme"

export function loadThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored
    }
  } catch {
    // localStorage can be unavailable in restricted webviews.
  }
  return "system"
}

export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle("light", mode === "light")
  root.classList.toggle("dark", mode === "dark")
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Theme still applies for this session.
  }
}
