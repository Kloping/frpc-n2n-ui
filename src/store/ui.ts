import { create } from "zustand"

type UiState = {
  logOpen: boolean
  toggleLog: () => void
}

export const useUi = create<UiState>((set) => ({
  logOpen: true,
  toggleLog: () => set((state) => ({ logOpen: !state.logOpen })),
}))
