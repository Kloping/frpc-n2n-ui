import { useEffect, useId, useState } from "react"
import { Save } from "lucide-react"
import { Dialog } from "@/components/ui/Dialog"
import { Button, Field, Input, Select } from "@/components/ui/form"
import { emptyProxy, proxyTypes, type Profile, type Proxy, type ProxyType } from "@/lib/types"
import { useProfiles } from "@/store/profiles"

const remotePortTypes: ProxyType[] = ["tcp", "udp", "sudp"]
const domainTypes: ProxyType[] = ["http", "https"]
const secretTypes: ProxyType[] = ["stcp", "xtcp"]

export function ProxyDialog({
  open,
  onOpenChange,
  profile,
  proxy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile
  proxy?: Proxy
}) {
  const [draft, setDraft] = useState<Proxy>(() => proxy ?? emptyProxy())
  const save = useProfiles((state) => state.save)
  const saving = useProfiles((state) => state.saving)
  const formId = useId()

  useEffect(() => {
    if (open) setDraft(proxy ?? emptyProxy())
  }, [open, proxy])

  const needsRemotePort = remotePortTypes.includes(draft.type)
  const needsDomain = domainTypes.includes(draft.type)
  const needsSecret = secretTypes.includes(draft.type)
  const hasDomain =
    draft.customDomains.some((domain) => domain.trim().length > 0) ||
    draft.subdomain.trim().length > 0

  const canSave =
    draft.name.trim().length > 0 &&
    draft.localPort > 0 &&
    (!needsRemotePort || (draft.remotePort ?? 0) > 0) &&
    (!needsDomain || hasDomain) &&
    (!needsSecret || draft.secretKey.trim().length > 0)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return

    const clean: Proxy = {
      ...draft,
      name: draft.name.trim(),
      localIP: draft.localIP.trim() || "127.0.0.1",
      customDomains: draft.customDomains.map((domain) => domain.trim()).filter(Boolean),
      subdomain: draft.subdomain.trim(),
      secretKey: draft.secretKey.trim(),
    }
    const exists = profile.proxies.some((item) => item.id === clean.id)
    const proxies = exists
      ? profile.proxies.map((item) => (item.id === clean.id ? clean : item))
      : [...profile.proxies, clean]

    const ok = await save({ ...profile, proxies })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={proxy ? "编辑转发" : "添加转发"}
      description="本地端口通过这台服务器暴露到远端。"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="primary" type="submit" form={formId} disabled={!canSave || saving}>
            <Save className="size-3.5" />
            {saving ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="grid grid-cols-3 gap-3">
        <Field label="名称" className="col-span-2">
          <Input
            autoFocus
            required
            value={draft.name}
            placeholder="web-5173"
            onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
          />
        </Field>
        <Field label="类型">
          <Select
            value={draft.type}
            onChange={(event) =>
              setDraft((value) => ({ ...value, type: event.target.value as ProxyType }))
            }
          >
            {proxyTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="本地地址" className="col-span-2">
          <Input
            required
            value={draft.localIP}
            placeholder="127.0.0.1"
            onChange={(event) => setDraft((value) => ({ ...value, localIP: event.target.value }))}
          />
        </Field>
        <Field label="本地端口">
          <Input
            required
            type="number"
            min={1}
            max={65535}
            value={draft.localPort}
            onChange={(event) =>
              setDraft((value) => ({ ...value, localPort: Number(event.target.value) }))
            }
          />
        </Field>

        {needsRemotePort && (
          <Field label="远端端口" className="col-span-3" hint="由 frps 分配的对外端口">
            <Input
              required
              type="number"
              min={1}
              max={65535}
              value={draft.remotePort ?? 0}
              onChange={(event) =>
                setDraft((value) => ({ ...value, remotePort: Number(event.target.value) }))
              }
            />
          </Field>
        )}

        {needsDomain && (
          <>
            <Field label="自定义域名" className="col-span-3" hint="多个域名用逗号分隔；也可改用子域名">
              <Input
                value={draft.customDomains.join(", ")}
                placeholder="app.example.com"
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    customDomains: event.target.value.split(","),
                  }))
                }
              />
            </Field>
            <Field label="子域名" className="col-span-3">
              <Input
                value={draft.subdomain}
                placeholder="app"
                onChange={(event) =>
                  setDraft((value) => ({ ...value, subdomain: event.target.value }))
                }
              />
            </Field>
          </>
        )}

        {needsSecret && (
          <Field label="secretKey" className="col-span-3" hint="访问端需使用相同的 secretKey">
            <Input
              required
              value={draft.secretKey}
              onChange={(event) =>
                setDraft((value) => ({ ...value, secretKey: event.target.value }))
              }
            />
          </Field>
        )}
      </form>
    </Dialog>
  )
}
