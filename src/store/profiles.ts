import { create } from "zustand"
import { loadProfiles, saveProfiles } from "@/lib/ipc"
import type { Profile } from "@/lib/types"

type ProfilesState = {
  profiles: Profile[]
  selectedId: string | null
  loading: boolean
  saving: boolean
  hydrated: boolean
  error: string | null
  hydrate: () => Promise<void>
  select: (id: string | null) => void
  save: (profile: Profile) => Promise<boolean>
  remove: (id: string) => Promise<void>
  clearError: () => void
}

function errorText(error: unknown) {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  return String(error)
}

export const useProfiles = create<ProfilesState>((set, get) => ({
  profiles: [],
  selectedId: null,
  loading: false,
  saving: false,
  hydrated: false,
  error: null,

  hydrate: async () => {
    if (get().loading || get().hydrated) return
    set({ loading: true, error: null })
    try {
      const profiles = await loadProfiles()
      set({
        profiles,
        selectedId: profiles[0]?.id ?? null,
        loading: false,
        hydrated: true,
      })
    } catch (error) {
      set({ loading: false, hydrated: true, error: errorText(error) })
    }
  },

  select: (selectedId) => set({ selectedId }),

  save: async (profile) => {
    const { profiles, selectedId } = get()
    const exists = profiles.some((item) => item.id === profile.id)
    const next = exists
      ? profiles.map((item) => (item.id === profile.id ? profile : item))
      : [...profiles, profile]

    set({ profiles: next, selectedId: profile.id, saving: true, error: null })
    try {
      await saveProfiles(next)
      set({ saving: false })
      return true
    } catch (error) {
      set({ profiles, selectedId, saving: false, error: errorText(error) })
      return false
    }
  },

  remove: async (id) => {
    const { profiles, selectedId } = get()
    const next = profiles.filter((profile) => profile.id !== id)
    const nextSelected = selectedId === id ? (next[0]?.id ?? null) : selectedId

    set({ profiles: next, selectedId: nextSelected, saving: true, error: null })
    try {
      await saveProfiles(next)
      set({ saving: false })
    } catch (error) {
      set({ profiles, selectedId, saving: false, error: errorText(error) })
    }
  },

  clearError: () => set({ error: null }),
}))
