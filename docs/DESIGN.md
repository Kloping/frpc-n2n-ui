# frpc 桌面管理器 · 设计说明

> 目标：Windows 桌面可视化工具，管理多台服务器的 frpc 内网穿透，按端口转发逐条启停、看状态、排错。
> 本文只定方案与视觉方向，不含业务代码。

## 1. 范围与假设

**做**（首版）

- 多套「服务器配置」，每套独立地址 / 端口 / token；一台服务器一个 frpc 进程，**多台可同时运行**，互不影响
- 每台服务器下维护多条端口转发（tcp / udp / http / https / stcp）
- 单条转发的启停状态可见，单台服务器可整体启停
- 实时日志、启动前校验、本地端口占用检查
- 托盘、开机自启、关闭最小化到托盘、单实例

**不做**（明确砍掉）

- 不做 frps 服务端管理（只做客户端）
- 不做流量统计图表、测速、多用户/权限
- 不做浅色主题（令牌已留好，后续约 1 天补）
- 不做 n2n VPN（按「内网穿透」理解项目名中的 n2n）

**命名**：仓库名 `fprc-n2n-ui` 应为 `frpc`，脚手架阶段顺手改名，避免后续包名、安装包、目录全带错字。

## 2. 技术选型

### 2.1 桌面外壳：Tauri 2（推荐）

| | Electron | **Tauri 2** | Wails 3 |
|---|---|---|---|
| 安装包 | ~90 MB | **~8 MB** | ~10 MB |
| 常驻内存 | 150 MB+ | **~60 MB** | ~40 MB |
| 调 frpc 进程 | Node 顺手 | Rust 约 200~300 行 | Go 顺手 |
| 托盘 / 自启 / 单实例 | 自己拼 | **官方插件齐全** | 有 |
| 成本 | 无学习成本 | 需 Rust 工具链 | 需 Go |

选 Tauri 的理由：这是一个常驻托盘的小工具，体积和内存是用户能直接感知的；进程管理、托盘、自启都有官方插件；同目录 `cc-switch` 已验证过 Tauri 2 + React 的可行性。代价是装 Rust 工具链，以及写少量 Rust。

若完全不想碰 Rust，退路是 Electron，前端代码几乎不用改，只换 IPC 层。

### 2.2 样式框架：Tailwind CSS v4 + shadcn/ui

| 方案 | 体积 | 定制成本 | 桌面密度适配 | 结论 |
|---|---|---|---|---|
| **Tailwind v4 + shadcn/ui（Radix）** | 按需，极小 | 中，样式完全归自己 | 高 | **采用** |
| Ant Design 5 | ~400 KB+ | 低，但难脱模板感 | 中 | 表单快，视觉同质化 |
| MUI | 大 | 中 | 中 | Material 气质不符 |
| CSS Modules 手写 | 0 | 高 | 高 | 时间成本不划算 |
| UnoCSS | 极小 | 同 Tailwind | 高 | 组件生态弱 |

配套：

- 图标 `lucide-react`，提示 `sonner`，状态 `zustand`（约 1 KB）
- 表单不引 react-hook-form：字段少，用受控组件 + 一个 `validateProxy()` 即可
- 不引表格库：转发条数是个位数到几十条，原生 `<table>` 足够

## 3. 视觉方向：「配线架」

取材于机柜配线架和交换机面板：深色哑光面板、蚀刻标签、状态 LED、端口之间的连线。整屏只保留一个记忆点——**每条转发画成一根从本地端口指向远端端口的线**，其余全部安静。

刻意避开：SaaS 圆角卡片堆叠、渐变装饰、通体近黑 + 荧光绿、每块都加阴影。

### 3.1 令牌

| 令牌 | 值 | 用途 |
|---|---|---|
| `--bg` | `#12161A` | 窗口底色 |
| `--surface` | `#181E24` | 侧栏、面板 |
| `--surface-2` | `#1F272F` | 悬浮、输入框 |
| `--line` | `#2B353E` | 1px 分隔线（代替阴影） |
| `--text` | `#E6EBEF` | 主文本 |
| `--muted` | `#8C99A5` | 次要文本、单位 |
| `--signal` | `#E8A33D` | 连接中 / 需注意 / 焦点环 |
| `--ok` | `#4CC38A` | 转发中 |
| `--err` | `#E5675C` | 失败、端口冲突 |
| `--idle` | `#5C6B78` | 未启动 |

主按钮用浅色填充（`#E6EBEF` + 深色字），不用彩色大按钮：颜色只表达状态，不表达「可点」。圆角 4px（控件）/ 6px（面板），无胶囊、无渐变。

### 3.2 字体

- 界面：`Segoe UI Variable Text` → `Microsoft YaHei UI`（Windows 原生，零下载、启动不闪字）
- 数据：`Cascadia Mono` → `Consolas`，用于 `IP:端口`、转发名、日志
- 字号：12 元信息 / 14 正文与表格 / 16 区块标题 / 20 页面标题；行高 1.5

