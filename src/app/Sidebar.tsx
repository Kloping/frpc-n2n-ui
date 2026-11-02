import { Plus } from "lucide-react"

export function Sidebar() {
  return (
    <aside className="flex w-62 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
        <span className="text-xs text-muted-foreground">服务器</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
        <p className="text-[13px]">还没有服务器</p>
        <p className="text-xs text-muted-foreground">添加一台后就能转发端口</p>
      </div>

      <div className="shrink-0 border-t border-border p-2">
        <button
          type="button"
          disabled
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13px] font-medium text-primary-foreground transition-colors disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          添加服务器
        </button>
      </div>
    </aside>
  )
}
