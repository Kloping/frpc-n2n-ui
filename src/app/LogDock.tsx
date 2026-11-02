import { ChevronDown, ChevronUp } from "lucide-react"
import { useUi } from "@/store/ui"

export function LogDock() {
  const logOpen = useUi((state) => state.logOpen)
  const toggleLog = useUi((state) => state.toggleLog)

  return (
    <section className="shrink-0 border-t border-border bg-card">
      <div className="flex h-8 items-center justify-between px-3">
        <span className="text-xs text-muted-foreground">日志</span>
        <button
          type="button"
          onClick={toggleLog}
          aria-expanded={logOpen}
          aria-label={logOpen ? "收起日志" : "展开日志"}
          className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {logOpen ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronUp className="size-4" />
          )}
        </button>
      </div>

      {logOpen && (
        <div className="h-32 overflow-y-auto border-t border-border px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
          暂无日志
        </div>
      )}
    </section>
  )
}