### 3.3 布局

窗口 1100×720（最小 960×620）。保留 Windows 原生标题栏（贴靠布局、最大化手势都能用），应用内不再画第二层标题。侧栏 248、表头 40、表格行 44、日志坞 160（可拖拽收起）。8px 栅格。

```
┌────────────────────────────────────────────────────────────────────┐
│ ● 内网穿透        3 台在线 · 12 条转发              ─  □  ×        │ 36
├──────────────┬─────────────────────────────────────────────────────┤
│ 服务器       │ 公司内网   203.0.113.10:7000              [停止]    │
│ ● 公司内网   │ 已运行 2 小时 14 分 · 8 条转发 · admin :7401        │
│   8 条转发   │─────────────────────────────────────────────────────┤
│ ○ 测试服     │  状态   名称          本地             远端          │
│   3 条转发   │  ●      web-5173      127.0.0.1:5173 ──▶ :6000      │
│              │  ●      api-8080      127.0.0.1:8080 ──▶ :6001      │
│              │  ○      db-3306       127.0.0.1:3306 ──▶ :6002      │
│ + 添加服务器 │─────────────────────────────────────────────────────┤
│              │ 日志  自动滚动  清空  打开目录                       │
│              │ 12:04:31 [I] [web-5173] start proxy success          │
└──────────────┴─────────────────────────────────────────────────────┘
```

交互约定：

- 状态同时用 LED + 文案 + 图标，不单靠颜色
- 键盘：`Ctrl+N` 新建转发，`Ctrl+Enter` 启停当前服务器，`Esc` 关弹窗
- 空态是一句邀请：「还没有服务器，先添加一台」，配一个添加按钮
- 动效仅 120ms；只有「连接中」的 LED 允许呼吸动画，遵循 `prefers-reduced-motion`

## 4. 功能架构

### 4.1 数据模型

```ts
type Profile = {
  id: string
  name: string
  serverAddr: string
  serverPort: number          // 默认 7000
  token: string
  protocol: 'tcp' | 'kcp' | 'quic' | 'websocket'
  user?: string
  adminPort: number           // 本地 127.0.0.1 管理端口，7400 起自动分配
  autoStart: boolean
  proxies: Proxy[]
}

type Proxy = {
  id: string
  name: string                // frpc 中唯一
  type: 'tcp' | 'udp' | 'http' | 'https' | 'stcp' | 'xtcp' | 'sudp'
  localIP: string             // 默认 127.0.0.1
  localPort: number
  remotePort?: number         // tcp/udp
  customDomains?: string[]    // http/https
  subdomain?: string
  secretKey?: string          // stcp/xtcp
}
```

持久化：`app_config_dir/profiles.json`（tauri-plugin-store）。每个 Profile 启动时生成 `app_config_dir/frpc/<id>.toml`，不手写模板字符串，用 `toml` crate 序列化。

token 首版与 frpc.toml 一样明文存于用户目录；后续可用 Windows DPAPI 加密该字段，不动其他结构。管理端口只绑 `127.0.0.1`。

### 4.2 进程模型

一个 Profile = 一个 frpc 进程。frpc 的 `serverAddr` 是进程级的，所以「一对多」只能靠多进程：N 台服务器同时在线就是 N 个 frpc.exe 并行跑，各自的配置、管理端口、日志、状态完全独立，其中一台挂掉不影响其他。这也正好换来独立启停。

```
React ──invoke──▶ Rust 命令层 ──spawn──▶ frpc.exe -c <id>.toml
  ▲                    │
  └── event ───────────┘  runtime:changed / log:batch
```

要点：

- Windows 下用 `CREATE_NO_WINDOW` 启动，避免黑框；进程句柄存 `Mutex<HashMap<id, Child>>`
- 停止时先尝试正常退出，2 秒后 `TerminateProcess`；应用退出时统一收尾
- 状态不猜日志：frpc.toml 里开 `webServer`，每 2 秒轮询 `GET http://127.0.0.1:<adminPort>/api/status`，拿到每条 proxy 的 running / error，比解析 stdout 可靠
- 启动前跑 `frpc verify -c <toml>`，把配置错误直接弹在表单上
- 运行中改了转发：重写 toml → `POST /api/reload`，不断开已有连接
- 本地端口占用：Rust 侧 `TcpListener::bind` 试探，用于表单提示和启动前告警（远端端口冲突只能等服务端报错）
- 日志走 stdout 逐行读，前端 100ms 批量刷入环形缓冲，每台服务器只留最近 200 行；是否落盘见 4.5
- 同时运行的服务器上限不设硬限制，但界面上的「全部启动」按顺序错开 300ms 拉起，避免同时建连

### 4.3 IPC 契约

