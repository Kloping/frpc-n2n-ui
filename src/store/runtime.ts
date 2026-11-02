import { create } from "zustand"
import { runtimeSnapshot, startProfiles, stopProfiles } from "@/lib/ipc"
import type { RuntimeInfo } from "@/lib/types"

type RuntimeState = {
  statuses: Record<string, RuntimeInfo>
  pending: Record<string, boolean>
  error: string | null
  refresh: () => Promise<void>
  start: (ids: string[]) => Promise<void>
  stop: (ids: string[]) => Promise<void>
  clearError: () => void
}

function errorText(error: unknown) {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  return String(error)
}

function setPending(pending: Record<string, boolean>, ids: string[], value: boolean) {
  const next = { ...pending }
  for (const id of ids) {
    if (value) next[id] = true
    else delete next[id]
  }
  return next
}

export const useRuntime = create<RuntimeState>((set, get) => ({
  statuses: {},
  pending: {},
  error: null,

  refresh: async () => {
    try {
      set({ statuses: await runtimeSnapshot() })
    } catch (error) {
      set({ error: errorText(error) })
    }
  },

  start: async (ids) => {
    const targets = ids.filter((id) => !get().statuses[id]?.running)
    if (targets.length === 0) return

    set((state) => ({
      pending: setPending(state.pending, targets, true),
      error: null,
    }))
    try {
      await startProfiles(targets)
    } catch (error) {
      set({ error: errorText(error) })
    } finally {
      set((state) => ({ pending: setPending(state.pending, targets, false) }))
      await get().refresh()
    }
  },

  stop: async (ids) => {
    const targets = ids.filter((id) => get().statuses[id]?.running)
    if (targets.length === 0) return

    set((state) => ({
      pending: setPending(state.pending, targets, true),
      error: null,
    }))
    try {
      await stopProfiles(targets)
    } catch (error) {
      set({ error: errorText(error) })
    } finally {
      set((state) => ({ pending: setPending(state.pending, targets, false) }))
      await get().refresh()
    }
  },

  clearError: () => set({ error: null }),
}))
