# Changelog

## 0.1.0 — 2026-09-17

首个版本。基于 `@zerorigin-studio/dsh-deepseek-chat` v0.3.4（MIT）fork。

**插件**

- 侧边栏「新对话」下方新增「网页对话」入口，展开/收起两种形态与 harness 原生控件一致。
- 点击后优先通过标准桌面桥接 `window.dsh.desktop.openWindow` 在应用内开窗
  （兼容旧式 `window.chrome.webview.postMessage` 宿主消息）。
- 新增降级对话框：在 Electron/WebView2 桌面壳内且没有桥接时，弹出应用内对话框
  （在系统浏览器打开 / 复制壳修补命令 / 关闭），不再像上游那样把用户静默丢给系统浏览器；
  纯浏览器仍按 `target="_blank"` 开新标签页。
- 设置命名空间改为 `dsh-inapp-chat`，可与上游插件同时安装而不冲突。

**工具（`tools/`）**

- `asar_tool.cjs`：无依赖 asar 工具（list / dump / extract / patch / verify / rewrite），
  重建归档时重新计算每个文件的 SHA256 完整性字段，并复刻 Electron Pickle 头布局。
- `dsh-shell-patch.ps1`：`status / build / deploy / install / restore`。
  `build` 从**本机已安装的官方 app.asar**现场生成补丁包（不重新分发官方文件），
  `install` = build + deploy，替换前先备份、校验 SHA256，失败自动回滚。
- `应用补丁并重启.cmd`：双击即完成「关掉应用 → 生成并应用补丁 → 重启应用」。

**壳补丁内容（作用于 Electron 桌面壳，不随 npm 包分发）**

- `main.js`：新增 `openChatWindow()`（`parent` 为主窗口、`modal:false` 的对话框形态子窗口）；
  `setWindowOpenHandler` / `will-navigate` 对 `chat.deepseek.com`、`account.deepseek.com`
  改为应用内开窗，其余外链行为不变；新增 IPC `dsh:desktop:openWindow`。
- `main-preload.js`：`contextBridge` 暴露 `window.dsh.desktop.openWindow`（try/catch 包裹）。

**验证**

- 补丁重建后的 `app.asar` 经 Electron 实际启动验证可正常加载（完整性校验通过）。
- 用假安装目录跑通 `build → deploy → status → install（幂等） → restore`，
  restore 后哈希与官方原版一致。