| 命令 | 说明 |
|---|---|
| `list_profiles` / `save_profile` / `delete_profile` | 配置 CRUD |
| `start_profile` / `stop_profile` / `restart_profile` | 进程控制 |
| `runtime_snapshot` | 所有服务器 + 转发的实时状态 |
| `check_local_port(ip, port)` | 端口占用检查 |
| `pick_frpc_binary` | 选择自定义 frpc.exe |
| `test_server(profile)` | 连接测试（verify + 短时启动） |

事件：`runtime:changed`（状态变化时推送）、`log:batch`（批量日志）。

### 4.4 目录

```
src/
  app/                 应用壳、标题栏、侧栏
  components/ui/       shadcn 组件
  features/profiles/   服务器列表与编辑
  features/proxies/    转发表格与表单
  features/logs/       日志坞
  features/settings/   设置
  lib/ipc.ts           invoke / listen 的类型化封装
  store/               zustand
  styles/tokens.css    @theme 令牌
src-tauri/
  src/commands/        profile.rs / frpc.rs / settings.rs
  src/frpc/            config.rs（生成 TOML）/ manager.rs（进程）/ status.rs（轮询）
  binaries/            frpc-x86_64-pc-windows-msvc.exe
```

### 4.5 日志

| | 行为 |
|---|---|
| 界面 | 默认只显示**最近 200 行**（每台服务器一个环形缓冲，超出的丢弃），不落盘 |
| 落盘开关 | 默认**关闭**；在设置里开启后才写文件 |
| 目录 | 开启时由用户选一个目录，写入 `<目录>/YYYY-MM-DD.log`，每天一个文件 |
| 多服务器 | 多个 frpc 共写同一个当日文件，行首加 `[服务器名]` 前缀；由后端单写入任务串行追加，避免交叉写坏行 |
| 保留 | 7 天，启动时和跨天时各清理一次，只删文件名匹配 `^\d{4}-\d{2}-\d{2}\.log$` 且早于今天的文件 |

清理必须限定文件名模式：用户可能随手选一个普通目录，不能误删里面的其他文件。

## 5. Windows 集成

| 能力 | 实现 | 默认 |
|---|---|---|
| 单实例 | `tauri-plugin-single-instance`，二次启动聚焦主窗 | 开 |
| 托盘 | 显示/隐藏、全部启动、全部停止、退出 | 开 |
| 关闭行为 | 点 × 收进托盘，托盘退出才真退 | 开，可关 |
| 开机自启 | `tauri-plugin-autostart`，以最小化启动 | 关 |
| 窗口记忆 | `tauri-plugin-window-state` | 开 |
| 失败通知 | `tauri-plugin-notification`，同一条转发 5 分钟内只提醒一次 | 开 |
| 安装包 | NSIS，当前用户安装免管理员；WebView2 缺失时引导安装 | — |

## 6. 实施节奏

| 阶段 | 内容 | 验收 | 预估 |
|---|---|---|---|
| P0 骨架 | Tauri 2 接入、Tailwind/shadcn、令牌、应用壳 | `npm run tauri dev` 出空壳窗口 | 0.5 天 |
| P1 配置 | 模型、store、TOML 生成、CRUD 弹窗 | 保存后生成的 toml 能被 `frpc verify` 通过 | 1 天 |
| P2 进程 | 启停、无黑框、日志流、admin 轮询、端口检查 | 启停 10 次无残留进程，状态与实际一致 | 1.5 天 |
| P3 界面 | 服务器栏、转发表格、连线行、日志坞、设置 | 增删改查全流程走通 | 2 天 |
| P4 集成 | 托盘、自启、单实例、通知、退出收尾 | 关窗后托盘可控，重启无重复实例 | 1 天 |
| P5 打包 | 内置 frpc、图标、NSIS、升级通道（可选） | 干净 Win11 上安装即用 | 0.5 天 |

关键路径是 P2；P3 可以和 P2 后半段并行。

## 7. 风险

- **frp 版本**：配置格式按 v0.52+ 的 TOML。若线上是旧版 INI，需要多一层格式适配。
- **Remote port 冲突**：只能等服务端反馈，UI 要能把这句错误翻译成人话，而不是丢原始日志。
- **杀软误报**：未签名 exe + 拉起子进程容易触发 Defender 提示，发布时最好签名。
- **token 明文**：与 frpc 自身一致，但要在设置页写清楚存储位置。

## 8. 已确认

1. frpc 随安装包内置，锁定 v0.71.1（放在 `src-tauri/binaries/`）。
2. 首版只做 TCP 转发；udp / http / stcp 等留到后续。
3. 仓库对外名称改为 `frpc-n2n-ui`（包名、窗口标题、标识符均已改）；本机目录名保持 `fprc-n2n-ui` 不动，避免工具工作目录失效。
4. 日志默认不落盘，界面只显示最近 200 行；开启后按天写 `YYYY-MM-DD.log`，保留 7 天。
5. 一对多：多台 frps 同时在线，每台一个独立 frpc 进程与独立配置。
