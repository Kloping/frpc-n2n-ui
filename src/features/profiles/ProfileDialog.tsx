import { useEffect, useId, useState } from "react"
import { Save } from "lucide-react"
import { Dialog } from "@/components/ui/Dialog"
import { Button, Field, Input, Select } from "@/components/ui/form"
import { emptyProfile, protocols, type Profile } from "@/lib/types"
import { useProfiles } from "@/store/profiles"

export function ProfileDialog({
  open,
  onOpenChange,
  profile,
  defaultAdminPort,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile?: Profile
  defaultAdminPort: number
}) {
  const [draft, setDraft] = useState<Profile>(() => profile ?? emptyProfile(defaultAdminPort))
  const save = useProfiles((state) => state.save)
  const saving = useProfiles((state) => state.saving)
  const formId = useId()

  useEffect(() => {
    if (open) setDraft(profile ?? emptyProfile(defaultAdminPort))
  }, [open, profile, defaultAdminPort])

  const canSave =
    draft.name.trim().length > 0 &&
    draft.serverAddr.trim().length > 0 &&
    draft.serverPort > 0 &&
    draft.adminPort > 0

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return
    const ok = await save({
      ...draft,
      name: draft.name.trim(),
      serverAddr: draft.serverAddr.trim(),
      token: draft.token.trim(),
      user: draft.user.trim(),
    })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={profile ? "编辑服务器" : "添加服务器"}
      description="每台服务器使用独立的 frpc 配置和管理端口，可同时运行。"
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
        <Field label="名称" className="col-span-3">
          <Input
            autoFocus
            required
            value={draft.name}
            placeholder="公司内网"
            onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
          />
        </Field>

        <Field label="服务器地址" className="col-span-2">
          <Input
            required
            value={draft.serverAddr}
            placeholder="frps.example.com"
            onChange={(event) =>
              setDraft((value) => ({ ...value, serverAddr: event.target.value }))
            }
          />
        </Field>
        <Field label="服务端口">
          <Input
            required
            type="number"
            min={1}
            max={65535}
            value={draft.serverPort}
            onChange={(event) =>
              setDraft((value) => ({ ...value, serverPort: Number(event.target.value) }))
            }
          />
        </Field>

        <Field label="Token" className="col-span-3" hint="留空表示服务端未开启 token 认证">
          <Input
            type="password"
            value={draft.token}
            placeholder="与服务端 auth.token 一致"
            onChange={(event) => setDraft((value) => ({ ...value, token: event.target.value }))}
          />
        </Field>

        <Field label="传输协议">
          <Select
            value={draft.protocol}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                protocol: event.target.value as Profile["protocol"],
              }))
            }
          >
            {protocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {protocol.toUpperCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="管理端口" hint="仅本机访问">
          <Input
            required
            type="number"
            min={1}
            max={65535}
            value={draft.adminPort}
            onChange={(event) =>
              setDraft((value) => ({ ...value, adminPort: Number(event.target.value) }))
            }
          />
        </Field>
        <Field label="用户（可选）">
          <Input
            value={draft.user}
            placeholder="user"
            onChange={(event) => setDraft((value) => ({ ...value, user: event.target.value }))}
          />
        </Field>

        <label className="col-span-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={draft.autoStart}
            onChange={(event) =>
              setDraft((value) => ({ ...value, autoStart: event.target.checked }))
            }
            className="size-3.5 accent-[var(--signal)]"
          />
          应用启动时自动启动这台服务器
        </label>
      </form>
    </Dialog>
  )
}
