# 插件市场上架条目（awesome-dsh-plugin PR）

市场（dshmarket / dshmarket.com）实时读取
`https://awesome-dsh-plugin.com/plugins.json`，该文件由
[awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
仓库的 CI 每日生成 —— 所以上架的唯一动作是**去那个仓库提一个 PR，按它的格式加一条**。

> 本机当前访问不了 GitHub（`github.com` 被解析到 `127.0.0.1`），请在能上 GitHub 的环境操作。

## 1. 条目内容（与本仓库实际信息一致）

市场目录里同款条目的字段结构（取自线上 `plugins.json` 的真实条目）：

```json
{
  "name": "dsh-inapp-chat",
  "owner": "lt99-chd",
  "url": "https://github.com/lt99-chd/dsh-inapp-chat",
  "category": "ui",
  "description": {
    "en": "In-app chat window for DeepSeek Harness: a sidebar entry that opens chat.deepseek.com in an application window through the standard desktop bridge (window.dsh.desktop.openWindow). Without that bridge it no longer throws you out to the system browser — it shows an in-app dialog with a one-off shell patch (bundled, reversible) that adds the bridge to Electron shells.",
    "zh": "应用内网页对话窗口：侧边栏入口通过标准桌面桥接（window.dsh.desktop.openWindow）在应用内开对话框形态的窗口打开 chat.deepseek.com；没有桥接时不再静默跳到系统浏览器，而是弹应用内对话框说明，并附带可逆的桌面壳补丁（tools/，从本机官方 app.asar 现场生成）。"
  },
  "npm": "dsh-inapp-chat",
  "version": "0.1.0",
  "install": "dsh plugin --profile web add dsh-inapp-chat"
}
```

`category` 用 `ui`（与上游 `dsh-deepseek-chat` 同类别）。
`stars`、`downloads`、`page`、`added` 由 CI 自动生成，**不要手写**。

## 2. PR 标题与正文（可直接粘贴）

**Title**

```
Add dsh-inapp-chat — in-app chat window entry for DeepSeek Harness
```

**Body**

```markdown
### Plugin

- **name**: dsh-inapp-chat
- **repo**: https://github.com/lt99-chd/dsh-inapp-chat
- **npm**: https://www.npmjs.com/package/dsh-inapp-chat
- **category**: ui
- **install**: `dsh plugin --profile web add dsh-inapp-chat`

### What it does

A sidebar entry (right below "New session") that opens chat.deepseek.com.
It prefers the standard desktop bridge `window.dsh.desktop.openWindow`, so the
chat opens in an application window instead of the OS browser.

When a desktop shell provides no such bridge, the plugin does **not** silently
hand the click to the system browser (which is what the official Electron shell
does today). It shows an in-app dialog explaining the situation and offering:
open in the system browser / copy the shell-patch command / close.

`chat.deepseek.com` sends `Content-Security-Policy: frame-ancestors 'none'`, so
the page can never be embedded in an iframe inside the harness page — a
top-level window is the only way to show it. This plugin states that clearly
instead of pretending otherwise.

### Bundled tooling

`tools/` ships a dependency-free asar patcher plus a PowerShell script that
builds the shell patch from the **user's own installed app.asar** (nothing
official is redistributed), backs the original up, swaps it in, and restores it
on demand. It also exposes the standard `window.dsh.desktop.openWindow` bridge
through the shell's preload, so other plugins benefit too.

### Notes

- MIT; the client/host bundles are forked from `@zerorigin-studio/dsh-deepseek-chat`
  v0.3.4 (MIT, © caoganghui) with attribution kept in LICENSE/NOTICE, plus its own
  settings namespace so both can coexist.
- Verified locally: patched `app.asar` loads in Electron, and the tool's
  build/deploy/install/restore paths were exercised end-to-end on a scratch copy.
```

## 3. 提交后

- CI 每天刷新一次 `plugins.json`（通常一天内可见）；
- 想确认：`node -e "fetch('https://awesome-dsh-plugin.com/plugins.json').then(r=>r.json()).then(j=>console.log(j.plugins.find(p=>p.name==='dsh-inapp-chat')))"`；
- 条目里 `npm` 字段指向的包**必须先发布到 npm**，否则市场只能显示为「仅 GitHub 发布」且无法一键安装。
