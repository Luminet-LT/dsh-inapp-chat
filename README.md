# dsh-inapp-chat

> **点击「网页对话」，在 DeepSeek Harness 应用内弹出对话框窗口，而不是把你丢到系统浏览器。**
>
> In-app chat window for DeepSeek Harness — the sidebar entry opens
> `chat.deepseek.com` through the standard desktop bridge, and explains itself
> in-app when the shell can't do windows.

![dsh](https://img.shields.io/badge/dsh-plugin-web-4D6BFE) ![license](https://img.shields.io/badge/license-MIT-green) ![version](https://img.shields.io/badge/version-0.1.0-4D6BFE)

---

## 它解决什么问题

在官方 Electron 桌面壳（`DeepSeek Harness.exe`）里，任何「外链」都会被壳的
`main.js` 交给系统浏览器：

```js
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);   // ← 跳到浏览器
  return { action: 'deny' };
});
```

于是侧边栏的 chat.deepseek.com 入口一点就跳出去，应用本身反而被留在原地。

而且**没法简单地"弹个框把网页嵌进去"**：`chat.deepseek.com` 明确返回

```
content-security-policy: frame-ancestors 'none'
```

浏览器层面禁止它被任何页面用 iframe 内嵌 —— 只有**顶层导航（独立窗口）**能显示它。

所以本插件做两件事：

1. **有桌面桥接时**（壳注入了 `window.dsh.desktop.openWindow`）→ 直接在应用内开
   **对话框形态的子窗口**，加载 chat.deepseek.com；
2. **没有桥接时** → 不再默默把你丢出去，而是弹出**应用内对话框**说明情况，并给出
   一次性给壳打补丁的命令（`tools/` 里带了这个补丁工具，见下文）。

## 特性

- **侧边栏入口**：位于「新对话」按钮正下方，宽/窄两种形态与 harness 原生控件对齐，
  折叠时是 36px 图标，展开时显示「网页对话」。
- **两条开窗路径**：标准桥接 `window.dsh.desktop.openWindow`，兼容旧式
  WebView2 宿主消息（`window.chrome.webview.postMessage`）。
- **可解释的降级**：纯浏览器里照旧开新标签页；在桌面壳里如果没有桥接，弹应用内对话框
  （可在系统浏览器打开 / 一键复制补丁命令 / 关闭），不再"静默跳走"。
- **开关**：设置 → 通用里可随时隐藏入口（`dsh-inapp-chat` 命名空间，默认开）。
- **自带壳补丁工具**：`tools/` 里有 `asar_tool.cjs` + `dsh-shell-patch.ps1`，可以从
  **你自己安装的官方 app.asar** 现场生成补丁、备份原版、一键还原。

## 安装

```bash
# npm（若已发布）
dsh plugin --profile web add dsh-inapp-chat

# 本地源码 / 开发
dsh plugin --profile web add link:<本目录绝对路径>

# tgz
npm pack && dsh plugin --profile web add ./dsh-inapp-chat-0.1.0.tgz
```

装完重启 harness（市场面板 Restart，或重启应用）。侧边栏「新对话」下方即出现「网页对话」。

## 使用

1. 点侧边栏「网页对话」。
2. 桌面壳已支持应用内开窗 → 应用内弹出对话框窗口；第一次是登录页，
   在窗口内登录一次即可（登录态存在应用自己的 Electron 配置目录里）。
3. 如果没有弹出窗口，而是弹了一个说明对话框 → 说明你的壳还缺开窗接口，
   按对话框里的提示跑一次 `tools` 里的补丁（下一节）。

## 给桌面壳打补丁（没有 `window.dsh.desktop` 时）

> 已经在用支持该桥接的壳，或用的是 dsh-desktop（Wails/WebView2）时**不需要**这一步。

```powershell
cd tools
# 关掉应用 → 从你本机的官方 app.asar 现场生成补丁 → 备份并替换 → 重启应用
.\应用补丁并重启.cmd
```

或手动：

```powershell
powershell -ExecutionPolicy Bypass -File tools\dsh-shell-patch.ps1 -Action install -Restart
powershell -ExecutionPolicy Bypass -File tools\dsh-shell-patch.ps1 -Action status
powershell -ExecutionPolicy Bypass -File tools\dsh-shell-patch.ps1 -Action restore -Restart   # 还原
```

补丁改的是壳自己的两个文件（**不重新分发任何官方文件**，补丁包在你本机现场生成）：

- `main.js`：新增 `openChatWindow()`（父窗口为宿主窗口、`modal:false` 的对话框形态子窗口），
  并把 `chat.deepseek.com` / `account.deepseek.com` 的外链改走应用内开窗，其余外链行为不变；
  新增 IPC `dsh:desktop:openWindow`。
- `main-preload.js`：`contextBridge` 暴露 `window.dsh.desktop.openWindow`（try/catch 包裹，
  失败不影响原功能）。

注意：**应用自动更新会把 `app.asar` 换回官方版本**，补丁随之失效，更新后重跑一次 `install` 即可。

## 工作原理

```
点击侧边栏入口
   ├─ window.dsh.desktop.openWindow 存在 ─────► IPC ─► 壳开应用内子窗口  ✔
   ├─ 旧式 window.chrome.webview 存在 ───────► postMessage ─► 同上        ✔
   ├─ 在 Electron/WebView2 壳里但都没有 ─────► 应用内说明对话框（含补丁命令）
   └─ 普通浏览器 ─────────────────────────────► 新标签页（target="_blank"）
```

## 兼容性与限制

- **必须顶层窗口**：受站点 CSP 限制，网页聊天内容无法以 iframe 形式出现在 harness 页面内，
  只能开窗口 —— 这不是本插件能绕过的，任何插件都绕不过。
- **对话框跟随主窗口**：补丁开的子窗口 `parent` 为主窗口，主窗口最小化到托盘时它一起隐藏。
  想要真模态（挡住主窗口操作）把 `modal:false` 改成 `true`；想要完全独立删掉 `parent:`。
- **与 `@zerorigin-studio/dsh-deepseek-chat` 同时安装**会看到两个入口和两个同名开关，
  建议二选一（本插件是它的分支，见下）。

## 与上游的关系

`lib/` 基于 MIT 许可的
[`@zerorigin-studio/dsh-deepseek-chat`](https://github.com/zerorigin-studio/dsh-deepseek-chat)
v0.3.4（© caoganghui）fork 而来，保留其署名与许可证（见 [LICENSE](LICENSE)、[NOTICE](NOTICE)）。
本分支的改动：

| 改动 | 说明 |
| --- | --- |
| 无桥接时的行为 | 上游直接开系统浏览器；本插件改为应用内说明对话框（仅桌面壳内） |
| 设置命名空间 | 用自己的 `dsh-inapp-chat`，可与上游共存（两条注册不冲突） |
| 附带工具 | `tools/` 自带壳补丁工具链（上游没有） |
| 文档 | 中文/英文说明 + 市场上架与发布流程 |

## 开发与自测

```bash
node test/smoke.cjs      # 或 npm test
```

这个冒烟测试不需要浏览器、不联网：它用假的模块加载器和最小 DOM 把
`lib/client.js` 装进 harness 的 slot，然后**跑完四条点击分支** —— 标准桥接、
旧式 WebView2 桥接、桌面壳无桥接（应弹应用内对话框）、纯浏览器（应开新标签页），
外加设置开关的写入。`npm run check` 会顺带做语法检查。

## 发布

推 GitHub、发 npm、上架插件市场的完整步骤见
[docs/PUBLISHING.md](docs/PUBLISHING.md)；市场上架条目与 PR 文案见
[docs/market-entry.md](docs/market-entry.md)。

## License

MIT © 2026 caoganghui（上游部分）、Luminet-LT（本分支改动）。详见 [LICENSE](LICENSE)。
