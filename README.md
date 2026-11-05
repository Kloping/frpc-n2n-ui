# frpc 内网穿透管理器

Windows 桌面端 frpc 可视化工具：多服务器配置、按端口转发逐条启停、端口区间批量添加、实时状态与日志。

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

## 自动构建

`.github/workflows/build.yml` 在 GitHub Actions 的 `windows-latest` 上构建 Windows x64 安装包，本地不需要 Rust 环境。

两种触发方式：

- **打 tag 自动发布**：`git tag v0.1.0 && git push origin v0.1.0`，构建完成后自动创建 Release 并挂上安装包
- **手动构建**：Actions → `Build Windows EXE` → Run workflow，产物在本次运行页面的 Artifacts 中，`release_tag` 留空则不发布

产物命名：

- `frpc-n2n_<version>_x64-setup.exe`：NSIS 安装包，按当前用户安装
- `frpc-n2n_<version>_x64-portable.exe`：免安装单文件版

流程说明：

1. `src-tauri/binaries/` 被 gitignore，CI 会按 `FRP_VERSION`（当前 0.71.1）从 frp 官方 Release 下载并补齐 `frpc-x86_64-pc-windows-msvc.exe`
2. tag 触发时把 tag 版本写回 `tauri.conf.json` 与 `Cargo.toml`，保证产物文件名与 Release 一致
3. `--bundles nsis` 覆盖配置中的 `targets: all`，只产出 exe；需要 msi 时改成 `--bundles nsis,msi`
4. Rust 编译缓存由 `swatinem/rust-cache` 维护，二次构建耗时显著下降

## frpc 二进制

安装包内置 frpc v0.71.1，文件为 `src-tauri/binaries/frpc-x86_64-pc-windows-msvc.exe`（已 gitignore，克隆后需自行放回）。
换版本时从 [frp releases](https://github.com/fatedier/frp/releases) 下载 `windows_amd64` 包，解压后把 `frpc.exe` 改成上面的文件名。

## 设计

方案、数据模型、日志策略与视觉规范见 `docs/DESIGN.md`；图标源文件在 `assets/logo.png`。
