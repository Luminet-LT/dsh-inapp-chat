# dsh-inapp-chat

> **Click "Web chat" and the chat opens in an in-app window — not in your system browser.**
>
> A DeepSeek Harness web plugin: a sidebar entry that opens `chat.deepseek.com`
> through the standard desktop bridge (`window.dsh.desktop.openWindow`), and when
> the shell can't do windows it says so **in an in-app dialog** instead of
> silently throwing you out of the app.

![dsh](https://img.shields.io/badge/dsh-plugin-web-4D6BFE) ![license](https://img.shields.io/badge/license-MIT-green) ![version](https://img.shields.io/badge/version-0.1.0-4D6BFE)

---

## The problem

The official Electron desktop shell (`DeepSeek Harness.exe`) hands every external
link to the OS browser:

```js
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);   // ← leaves the app
  return { action: 'deny' };
});
```

So the sidebar chat entry jumps out of the app. And you cannot simply embed the
page instead: `chat.deepseek.com` answers with

```
content-security-policy: frame-ancestors 'none'
```

which forbids **any** page from framing it. Only a **top-level navigation**
(a real window) can display it.

## What this plugin does

1. **Bridge present** (`window.dsh.desktop.openWindow`) → opens a dialog-shaped
   child window inside the app and loads the chat there.
2. **No bridge** → an in-app dialog explains the situation and shows the
   one-off shell-patch command. The patch tooling ships in `tools/`.

## Features

- Sidebar entry directly below **New session**, matching the harness controls in
  both the expanded and the rail (36px icon) form.
- Two window paths: the standard `window.dsh.desktop.openWindow` bridge, plus
  legacy WebView2 host messaging (`window.chrome.webview.postMessage`).
- Honest fallback: a plain browser still gets a new tab; a desktop shell without
  the bridge gets an in-app dialog (open in browser / copy patch command / close).
- Settings toggle to hide the entry (`dsh-inapp-chat` namespace, default on).
- Bundled shell-patch tools: builds the patch from **your own installed
  `app.asar`**, backs the original up, and restores it on demand.

## Install

```bash
dsh plugin --profile web add dsh-inapp-chat          # npm
dsh plugin --profile web add link:<path-to-this-repo> # local checkout
npm pack && dsh plugin --profile web add ./dsh-inapp-chat-0.1.0.tgz
```

Restart the harness afterwards; the entry appears under **New session**.

## Patch the desktop shell (only if it lacks `window.dsh.desktop`)

```powershell
cd tools
.\应用补丁并重启.cmd          # closes the app, builds + applies the patch, restarts it
```

or manually:

```powershell
powershell -ExecutionPolicy Bypass -File tools\dsh-shell-patch.ps1 -Action install -Restart
powershell -ExecutionPolicy Bypass -File tools\dsh-shell-patch.ps1 -Action status
powershell -ExecutionPolicy Bypass -File tools\dsh-shell-patch.ps1 -Action restore -Restart
```

The patch touches only the shell's own `main.js` / `main-preload.js`, and the
patch archive is generated locally from your installation — nothing official is
redistributed. App auto-updates restore the official `app.asar`; re-run
`install` after an update.

## How it decides

```
click
   ├─ window.dsh.desktop.openWindow ─► IPC ─► in-app child window           ✔
   ├─ legacy window.chrome.webview ──► postMessage ─► same                  ✔
   ├─ inside an Electron/WebView2 shell, no bridge ─► in-app explainer dialog
   └─ plain browser ─────────────────► new tab (target="_blank")
```

## Limits

- The chat cannot be an iframe inside the harness page — the site's CSP forbids
  it. Any plugin hits this wall; a window is the only way.
- The patched child window is parented to the main window, so it hides together
  with it (tray). Use `modal:true` for a true modal, or drop `parent:` for a
  fully independent window.
- Installing it next to `@zerorigin-studio/dsh-deepseek-chat` shows two entries
  and two identically named switches — pick one.

## Relationship to upstream

`lib/` is forked from the MIT-licensed
[`@zerorigin-studio/dsh-deepseek-chat`](https://github.com/zerorigin-studio/dsh-deepseek-chat)
v0.3.4 (© caoganghui); attribution and license are preserved (see
[LICENSE](LICENSE) and [NOTICE](NOTICE)). Changes: the in-app fallback dialog,
its own settings namespace, the bundled shell-patch tooling, and bilingual docs.

## Development

```bash
node test/smoke.cjs      # or: npm test
```

The smoke test needs no browser and no network: it loads `lib/client.js` through
a fake module loader and a minimal DOM, mounts the sidebar entry the way the
harness slots do, and then drives **all four click branches** — standard bridge,
legacy WebView2 bridge, Electron shell without a bridge (in-app dialog expected),
plain browser (new tab expected) — plus the settings toggle. `npm run check` adds
the syntax checks.

## Publishing

GitHub / npm / market submission steps live in
[docs/PUBLISHING.md](docs/PUBLISHING.md); the market entry and PR text live in
[docs/market-entry.md](docs/market-entry.md).

## License

MIT © 2026 caoganghui (upstream portions), lt99-chd (this fork).
