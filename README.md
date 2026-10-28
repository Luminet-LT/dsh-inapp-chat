# dsh-inapp-chat

> **点击「网页对话」，在 DeepSeek Harness 应用内弹出对话框窗口，而不是把你丢到系统浏览器。**
>
> In-app chat window for DeepSeek Harness — the sidebar entry opens
> `chat.deepseek.com` through the standard desktop bridge, and explains itself
> in-app when the shell can't do windows.

![dsh](https://img.shields.io/badge/dsh-plugin-web-4D6BFE) ![license](https://img.shields.io/badge/license-MIT-green) ![version](https://img.shields.io/badge/version-0.1.1-4D6BFE)

---

## 界面预览

### 侧边栏入口

<img src="docs/images/sidebar-entry.png" alt="侧边栏网页对话入口" width="360">

### 应用内网页对话

<img src="docs/images/in-app-chat-window.png" alt="应用内网页对话窗口" width="720">

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

### 适用场景

当你正在 DeepSeek Harness 里做项目时，经常会遇到一些需要临时问 AI 的情况：查一段
API 或配置用法、确认一个报错的原因、比较几种实现方案，或者只是想快速问一个与当前
任务关系不大的问题。

传统做法通常有两个问题：切到系统浏览器会打断工作流；把所有资料、搜索结果和聊天记录
都塞进当前 Harness 会话，又会持续占用主会话的上下文，消耗更多 token。使用本插件后，
你可以把 DeepSeek 网页对话放在应用内的独立窗口中：

- 边写代码边查资料，不需要频繁切换到浏览器；
- 把资料检索、报错排查、方案确认等临时问答留在网页窗口中完成；
- 只在需要时把最终结论复制回当前项目会话，避免为了一个短问题引入大量无关上下文；
- 网页窗口使用独立会话和独立的登录分区，不会自动携带当前 Harness 项目中的文件和聊天历史，
  因此更方便控制上下文范围，也能有效节约 token。

简而言之，它适合作为项目工作流旁边的“随手问 AI”入口：**查资料、解报错、确认方案，
窗口内完成；真正有用的结论，再带回到项目中。**

## 特性

- **侧边栏入口**：位于「新对话」按钮正下方，宽/窄两种形态与 harness 原生控件对齐，
  折叠时是 36px 图标，展开时显示「网页对话」。
- **两条开窗路径**：标准桥接 `window.dsh.desktop.openWindow`，兼容旧式
  WebView2 宿主消息（`window.chrome.webview.postMessage`）。
- **可解释的降级**：纯浏览器里照旧开新标签页；在桌面壳里如果没有桥接，弹应用内对话框
  （可在系统浏览器打开 / 一键复制补丁命令 / 关闭），不再"静默跳走"。
- **桌面兼容**：Web 端优先使用原生 `settingsScope`；桌面 profile 没有该服务时自动退回 `localStorage`，不再阻塞 DSH 启动。
- **开关**：设置 → 通用里可随时隐藏入口（`dsh-inapp-chat` 命名空间，默认开）。
- **窗口尺寸**：桌面壳中的应用内网页对话默认 `640×820`。
- **自带壳补丁工具**：`tools/` 里有 `asar_tool.cjs` + `dsh-shell-patch.ps1`，可以从
  **你自己安装的官方 app.asar** 现场生成补丁、备份原版、一键还原。

## 安装

```bash
# npm（若已发布）
dsh plugin --profile web add dsh-inapp-chat

# 本地源码 / 开发
dsh plugin --profile web add link:<本目录绝对路径>

# tgz
npm pack && dsh plugin --profile web add ./dsh-inapp-chat-0.1.1.tgz
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

补丁改的是壳自己的两个文件（**不重新分发任何官方文件**，补丁包在你本机现场生成）。工具同时支持 0.1.x 与 0.2.x 布局，备份和替换都带 SHA 校验：

- 0.1.x：修改 `main.js` / `main-preload.js`。
- 0.2.x：修改 `lib/main.js` / `lib/preload-app.cjs`，保留已有的 `dshDesktop` 等桥接。
- 两种布局都会新增应用内开窗入口和 IPC `dsh:desktop:openWindow`，默认窗口为
  `640×820`；只接受 `https` 的 DeepSeek 域名，并由 preload 通过 `contextBridge`
  暴露 `window.dsh.desktop.openWindow`。

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

- **桌面 profile 兼容**：0.2.x 桌面 profile 未提供 `settingsScope` 服务时，插件会自动使用浏览器本地设置，无需修改 DSH 本体。
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
| 文档 | 中文/英文说明（本仓库不再附发布与上架文档） |

## 开发与自测

```bash
node test/smoke.cjs      # 或 npm test
```

这个冒烟测试不需要浏览器、不联网：它用假的模块加载器和最小 DOM 把
`lib/client.js` 装进 harness 的 slot，然后**跑完四条点击分支** —— 标准桥接、
旧式 WebView2 桥接、桌面壳无桥接（应弹应用内对话框）、纯浏览器（应开新标签页），
外加设置开关的写入。`npm run check` 会顺带做语法检查。

## 发布

```bash
git push -u origin main                  # 仓库：github.com/Luminet-LT/dsh-inapp-chat
npm publish --access public              # 需先 npm login；账号开了 2FA 时加 --otp=<6 位码>
```

## License

MIT © 2026 caoganghui（上游部分）、Luminet-LT（本分支改动）。详见 [LICENSE](LICENSE)。
