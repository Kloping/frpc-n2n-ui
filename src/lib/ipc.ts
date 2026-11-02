import { invoke } from "@tauri-apps/api/core"
import type { Profile, RuntimeInfo } from "@/lib/types"

export function loadProfiles() {
  return invoke<Profile[]>("load_profiles")
}

export function saveProfiles(profiles: Profile[]) {
  return invoke<string[]>("save_profiles", { profiles })
}

export function exportProfileConfig(path: string, profile: Profile) {
  return invoke<void>("export_profile_config", { path, profile })
}

export function importProfileConfig(path: string, profile: Profile) {
  return invoke<Profile>("import_profile_config", { path, profile })
}

export function startProfiles(ids: string[]) {
  return invoke<void>("start_profiles", { ids })
}

export function stopProfiles(ids: string[]) {
  return invoke<void>("stop_profiles", { ids })
}

export function runtimeSnapshot() {
  return invoke<Record<string, RuntimeInfo>>("runtime_snapshot")
}

export function profileLogs(id: string) {
  return invoke<string[]>("profile_logs", { id })
}

export function clearProfileLogs(id: string) {
  return invoke<void>("clear_logs", { id })
}
