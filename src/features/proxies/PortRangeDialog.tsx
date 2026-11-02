import { useEffect, useId, useState } from "react"
import { Plus } from "lucide-react"
import { Dialog } from "@/components/ui/Dialog"
import { Button, Field, Input, Select } from "@/components/ui/form"
import { newId, type Profile, type Proxy, type ProxyType } from "@/lib/types"
import { useProfiles } from "@/store/profiles"

const rangeTypes: ProxyType[] = ["tcp", "udp", "sudp"]
const MAX_COUNT = 500

function parsePortRange(value: string) {
  const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(value.trim())
  if (!match) return null
  const start = Number(match[1])
  const end = Number(match[2] ?? start)
  const count = end - start + 1
  if (start < 1 || end > 65535 || count < 1 || count > MAX_COUNT) return null
  return Array.from({ length: count }, (_, index) => start + index)
}

export function PortRangeDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile
}) {
  const save = useProfiles((state) => state.save)
  const saving = useProfiles((state) => state.saving)
  const formId = useId()

  const [prefix, setPrefix] = useState("")
  const [type, setType] = useState<ProxyType>("tcp")
  const [localIP, setLocalIP] = useState("127.0.0.1")
  const [localRange, setLocalRange] = useState("")
  const [remoteRange, setRemoteRange] = useState("")

  useEffect(() => {
    if (!open) return
    setPrefix("")
    setType("tcp")
    setLocalIP("127.0.0.1")
    setLocalRange("")
    setRemoteRange("")
  }, [open])

  const localPorts = parsePortRange(localRange)
  const remotePorts = parsePortRange(remoteRange)
  const count =
    localPorts && remotePorts && localPorts.length === remotePorts.length
      ? localPorts.length
      : 0
  const cleanPrefix = prefix.trim()
  const names = localPorts && count ? localPorts.map((port) => `${cleanPrefix}-${port}`) : []
  const conflicts = names.filter((name) =>
    profile.proxies.some((proxy) => proxy.name === name),
  )
  const rangeError =
    (localRange.trim() && !localPorts) || (remoteRange.trim() && !remotePorts)
      ? `端口区间格式为 1-65535，单次最多 ${MAX_COUNT} 条`
      : localPorts && remotePorts && localPorts.length !== remotePorts.length
        ? "本地与远程端口数量必须一致"
        : null
  const canSave = cleanPrefix.length > 0 && count > 0 && conflicts.length === 0

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave || !localPorts || !remotePorts) return

    const created: Proxy[] = localPorts.map((localPort, index) => ({
      id: newId(),
      name: `${cleanPrefix}-${localPort}`,
      type,
      localIP: localIP.trim() || "127.0.0.1",
      localPort,
      remotePort: remotePorts[index],
      customDomains: [],
      subdomain: "",
      secretKey: "",
    }))

    const ok = await save({ ...profile, proxies: [...profile.proxies, ...created] })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="批量添加转发"
      description="本地与远程端口区间按顺序一一对应，一次生成多条转发。"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="primary" type="submit" form={formId} disabled={!canSave || saving}>
            <Plus className="size-3.5" />
            {saving ? "保存中…" : count > 0 ? `创建 ${count} 条` : "创建"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="grid grid-cols-3 gap-3">
        <Field label="名称前缀" className="col-span-2" hint="生成「前缀-本地端口」">
          <Input
            autoFocus
            required
            value={prefix}
            placeholder="app-tcp"
            onChange={(event) => setPrefix(event.target.value)}
          />
        </Field>
        <Field label="类型">
          <Select
            value={type}
            onChange={(event) => setType(event.target.value as ProxyType)}
          >
            {rangeTypes.map((item) => (
              <option key={item} value={item}>
                {item.toUpperCase()}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="本地地址" className="col-span-3">
          <Input
            required
            value={localIP}
            placeholder="127.0.0.1"
            onChange={(event) => setLocalIP(event.target.value)}
          />
        </Field>

        <Field label="本地端口区间" className="col-span-3" hint="例如 21000-21040，也可只填一个端口">
          <Input
            required
            value={localRange}
            placeholder="21000-21040"
            onChange={(event) => setLocalRange(event.target.value)}
          />
        </Field>
        <Field label="远程端口区间" className="col-span-3" hint="与本地端口数量一致">
          <Input
            required
            value={remoteRange}
            placeholder="21000-21040"
            onChange={(event) => setRemoteRange(event.target.value)}
          />
        </Field>

        {rangeError && (
          <p className="col-span-3 text-xs text-destructive">{rangeError}</p>
        )}
        {conflicts.length > 0 && (
          <p className="col-span-3 text-xs text-destructive">
            名称已存在：
            {conflicts.slice(0, 3).join("、")}
            {conflicts.length > 3 ? " 等" : ""}
          </p>
        )}
        {count > 0 && cleanPrefix && !rangeError && conflicts.length === 0 && (
          <p className="col-span-3 font-mono text-[11px] text-muted-foreground">
            {names[0]} → {remotePorts?.[0]} … {names[count - 1]} →{" "}
            {remotePorts?.[count - 1]}
            <span className="ml-2 font-sans">共 {count} 条</span>
          </p>
        )}
      </form>
    </Dialog>
  )
}
