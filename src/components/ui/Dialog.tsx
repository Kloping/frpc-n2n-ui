import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      className="m-auto w-[560px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="关闭"
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-4">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          {footer}
        </div>
      )}
    </dialog>
  )
}
