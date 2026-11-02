import { useEffect } from "react"
import { AlertTriangle, PanelBottom } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { LogDock } from "@/app/LogDock"
import { MainPanel } from "@/app/MainPanel"
import { Sidebar } from "@/app/Sidebar"
import { ProfileDialog } from "@/features/profiles/ProfileDialog"
import { nextAdminPort } from "@/lib/types"
import { useProfiles } from "@/store/profiles"
import { useRuntime } from "@/store/runtime"
import { useUi } from "@/store/ui"

export default function App() {
  const hydrate = useProfiles((state) => state.hydrate)
  const profiles = useProfiles((state) => state.profiles)
  const profileError = useProfiles((state) => state.error)
  const clearProfileError = useProfiles((state) => state.clearError)
  const runtimeError = useRuntime((state) => state.error)
  const clearRuntimeError = useRuntime((state) => state.clearError)
  const refreshRuntime = useRuntime((state) => state.refresh)
  const logVisible = useUi((state) => state.logVisible)
  const logMaximized = useUi((state) => state.logMaximized)
  const showLog = useUi((state) => state.showLog)
  const themeMode = useUi((state) => state.themeMode)
  const profileDialogOpen = useUi((state) => state.profileDialogOpen)
  const setProfileDialogOpen = useUi((state) => state.setProfileDialogOpen)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    void refreshRuntime()
    const timer = window.setInterval(() => void refreshRuntime(), 1000)
    return () => window.clearInterval(timer)
  }, [refreshRuntime])

  useEffect(() => {
    try {
      void getCurrentWindow()
        .setTheme(themeMode === "system" ? null : themeMode)
        .catch(() => {})
    } catch {
      // Browser preview has no Tauri window to theme.
    }
  }, [themeMode])

  const error = profileError ?? runtimeError
  const clearError = profileError ? clearProfileError : clearRuntimeError

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {error && (
          <div
            role="alert"
            className="flex shrink-0 items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive"
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="rounded-sm px-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              关闭
            </button>
          </div>
        )}
        {!logMaximized && <MainPanel />}
        {logVisible ? (
          <LogDock />
        ) : (
          <button
            type="button"
            onClick={showLog}
            className="absolute right-3 bottom-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <PanelBottom className="size-3.5" />
            显示日志
          </button>
        )}
      </main>
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        defaultAdminPort={nextAdminPort(profiles)}
      />
    </div>
  )
}
