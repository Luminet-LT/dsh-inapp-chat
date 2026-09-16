# tools — 给 Electron 桌面壳打「应用内开窗」补丁

这里的东西只做一件事：让**没有** `window.dsh.desktop.openWindow` 的 Electron 桌面壳
也能在应用内开窗，从而让插件的入口不再把用户丢到系统浏览器。

## 快速开始

```powershell
.\应用补丁并重启.cmd
```

它会：退出 DeepSeek Harness → 从**你本机的官方 `app.asar`** 现场生成补丁包 →
备份原版 → 替换 → 重新启动应用。

## 手动 / 分步

```powershell
# 看状态（是否已打补丁、有哪些备份、补丁包在哪）
powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action status

# 只生成补丁包（要求当前 app.asar 是官方原版）
powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action build

# 应用补丁（要求应用已完全退出；加 -Restart 自动关闭并重启）
powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action deploy
powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action install -Restart

# 还原官方原版
powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action restore -Restart
```

自定义安装路径（默认 `D:\Program Files (x86)\deepseek harness`）：

```powershell
powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action install -Restart -Install "E:\Apps\deepseek harness"
```

## 文件

| 文件 | 作用 |
| --- | --- |
| `asar_tool.cjs` | 无依赖的 asar 工具：`list / dump / extract / patch / verify / rewrite`。重建归档时按 Electron Pickle 布局重写头部，并重新计算每个文件的 SHA256 完整性字段。 |
| `dsh-shell-patch.ps1` | `status / build / deploy / install / restore`。替换前备份 + 校验，失败回滚。Windows PowerShell 5.1 与 pwsh 7 均可运行（脚本带 UTF-8 BOM）。 |
| `应用补丁并重启.cmd` | 双击入口。 |
| `app.patched.asar` | **本机生成**的补丁包（已在 `.gitignore` 中，不提交）。 |

## 补丁对壳做了什么

只改 `app.asar` 内的两个文件：

- **`main.js`**
  - 新增 `openChatWindow(target)`：`parent` 为主窗口、`modal:false` 的对话框形态子窗口，
    尺寸 460×800（`minWidth/minHeight` 360×480），加载 `chat.deepseek.com`；
  - `setWindowOpenHandler` / `will-navigate`：`chat.deepseek.com`、`account.deepseek.com`
    改走应用内开窗，**其余外链行为保持不变**（仍交给系统浏览器）；
  - 新增 IPC `dsh:desktop:openWindow`。
- **`main-preload.js`**
  - `contextBridge.exposeInMainWorld('dsh', { desktop: { openWindow } })`，
    与 dsh-desktop-shell 的标准约定一致；用 try/catch 包裹，暴露失败不影响原有快捷键功能。

## 安全与可逆

- 补丁包在**本机**从你自己安装的 `app.asar` 生成，工具本身不下载、不重新分发任何官方文件。
- 替换是「先备份 → 再改名就位」的原子操作，并逐文件校验 SHA256；任一步失败都会回滚。
- 锚点对不上（例如官方改了 `main.js`）时，`asar_tool.cjs` 直接报错退出，不会写出坏文件。
- 应用自动更新会覆盖 `app.asar`，补丁失效；更新后重新跑一次 `install` 即可。
  `restore` 会还原**最近一次**备份。

## 常见问题

**Q: `app.asar 被占用` / 改名失败？**
应用还在运行。用 `-Restart`（脚本会先关掉它），或先从托盘退出应用。

**Q: 双击 `.cmd` 报 `Join-Path … 空字符串`？**
那是老版本的参数绑定 bug（`$PSScriptRoot` 在 `param()` 阶段为空）。本仓库的版本已修复，
并额外在 `.cmd` 里显式传入补丁包路径。

**Q: 补丁会不会破坏应用启动？**
补丁只影响"点了入口之后"的代码路径，模块级只新增常量与函数声明。生成后的归档已在本机
用 Electron 实测能正常加载（完整性字段重算过）。
