import { useEffect, useState } from "react"
import {
  Download,
  Loader2,
  Monitor,
  Moon,
  Play,
  Plus,
  Square,
  Sun,
  Upload,
  X,
} from "lucide-react"
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/form"
import { exportProfileConfig, importProfileConfig } from "@/lib/ipc"
import { cn } from "@/lib/utils"
import type { ThemeMode } from "@/lib/theme"
import { emptyProfile, nextAdminPort, type Profile } from "@/lib/types"
import { useProfiles } from "@/store/profiles"
import { useRuntime } from "@/store/runtime"
import { useUi } from "@/store/ui"

const themeOptions: {
  value: ThemeMode
  label: string
  icon: typeof Monitor
}[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
]

function errorText(error: unknown) {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  return String(error)
}

function reportError(error: unknown) {
  useProfiles.setState({ error: errorText(error) })
}

function importedName(path: string, profiles: Profile[]) {
  const raw =
    path
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.toml$/i, "")
      .trim() || "导入的服务器"
  let name = raw
  let index = 2
  while (profiles.some((profile) => profile.name === name)) {
    name = `${raw} ${index}`
    index += 1
  }
  return name
}

export function Sidebar() {
  const profiles = useProfiles((state) => state.profiles)
  const selectedId = useProfiles((state) => state.selectedId)
  const select = useProfiles((state) => state.select)
  const save = useProfiles((state) => state.save)
  const statuses = useRuntime((state) => state.statuses)
  const pending = useRuntime((state) => state.pending)
  const start = useRuntime((state) => state.start)
  const stop = useRuntime((state) => state.stop)
  const sidebarWidth = useUi((state) => state.sidebarWidth)
  const setSidebarWidth = useUi((state) => state.setSidebarWidth)
  const themeMode = useUi((state) => state.themeMode)
  const setThemeMode = useUi((state) => state.setThemeMode)
  const setProfileDialogOpen = useUi((state) => state.setProfileDialogOpen)

  const [checked, setChecked] = useState<string[]>([])
  const [menu, setMenu] = useState<{ profile: Profile | null; x: number; y: number } | null>(
    null,
  )
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    setChecked((current) =>
      current.filter((id) => profiles.some((profile) => profile.id === id)),
    )
  }, [profiles])

  useEffect(() => {
    if (!menu) return

    const close = () => setMenu(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-server-menu]")) {
        close()
      }
    }

    window.addEventListener("pointerdown", onPointer)
    window.addEventListener("blur", close)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("blur", close)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", close, true)
    }
  }, [menu])

  const allChecked = profiles.length > 0 && checked.length === profiles.length
  const hasPending = checked.some((id) => pending[id])
  const canStart = checked.some((id) => !statuses[id]?.running)
  const canStop = checked.some((id) => statuses[id]?.running)

  function toggleChecked(id: string) {
    setChecked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  function toggleAll() {
    setChecked(allChecked ? [] : profiles.map((profile) => profile.id))
  }

  function batchStart() {
    const ids = checked.filter((id) => !statuses[id]?.running)
    if (ids.length > 0) void start(ids)
  }

  function batchStop() {
    const ids = checked.filter((id) => statuses[id]?.running)
    if (ids.length > 0) void stop(ids)
  }

  function openMenu(event: React.MouseEvent, profile: Profile) {
    event.preventDefault()
    event.stopPropagation()
    select(profile.id)
    setMenu({
      profile,
      x: Math.min(event.clientX, window.innerWidth - 204),
      y: Math.min(event.clientY, window.innerHeight - 128),
    })
  }

  function openBlankMenu(event: React.MouseEvent) {
    event.preventDefault()
    setMenu({
      profile: null,
      x: Math.min(event.clientX, window.innerWidth - 204),
      y: Math.min(event.clientY, window.innerHeight - 96),
    })
  }

  async function exportConfig(profile: Profile) {
    setMenu(null)
    try {
      const safeName = profile.name.replace(/[\\/:*?"<>|]/g, "_") || "frpc"
      const path = await saveDialog({
        defaultPath: `${safeName}.toml`,
        filters: [{ name: "frpc TOML", extensions: ["toml"] }],
      })
      if (!path) return
      setTransferring(true)
      await exportProfileConfig(path, profile)
    } catch (error) {
      reportError(error)
    } finally {
      setTransferring(false)
    }
  }

  async function importConfig(target?: Profile) {
    setMenu(null)
    try {
      const path = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "frpc TOML", extensions: ["toml"] }],
      })
      if (typeof path !== "string") return
      setTransferring(true)
      if (!target) {
        const base = {
          ...emptyProfile(nextAdminPort(profiles)),
          name: importedName(path, profiles),
        }
        const imported = await importProfileConfig(path, base)
        await save({ ...imported, adminPort: nextAdminPort(profiles) })
        return
      }
      const imported = await importProfileConfig(path, target)
      if (
        !window.confirm(
          `导入将覆盖服务器「${target.name}」的当前配置，共 ${imported.proxies.length} 条转发。继续？`,
        )
      ) {
        return
      }
      await save(imported)
    } catch (error) {
      reportError(error)
    } finally {
      setTransferring(false)
    }
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = sidebarWidth
    const body = document.body
    const previousCursor = body.style.cursor
    const previousSelect = body.style.userSelect
    body.style.cursor = "ew-resize"
    body.style.userSelect = "none"

    const move = (moveEvent: PointerEvent) => {
      const max = Math.min(420, window.innerWidth * 0.45)
      const next = Math.min(max, Math.max(220, startWidth + (moveEvent.clientX - startX)))
      setSidebarWidth(next)
    }
    const stop = () => {
      body.style.cursor = previousCursor
      body.style.userSelect = previousSelect
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }

    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  const menuRunning = menu?.profile ? statuses[menu.profile.id]?.running === true : false
  const menuPending = menu?.profile ? pending[menu.profile.id] === true : false
  const menuProfile = menu?.profile ?? null

  return (
    <aside
      style={{ width: sidebarWidth }}
      className="relative flex shrink-0 flex-col border-r border-border bg-card"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整侧栏宽度"
        onPointerDown={startResize}
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-ew-resize touch-none"
      >
        <div className="mx-auto h-full w-px bg-transparent transition-colors hover:bg-signal/60" />
      </div>

      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {profiles.length > 0 && (
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="全选服务器"
              className="size-3.5 accent-[var(--signal)]"
            />
          )}
          服务器
        </label>
        {profiles.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground/70">
            {profiles.length}
          </span>
        )}
      </div>

      {checked.length > 0 && (
        <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-background/40 px-2">
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            已选 {checked.length}
          </span>
          <button
            type="button"
            onClick={batchStart}
            disabled={!canStart || hasPending}
            title="批量启动"
            className="inline-flex h-7 items-center gap-1 rounded-sm px-1.5 text-[11px] text-ok transition-colors hover:bg-ok/10 disabled:pointer-events-none disabled:opacity-35"
          >
            <Play className="size-3" />
            启动
          </button>
          <button
            type="button"
            onClick={batchStop}
            disabled={!canStop || hasPending}
            title="批量停止"
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-sm px-1.5 text-[11px] transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-35",
              canStop ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Square className="size-3" />
            停止
          </button>
          <button
            type="button"
            onClick={() => setChecked([])}
            aria-label="清空选择"
            title="清空选择"
            className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {profiles.length === 0 ? (
        <div
          onContextMenu={openBlankMenu}
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center"
        >
          <p className="text-[13px]">还没有服务器</p>
          <p className="text-xs text-muted-foreground">添加一台后就能转发端口</p>
        </div>
      ) : (
        <div
          onContextMenu={openBlankMenu}
          className="min-h-0 flex-1 overflow-y-auto py-1"
        >
          {profiles.map((profile) => {
            const active = profile.id === selectedId
            const info = statuses[profile.id]
            const running = info?.running === true
            const failed = !running && Boolean(info?.error)
            const busy = pending[profile.id] === true

            return (
              <div
                key={profile.id}
                onContextMenu={(event) => openMenu(event, profile)}
                className={cn(
                  "flex items-center gap-1 border-l-2 pr-1.5 transition-colors",
                  active
                    ? "border-signal bg-accent"
                    : "border-transparent hover:bg-accent/60",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked.includes(profile.id)}
                  onChange={() => toggleChecked(profile.id)}
                  aria-label={`选择 ${profile.name}`}
                  className="ml-2 size-3.5 shrink-0 accent-[var(--signal)]"
                />
                <button
                  type="button"
                  onClick={() => select(profile.id)}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 py-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex w-full items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        running
                          ? "bg-ok"
                          : failed
                            ? "bg-destructive"
                            : "bg-idle",
                        busy && "animate-pulse",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {profile.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                      {profile.proxies.length}
                    </span>
                  </span>
                  <span className="truncate pl-3.5 font-mono text-[11px] text-muted-foreground">
                    {profile.serverAddr}:{profile.serverPort}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    running ? void stop([profile.id]) : void start([profile.id])
                  }
                  disabled={busy}
                  aria-label={running ? `停止 ${profile.name}` : `启动 ${profile.name}`}
                  title={
                    info?.error ??
                    (running ? "停止服务器" : "启动服务器")
                  }
                  className={cn(
                    "shrink-0 rounded-sm p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
                    running
                      ? "text-ok hover:bg-ok/10"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : running ? (
                    <Square className="size-3" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {menu && (
        <div
          data-server-menu
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          className="fixed z-50 w-[196px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="truncate border-b border-border px-3 py-2 text-xs text-muted-foreground">
            {menuProfile?.name ?? "导入服务器"}
          </div>
          {menuProfile && (
            <button
              type="button"
              role="menuitem"
              disabled={transferring}
              onClick={() => void exportConfig(menuProfile)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              <Download className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1">导出配置</span>
              <span className="font-mono text-[10px] text-muted-foreground/70">TOML</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={transferring || menuRunning || menuPending}
            title={
              menuRunning
                ? "请先停止服务器"
                : menuPending
                  ? "请等待当前操作完成"
                  : undefined
            }
            onClick={() => void importConfig(menuProfile ?? undefined)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <Upload className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1">导入配置</span>
            <span className="font-mono text-[10px] text-muted-foreground/70">TOML</span>
          </button>
        </div>
      )}

      <div className="shrink-0 border-t border-border p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">主题</span>
          <div className="flex items-center gap-0.5 rounded-sm border border-border p-0.5">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setThemeMode(value)}
                aria-label={label}
                aria-pressed={themeMode === value}
                title={label}
                className={cn(
                  "rounded-sm p-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  themeMode === value
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => setProfileDialogOpen(true)}
        >
          <Plus className="size-3.5" />
          添加服务器
        </Button>
      </div>
    </aside>
  )
}
