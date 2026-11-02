import { create } from "zustand"
import { clearProfileLogs, profileLogs } from "@/lib/ipc"

type LogsState = {
  byId: Record<string, string[]>
  error: string | null
  load: (id: string) => Promise<void>
  clear: (id: string) => Promise<void>
}

function errorText(error: unknown) {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  return String(error)
}

export const useLogs = create<LogsState>((set) => ({
  byId: {},
  error: null,

  load: async (id) => {
    try {
      const lines = await profileLogs(id)
      set((state) => ({
        byId: { ...state.byId, [id]: lines },
        error: null,
      }))
    } catch (error) {
      set({ error: errorText(error) })
    }
  },

  clear: async (id) => {
    try {
      await clearProfileLogs(id)
      set((state) => ({
        byId: { ...state.byId, [id]: [] },
        error: null,
      }))
    } catch (error) {
      set({ error: errorText(error) })
    }
  },
}))
