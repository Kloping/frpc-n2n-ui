import { useEffect, useRef } from "react"
import { EyeOff, Maximize2, Minimize2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLogs } from "@/store/logs"
import { useProfiles } from "@/store/profiles"
import { useUi } from "@/store/ui"

const EMPTY_LOGS: string[] = []

function lineClass(line: string) {
  if (line.includes("[E]")) return "text-destructive"
  if (line.includes("[W]")) return "text-signal"
  return "text-muted-foreground"
}

export function LogDock() {
  const selectedId = useProfiles((state) => state.selectedId)
  const profile = useProfiles((state) =>
    state.profiles.find((item) => item.id === state.selectedId),
  )
  const logsById = useLogs((state) => state.byId)
  const loadLogs = useLogs((state) => state.load)
  const clearLogs = useLogs((state) => state.clear)
  const logError = useLogs((state) => state.error)
  const logMaximized = useUi((state) => state.logMaximized)
  const logHeight = useUi((state) => state.logHeight)
  const hideLog = useUi((state) => state.hideLog)
  const toggleLogMaximized = useUi((state) => state.toggleLogMaximized)
  const setLogHeight = useUi((state) => state.setLogHeight)
  const bodyRef = useRef<HTMLDivElement>(null)

  const logs = selectedId ? (logsById[selectedId] ?? EMPTY_LOGS) : EMPTY_LOGS
  const logTail = logs.length > 0 ? logs[logs.length - 1] : ""

  useEffect(() => {
    if (!selectedId) return
    void loadLogs(selectedId)
    const timer = window.setInterval(() => void loadLogs(selectedId), 1000)
    return () => window.clearInterval(timer)
  }, [selectedId, loadLogs])

  useEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [logTail, logMaximized, selectedId])

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (logMaximized) return
    event.preventDefault()

    const startY = event.clientY
    const startHeight = logHeight
    const body = document.body
    const previousCursor = body.style.cursor
    const previousSelect = body.style.userSelect
    body.style.cursor = "ns-resize"
    body.style.userSelect = "none"

    const move = (moveEvent: PointerEvent) => {
      const max = Math.max(64, window.innerHeight * 0.7)
      const next = Math.min(max, Math.max(64, startHeight - (moveEvent.clientY - startY)))
      setLogHeight(Math.round(next))
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

  return (
    <section
      className={cn(
        "relative flex flex-col border-t border-border bg-card",
        logMaximized ? "min-h-0 flex-1" : "shrink-0",
      )}
    >
      {!logMaximized && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="调整日志高度"
          onPointerDown={startResize}
          className="absolute inset-x-0 -top-1 z-10 h-2 cursor-ns-resize touch-none"
        >
          <div className="mx-auto mt-[3px] h-px w-full bg-transparent transition-colors hover:bg-signal/60" />
        </div>
      )}

      <div className="flex h-8 shrink-0 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">日志</span>
          {profile && (
            <span className="truncate text-[11px] text-muted-foreground/70">
              {profile.name}
            </span>
          )}
          {logs.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/50">
              {logs.length}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {profile && (
            <button
              type="button"
              onClick={() => void clearLogs(profile.id)}
              disabled={logs.length === 0}
              className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
            >
              <Trash2 className="size-3" />
              清空
            </button>
          )}
          <button
            type="button"
            onClick={toggleLogMaximized}
            title={logMaximized ? "还原日志高度" : "日志铺满内容区"}
            className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {logMaximized ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
            {logMaximized ? "还原" : "铺满"}
          </button>
          <button
            type="button"
            onClick={hideLog}
            title="隐藏日志"
            className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <EyeOff className="size-3" />
            隐藏
          </button>
        </div>
      </div>

      <div
        ref={bodyRef}
        style={logMaximized ? undefined : { height: logHeight }}
        className={cn(
          "overflow-x-hidden overflow-y-auto border-t border-border px-3 py-2 font-mono text-xs leading-5",
          logMaximized && "min-h-0 flex-1",
        )}
      >
        {logError ? (
          <p className="text-destructive">{logError}</p>
        ) : !profile ? (
          <p className="text-muted-foreground/70">选择服务器后查看日志</p>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground/70">
            暂无日志，启动服务器后会显示 frpc 输出
          </p>
        ) : (
          logs.map((line, index) => (
            <div
              key={`${index}-${line}`}
              className={cn("whitespace-pre-wrap [overflow-wrap:anywhere]", lineClass(line))}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
