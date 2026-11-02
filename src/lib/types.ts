export type Protocol = "tcp" | "kcp" | "quic" | "websocket"

export type ProxyType =
  | "tcp"
  | "udp"
  | "http"
  | "https"
  | "stcp"
  | "xtcp"
  | "sudp"

export type Proxy = {
  id: string
  name: string
  type: ProxyType
  localIP: string
  localPort: number
  remotePort?: number
  customDomains: string[]
  subdomain: string
  secretKey: string
}

export type Profile = {
  id: string
  name: string
  serverAddr: string
  serverPort: number
  token: string
  protocol: Protocol
  user: string
  adminPort: number
  autoStart: boolean
  proxies: Proxy[]
}

export type RuntimeInfo = {
  running: boolean
  pid: number | null
  error: string | null
}

export const proxyTypes: { value: ProxyType; label: string }[] = [
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "stcp", label: "STCP" },
  { value: "xtcp", label: "XTCP" },
  { value: "sudp", label: "SUDP" },
]

export const protocols: Protocol[] = ["tcp", "kcp", "quic", "websocket"]

export function newId() {
  return crypto.randomUUID()
}

export function emptyProxy(): Proxy {
  return {
    id: newId(),
    name: "",
    type: "tcp",
    localIP: "127.0.0.1",
    localPort: 8080,
    remotePort: 6000,
    customDomains: [],
    subdomain: "",
    secretKey: "",
  }
}

export function emptyProfile(adminPort: number): Profile {
  return {
    id: newId(),
    name: "",
    serverAddr: "",
    serverPort: 7000,
    token: "",
    protocol: "tcp",
    user: "",
    adminPort,
    autoStart: false,
    proxies: [],
  }
}

export function nextAdminPort(profiles: Profile[]) {
  return profiles.reduce((port, profile) => Math.max(port, profile.adminPort), 7399) + 1
}
