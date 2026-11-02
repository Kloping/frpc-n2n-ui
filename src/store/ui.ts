import { create } from "zustand"
import { applyThemeMode, loadThemeMode, type ThemeMode } from "@/lib/theme"

const SIDEBAR_KEY = "frpc-sidebar-width"
const LOG_HEIGHT_KEY = "frpc-log-height"

function storedNumber(key: string, fallback: number, min: number, max: number) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value = Number(raw)
    if (Number.isFinite(value)) {
      return Math.min(max, Math.max(min, Math.round(value)))
    }
  } catch {
    // Keep the default when storage is unavailable.
  }
  return fallback
}

function persistNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Preference only applies for this session.
  }
}

type UiState = {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  logVisible: boolean
  logMaximized: boolean
  logHeight: number
  hideLog: () => void
  showLog: () => void
  toggleLogMaximized: () => void
  setLogHeight: (height: number) => void
  profileDialogOpen: boolean
  setProfileDialogOpen: (open: boolean) => void
}

export const useUi = create<UiState>((set) => ({
  themeMode: loadThemeMode(),
  setThemeMode: (themeMode) => {
    applyThemeMode(themeMode)
    set({ themeMode })
  },
  sidebarWidth: storedNumber(SIDEBAR_KEY, 248, 220, 420),
  setSidebarWidth: (width) => {
    const next = Math.min(420, Math.max(220, Math.round(width)))
    persistNumber(SIDEBAR_KEY, next)
    set({ sidebarWidth: next })
  },
  logVisible: true,
  logMaximized: false,
  logHeight: storedNumber(LOG_HEIGHT_KEY, 128, 64, 700),
  hideLog: () => set({ logVisible: false, logMaximized: false }),
  showLog: () => set({ logVisible: true }),
  toggleLogMaximized: () =>
    set((state) => ({ logMaximized: !state.logMaximized })),
  setLogHeight: (height) => {
    const next = Math.min(700, Math.max(64, Math.round(height)))
    persistNumber(LOG_HEIGHT_KEY, next)
    set({ logHeight: next })
  },
  profileDialogOpen: false,
  setProfileDialogOpen: (profileDialogOpen) => set({ profileDialogOpen }),
}))
