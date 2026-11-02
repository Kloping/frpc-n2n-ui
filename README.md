# frpc 内网穿透管理器

Windows 桌面端 frpc 可视化工具：多服务器配置、按端口转发逐条启停、实时状态与日志。

技术栈：Tauri 2 + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui。

## 开发

```bash
npm install
npm run tauri dev
```

只调前端：`npm run dev`（http://localhost:5173）

## 打包

```bash
npm run tauri build
```

产物在 `src-tauri/target/release/bundle/`，NSIS 安装包按当前用户安装，不需要管理员权限。

## frpc 二进制

安装包内置 frpc v0.71.1，文件为 `src-tauri/binaries/frpc-x86_64-pc-windows-msvc.exe`（已 gitignore，克隆后需自行放回）。
换版本时从 [frp releases](https://github.com/fatedier/frp/releases) 下载 `windows_amd64` 包，解压后把 `frpc.exe` 改成上面的文件名。

## 设计

方案、数据模型、日志策略与视觉规范见 `docs/DESIGN.md`；图标源文件在 `assets/logo.png`。
