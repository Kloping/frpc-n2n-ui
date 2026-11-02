import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Pencil,
  Play,
  Plus,
  Rows3,
  Server,
  Square,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/form"
import { ProfileDialog } from "@/features/profiles/ProfileDialog"
import { PortRangeDialog } from "@/features/proxies/PortRangeDialog"
import { ProxyDialog } from "@/features/proxies/ProxyDialog"
import { nextAdminPort, type Profile, type Proxy } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useProfiles } from "@/store/profiles"
import { useRuntime } from "@/store/runtime"
import { useUi } from "@/store/ui"

function remoteLabel(proxy: Proxy) {
  if (proxy.type === "tcp" || proxy.type === "udp" || proxy.type === "sudp") {
    return proxy.remotePort ? `:${proxy.remotePort}` : "未设置"
  }
  if (proxy.type === "http" || proxy.type === "https") {
    return proxy.customDomains[0] || proxy.subdomain || "未设置"
  }
  return "私密连接"
}

export function MainPanel() {
  const profiles = useProfiles((state) => state.profiles)
  const selectedId = useProfiles((state) => state.selectedId)
  const loading = useProfiles((state) => state.loading)
  const remove = useProfiles((state) => state.remove)
  const statuses = useRuntime((state) => state.statuses)
  const pending = useRuntime((state) => state.pending)
  const start = useRuntime((state) => state.start)
  const stop = useRuntime((state) => state.stop)
  const setProfileDialogOpen = useUi((state) => state.setProfileDialogOpen)

  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [proxyDialogOpen, setProxyDialogOpen] = useState(false)
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false)
  const [editingProxy, setEditingProxy] = useState<Proxy | undefined>()
  const [selectedProxyIds, setSelectedProxyIds] = useState<string[]>([])

  const profile = profiles.find((item) => item.id === selectedId)
  const info = profile ? statuses[profile.id] : undefined
  const running = info?.running === true
  const processError = running ? null : (info?.error ?? null)
  const busy = profile ? pending[profile.id] === true : false

  useEffect(() => {
    setSelectedProxyIds((current) =>
      profile
        ? current.filter((id) => profile.proxies.some((proxy) => proxy.id === id))
        : [],
    )
  }, [profile])

  function openProxy(proxy?: Proxy) {
    setEditingProxy(proxy)
    setProxyDialogOpen(true)
  }

  async function deleteProfile(target: Profile) {
    const message = target.proxies.length
      ? `删除服务器「${target.name}」？其下 ${target.proxies.length} 条转发也会删除。`
      : `删除服务器「${target.name}」？`
    if (window.confirm(message)) await remove(target.id)
  }

  async function deleteProxy(target: Profile, proxy: Proxy) {
    if (!window.confirm(`删除转发「${proxy.name}」？`)) return
    await useProfiles.getState().save({
      ...target,
      proxies: target.proxies.filter((item) => item.id !== proxy.id),
    })
  }

  function toggleProxyChecked(id: string) {
    setSelectedProxyIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  function toggleAllProxies() {
    if (!profile) return
    setSelectedProxyIds((current) =>
      profile.proxies.every((proxy) => current.includes(proxy.id))
        ? []
        : profile.proxies.map((proxy) => proxy.id),
    )
  }

  async function deleteSelected(target: Profile) {
    if (selectedProxyIds.length === 0) return
    if (!window.confirm(`删除选中的 ${selectedProxyIds.length} 条转发？`)) return
    const ids = new Set(selectedProxyIds)
    const ok = await useProfiles.getState().save({
      ...target,
      proxies: target.proxies.filter((proxy) => !ids.has(proxy.id)),
    })
    if (ok) setSelectedProxyIds([])
  }

  const allProxiesChecked =
    profile !== undefined &&
    profile.proxies.length > 0 &&
    selectedProxyIds.length === profile.proxies.length

  if (loading && profiles.length === 0) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center bg-background">
        <p className="text-[13px] text-muted-foreground">读取配置…</p>
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <Server className="size-8 text-idle" strokeWidth={1.25} />
        <div className="space-y-1">
          <p className="text-lg">还没有服务器</p>
          <p className="text-[13px] text-muted-foreground">
            添加一台 frps，再为它配置要转发的本地端口
          </p>
        </div>
        <Button variant="primary" onClick={() => setProfileDialogOpen(true)}>
          <Plus className="size-3.5" />
          添加服务器
        </Button>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-medium">{profile.name}</h1>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px]",
                running
                  ? "border-ok/30 bg-ok/10 text-ok"
                  : processError
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground",
              )}
            >
              {busy ? (
                <Loader2 className="size-2.5 animate-spin" />
              ) : (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    running
                      ? "bg-ok"
                      : processError
                        ? "bg-destructive"
                        : "bg-idle",
                  )}
                />
              )}
              {busy ? "处理中…" : running ? "运行中" : processError ? "异常" : "已停止"}
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {profile.serverAddr}:{profile.serverPort} · 管理端口 {profile.adminPort}
            {running && info?.pid ? ` · PID ${info.pid}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant={running ? "secondary" : "primary"}
            onClick={() =>
              running ? void stop([profile.id]) : void start([profile.id])
            }
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : running ? (
              <Square className="size-3" />
            ) : (
              <Play className="size-3.5" />
            )}
            {busy ? "处理中…" : running ? "停止" : "启动"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setEditProfileOpen(true)}
            disabled={running}
            title={running ? "请先停止服务器" : undefined}
          >
            <Pencil className="size-3.5" />
            编辑
          </Button>
          <Button
            variant="danger"
            onClick={() => void deleteProfile(profile)}
            disabled={running}
            title={running ? "请先停止服务器" : undefined}
          >
            <Trash2 className="size-3.5" />
            删除
          </Button>
        </div>
      </header>

      {processError && (
        <div className="flex shrink-0 items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 whitespace-pre-wrap break-words">{processError}</span>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{profile.proxies.length} 条转发</span>
          <span>{profile.autoStart ? "随应用启动" : "手动启动"}</span>
          {running && <span className="text-signal">停止后可编辑配置</span>}
        </div>
        <div className="flex items-center gap-2">
          {selectedProxyIds.length > 0 && (
            <Button
              variant="danger"
              onClick={() => void deleteSelected(profile)}
              disabled={running}
              title={running ? "请先停止服务器" : undefined}
            >
              <Trash2 className="size-3.5" />
              删除 {selectedProxyIds.length} 条
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => setRangeDialogOpen(true)}
            disabled={running}
            title={running ? "请先停止服务器" : undefined}
          >
            <Rows3 className="size-3.5" />
            批量添加
          </Button>
          <Button
            variant="secondary"
            onClick={() => openProxy()}
            disabled={running}
            title={running ? "请先停止服务器" : undefined}
          >
            <Plus className="size-3.5" />
            添加转发
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
        {profile.proxies.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-center">
            <p className="text-[13px]">还没有转发</p>
            <p className="text-xs text-muted-foreground">
              添加一条本地端口，启动后即可从外网访问
            </p>
            <Button
              variant="secondary"
              onClick={() => openProxy()}
              disabled={running}
              title={running ? "请先停止服务器" : undefined}
            >
              <Plus className="size-3.5" />
              添加转发
            </Button>
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2 font-normal">
                  <input
                    type="checkbox"
                    checked={allProxiesChecked}
                    onChange={toggleAllProxies}
                    disabled={running}
                    aria-label="全选转发"
                    className="size-3.5 accent-[var(--signal)]"
                  />
                </th>
                <th className="px-3 py-2 font-normal">名称</th>
                <th className="w-20 px-3 py-2 font-normal">类型</th>
                <th className="w-52 px-3 py-2 font-normal">本地</th>
                <th className="px-3 py-2 font-normal">远端</th>
                <th className="w-20 px-3 py-2 text-right font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {profile.proxies.map((proxy) => (
                <tr
                  key={proxy.id}
                  className="border-b border-border/70 transition-colors hover:bg-accent/40"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedProxyIds.includes(proxy.id)}
                      onChange={() => toggleProxyChecked(proxy.id)}
                      disabled={running}
                      aria-label={`选择 ${proxy.name}`}
                      className="size-3.5 accent-[var(--signal)]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="block truncate">{proxy.name}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {proxy.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block truncate font-mono text-xs">
                      {proxy.localIP}:{proxy.localPort}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs">
                      <ArrowRight className="size-3 shrink-0 text-idle" />
                      <span className="truncate">{remoteLabel(proxy)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        aria-label={`编辑 ${proxy.name}`}
                        onClick={() => openProxy(proxy)}
                        disabled={running}
                        title={running ? "请先停止服务器" : undefined}
                        className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`删除 ${proxy.name}`}
                        onClick={() => void deleteProxy(profile, proxy)}
                        disabled={running}
                        title={running ? "请先停止服务器" : undefined}
                        className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ProfileDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        profile={profile}
        defaultAdminPort={nextAdminPort(profiles)}
      />
      <ProxyDialog
        open={proxyDialogOpen}
        onOpenChange={setProxyDialogOpen}
        profile={profile}
        proxy={editingProxy}
      />
      <PortRangeDialog
        open={rangeDialogOpen}
        onOpenChange={setRangeDialogOpen}
        profile={profile}
      />
    </section>
  )
}
