/**
 * dsh-inapp-chat browser bundle.
 *
 * Forked from @zerorigin-studio/dsh-deepseek-chat v0.3.4 (MIT, (c) caoganghui).
 * Modifications (c) 2026 Luminet-LT, also MIT:
 *   - the sidebar entry opens the chat through the standard desktop bridge
 *     (window.dsh.desktop.openWindow) exactly like the original;
 *   - WITHOUT that bridge it no longer silently throws the user out to the
 *     system browser: inside a desktop shell it shows an in-app dialog that
 *     explains the situation (and can copy the shell-patch command); in a
 *     plain browser it still opens a new tab.
 *   - its own settings namespace, so it can coexist with the original.
 */
window.__ModuleLoader__.load({ id: "dsh-inapp-chat", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_client = require("@deepseek-ai/dsh-client-store");
var import_jsx_runtime = require("react/jsx-runtime");
var CHAT_URL = "https://chat.deepseek.com/";
var SETTINGS_NAMESPACE = "dsh-inapp-chat";
var SHOW_ENTRY_FIELD = "showEntry";
var ChatEntryPolicy = class {
  show = (0, import_client.createSnapshotStore)(true);
  host;
  /**
   * @param host - durable preference scope owned by this plugin; absent
   * compositions stay process-local (visible by default).
   */
  constructor(host) {
    this.host = host;
    if (host !== void 0) {
      host.subscribe(() => {
        this.adopt(host);
      });
      this.adopt(host);
    }
  }
  /** Change the preference; the live value publishes before the durable write. */
  setShow(next) {
    if (this.show.getSnapshot() === next) return;
    this.show.set(next);
    void this.host?.set(SHOW_ENTRY_FIELD, next);
  }
  /** Adopt the scope's accepted durable value without writing it back. */
  adopt(host) {
    const section = host.getSnapshot().value;
    if (section === void 0 || this.show.getSnapshot() === section.showEntry) return;
    this.show.set(section.showEntry);
  }
};
// ------------------------------------------------------------ desktop bridge
// A desktop shell may inject a standard multi-window SDK. Two shapes exist in the
// wild: `window.dsh.desktop` (current shells, incl. the patched official Electron
// shell) and legacy WebView2 host messaging (`window.chrome.webview`). Either way
// the chat has to be shown in a TOP-LEVEL window: chat.deepseek.com sends
// `Content-Security-Policy: frame-ancestors 'none'`, so it can never be embedded
// in the harness page itself — only navigated to on its own.
function desktopBridge() {
  const dsh = window.dsh && window.dsh.desktop;
  if (dsh && typeof dsh.openWindow === "function") return dsh;
  const raw = (window.chrome && window.chrome.webview && window.chrome.webview.postMessage) ? window.chrome.webview : null;
  if (raw) {
    return {
      openWindow: function (options) {
        raw.postMessage(JSON.stringify({ type: "dsh.desktop.openWindow", url: options.url, title: options.title }));
        return Promise.resolve();
      }
    };
  }
  return null;
}
// Electron / WebView2 shells hand external links to the OS browser — exactly the
// "jumped out to the web" behaviour this plugin exists to prevent.
function insideDesktopShell() {
  if (window.chrome && window.chrome.webview) return true;
  return /\bElectron\//.test(navigator.userAgent || "");
}
const SHELL_PATCH_COMMAND = "powershell -ExecutionPolicy Bypass -File tools\\dsh-shell-patch.ps1 -Action deploy -Restart";
function openChat(e) {
  const bridge = desktopBridge();
  if (bridge) {
    e.preventDefault();
    let p;
    try {
      p = bridge.openWindow({ url: CHAT_URL, title: "DeepSeek 网页对话" });
    } catch (err) {
      p = Promise.reject(err);
    }
    if (p && typeof p.catch === "function") {
      p.catch(function () { openFallbackDialog(); });
    }
    return;
  }
  // No bridge at all: in a plain browser the anchor's own target="_blank" opens a
  // new tab (perfectly fine, the harness page is not replaced). Inside a desktop
  // shell that same click would silently throw the user out to the OS browser, so
  // explain the situation in-app instead.
  if (!insideDesktopShell()) return;
  e.preventDefault();
  openFallbackDialog();
}
// ------------------------------------------------------------ fallback dialog
const DIALOG_ID = "dsh-inapp-chat-dialog";
function ensureDialogStyles() {
  if (document.getElementById(DIALOG_ID + "-styles")) return;
  const st = document.createElement("style");
  st.id = DIALOG_ID + "-styles";
  st.textContent = [
    "#" + DIALOG_ID + "{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;",
    "padding:24px;box-sizing:border-box;background:rgba(0,0,0,.42);",
    "font-family:var(--dsw-font-family,-apple-system,'Segoe UI','Microsoft YaHei',sans-serif)}",
    "#" + DIALOG_ID + ".dshiac-open{display:flex}",
    "#" + DIALOG_ID + " .dshiac-card{width:min(460px,100%);box-sizing:border-box;padding:20px 20px 16px;border-radius:14px;",
    "color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-surface,var(--dsw-alias-bg,#fff));",
    "border:1px solid var(--dsw-alias-border-l2,rgba(31,35,40,.14));box-shadow:0 18px 48px rgba(0,0,0,.32)}",
    "#" + DIALOG_ID + " h2{margin:0 0 8px;font-size:16px;line-height:24px;font-weight:600}",
    "#" + DIALOG_ID + " p{margin:0 0 10px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,rgba(31,35,40,.72))}",
    "#" + DIALOG_ID + " code{display:block;margin:0 0 14px;padding:8px 10px;border-radius:8px;font-size:12px;line-height:18px;",
    "word-break:break-all;background:var(--dsw-alias-bg-layer-2,rgba(31,35,40,.06));color:var(--dsw-alias-label-primary,#1f2328)}",
    "#" + DIALOG_ID + " .dshiac-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}",
    "#" + DIALOG_ID + " button{cursor:pointer;font:inherit;font-size:13px;line-height:20px;padding:6px 14px;border-radius:8px;",
    "border:1px solid var(--dsw-alias-border-l2,rgba(31,35,40,.14));background:transparent;color:inherit}",
    "#" + DIALOG_ID + " button.dshiac-primary{background:var(--dsw-alias-button-info-fill,#4d6bfe);border-color:transparent;color:#fff}"
  ].join("\n");
  document.head.appendChild(st);
}
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
  }
  return Promise.resolve(legacyCopy(text));
}
function legacyCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    return false;
  }
}
function closeFallbackDialog() {
  const root = document.getElementById(DIALOG_ID);
  if (root) root.classList.remove("dshiac-open");
}
function openFallbackDialog() {
  ensureDialogStyles();
  let root = document.getElementById(DIALOG_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = DIALOG_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "网页对话");
    const card = document.createElement("div");
    card.className = "dshiac-card";
    const title = document.createElement("h2");
    title.textContent = "网页对话需要在应用内窗口中打开";
    const body = document.createElement("p");
    body.textContent = "当前桌面壳没有提供应用内开窗接口（window.dsh.desktop.openWindow），而 "
      + "chat.deepseek.com 明确禁止被页面内嵌（CSP frame-ancestors 'none'），所以无法把网页直接画进对话框。"
      + "给桌面壳打一次补丁就能在应用内开窗（插件目录 tools/ 下执行）：";
    const cmd = document.createElement("code");
    cmd.textContent = SHELL_PATCH_COMMAND;
    const actions = document.createElement("div");
    actions.className = "dshiac-actions";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "dshiac-primary";
    openBtn.textContent = "在系统浏览器打开";
    openBtn.addEventListener("click", function () {
      window.open(CHAT_URL, "_blank", "noopener,noreferrer");
      closeFallbackDialog();
    });
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "复制修补命令";
    copyBtn.addEventListener("click", function () {
      copyText(SHELL_PATCH_COMMAND).then(function (ok) {
        copyBtn.textContent = ok ? "已复制" : "复制失败";
        setTimeout(function () { copyBtn.textContent = "复制修补命令"; }, 1600);
      });
    });
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "关闭";
    closeBtn.addEventListener("click", closeFallbackDialog);
    actions.appendChild(openBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(closeBtn);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(cmd);
    card.appendChild(actions);
    root.appendChild(card);
    root.addEventListener("mousedown", function (ev) { if (ev.target === root) closeFallbackDialog(); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && root.classList.contains("dshiac-open")) closeFallbackDialog();
    });
    document.body.appendChild(root);
  }
  root.classList.add("dshiac-open");
  const primary = root.querySelector("button.dshiac-primary");
  if (primary && primary.focus) primary.focus();
}
// The sidebar New Session button is hard-coded by the harness (no injectable
// slot around it), so the entry button is mounted next to it via DOM: both
// buttons share the row 50/50. The harness repo stays untouched.
function findNewSessionButton() {
  const needles = ["new session", "new chat", "新对话", "新建会话", "新会话"];
  // Expanded: the real New Session button carries its label text, while the
  // wordmark (logo) button shares the same aria-label but renders no text —
  // match by text first so the logo is never wrapped.
  for (const b of document.querySelectorAll("button")) {
    const t = (b.textContent || "").trim();
    if (t && needles.some((n) => t === n || t.startsWith(n))) return b;
  }
  // Collapsed / fallback: aria-label match, skipping buttons whose svg is a
  // large wordmark (the real button only ever shows a 16-18px glyph).
  for (const b of document.querySelectorAll("button[aria-label]")) {
    const label = (b.getAttribute("aria-label") || "").toLowerCase();
    if (!needles.some((n) => label.includes(n.toLowerCase()))) continue;
    const svg = b.querySelector("svg");
    if (svg && svg.getBoundingClientRect().width > 32) continue; // wordmark
    return b;
  }
  return null;
}
const CHAT_ENTRY_ID = "dsh-chat-entry";
// Hover/active affordance matching the harness New Session button
// (.newSession:hover uses --dsw-alias-button-floating-hover); the railed
// icon form uses the lighter interactive fill, and the row keeps the 120ms
// background transition the harness controls use.
function ensureEntryStyles() {
  if (document.getElementById("dsh-chat-entry-styles")) return;
  const st = document.createElement("style");
  st.id = "dsh-chat-entry-styles";
  st.textContent = [
    "#" + CHAT_ENTRY_ID + " a { transition: none; }",
    "#" + CHAT_ENTRY_ID + " a:hover { background: var(--dsw-alias-button-floating-hover); }",
    "#" + CHAT_ENTRY_ID + "[data-rail=\"1\"] a:hover { background: var(--dsw-alias-interactive-bg-hover); }",
    "#" + CHAT_ENTRY_ID + " a:active { transform: scale(0.98); }",
    // Mirrors the harness rail-in slide (New Session icon slides in 49px
    // from the former rail right edge) and the wide-in fade.
    "@keyframes dsh-entry-rail-in { from { opacity: 0; transform: translateX(49px); } }",
    "@keyframes dsh-entry-wide-in { from { opacity: 0; } }"
  ].join("\n");
  document.head.appendChild(st);
}
function createEntry() {
  // One-time DOM build: the wide/rail swap later only mutates inline
  // styles so CSS transitions (and the rail-in slide) play smoothly — the
  // element is never destroyed and recreated on collapse/expand.
  const host = document.createElement("div");
  host.id = CHAT_ENTRY_ID;
  host.style.cssText = "display:flex;box-sizing:border-box;flex:none;align-items:stretch;margin:0 2px 10px";
  const a = document.createElement("a");
  a.href = CHAT_URL;
  // Plain browser: the anchor default opens a NEW tab (target="_blank") instead
  // of navigating the harness page away. Inside a desktop shell openChat()
  // preventDefault()s and routes to the in-app window (or its fallback dialog),
  // so this is a pure downgrade default and never competes with that path.
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.title = "DeepSeek 网页对话";
  a.style.cssText = "flex:1;min-width:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;gap:6px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;line-height:22px;text-decoration:none;white-space:nowrap;overflow:hidden";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.style.cssText = "flex:none;display:flex";
  icon.innerHTML = '<svg width="14" height="14" viewBox="3 3 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1.5-4A8 8 0 1 1 21 12z"/><path d="M8.5 10h7M8.5 13.5h4.5"/></svg>';
  const label = document.createElement("span");
  label.textContent = "\u7F51\u9875\u5BF9\u8BDD"; // 网页对话
  a.appendChild(icon);
  a.appendChild(label);
  // Hover via JS: the base background is inline, a stylesheet rule can't
  // beat it. Colors are mode-aware (set in updateEntry); never re-apply a
  // stale base on leave or the rail icon stays stuck on the wide base.
  a.addEventListener("mouseenter", () => { a.style.background = host.refs.hoverBg; });
  a.addEventListener("mouseleave", () => { a.style.background = host.refs.baseBg; });
  a.addEventListener("click", openChat);
  host.appendChild(a);
  host.refs = { a, icon, label };
  return host;
}
function updateEntry(host, wide) {
  const { a, icon, label } = host.refs;
  const svg = icon.querySelector("svg");
  host.setAttribute("data-rail", wide ? "" : "1");
  host.style.margin = wide ? "0 2px 10px" : "0 0 12px";
  if (wide) {
    host.style.width = "";
    a.style.height = "38px";
    a.style.padding = "0 8px";
    a.style.borderColor = "var(--dsw-alias-border-l2)";
    a.style.borderRadius = "12px";
    host.refs.baseBg = "var(--dsw-alias-button-elevated-fill)";
    host.refs.hoverBg = "var(--dsw-alias-button-floating-hover)";
  } else {
    const nb = findNewSessionButton();
    const w = nb ? nb.getBoundingClientRect().width : 36;
    host.style.width = (w > 0 ? w : 36) + "px";
    a.style.height = "36px";
    a.style.padding = "0";
    a.style.borderColor = "transparent";
    a.style.borderRadius = "8px";
    host.refs.baseBg = "transparent";
    host.refs.hoverBg = "var(--dsw-alias-interactive-bg-hover)";
  }
  // Set the base background for the current mode instantly (no color cross-
  // fade) so a collapse doesn't flash the previous mode's fill.
  a.style.background = host.refs.baseBg;
  label.style.display = wide ? "" : "none";
  if (svg) {
    const s = wide ? 14 : 18;
    svg.setAttribute("width", s);
    svg.setAttribute("height", s);
  }
}
function playEntryAnimation(host, wide) {
  if (!host) return;
  cancelRailWait();
  if (wide) {
    // Expand: snap to the wide button instantly with NO fade/translate,
    // matching the harness Native New Session button (which stays visible
    // and never fades in during expand). A wide-in fade reads as a
    // "loading from above" PPT-style pop-in.
    host.style.opacity = "";
    host.style.animation = "none";
    return;
  }
  // Collapse: unlike the other icons (which ride the sidebar width down),
  // the chat entry stays hidden until the sidebar has finished contracting,
  // then slides in right-to-left into its slot below the New Session rail
  // icon.
  playRailInAfterCollapse(host);
}
var _railWait = { raf: 0, cancel: false };
function cancelRailWait() {
  _railWait.cancel = true;
  if (_railWait.raf) cancelAnimationFrame(_railWait.raf);
  _railWait.raf = 0;
}
function playRailInAfterCollapse(host) {
  // Ride the harness collapse exactly like a native icon: do NOT hide, do
  // NOT delay. We wait for the collapse "settle" (when the native controls
  // start their rail-in animation - i.e. their transform leaves "none") and
  // then slide the chat entry in on that same frame, so it collapses into
  // the rail together with the New Session button (same right-to-left
  // motion, no disappearing gap, no late re-entry).
  const ref = findNewSessionButton();
  _railWait.cancel = false;
  let frames = 0;
  const tick = () => {
    if (_railWait.cancel) { _railWait.raf = 0; return; }
    frames++;
    const nativeMoving = !!(ref && getComputedStyle(ref).transform !== "none");
    if (nativeMoving || frames >= 120) {
      _railWait.raf = 0;
      host.style.opacity = "";
      host.style.animation = "none";
      void host.offsetWidth;
      host.style.animation = "dsh-entry-rail-in 150ms var(--ds-ease-in-out, ease-in-out) backwards";
      return;
    }
    _railWait.raf = requestAnimationFrame(tick);
  };
  _railWait.raf = requestAnimationFrame(tick);
}
function mountBelowEntry(wide) {
  ensureEntryStyles();
  const existing = document.getElementById(CHAT_ENTRY_ID);
  const nb = findNewSessionButton();
  if (!nb || !nb.parentElement) return false;
  let host = existing;
  if (!host) {
    host = createEntry();
    nb.parentElement.insertBefore(host, nb.nextSibling);
  }
  updateEntry(host, wide);
  playEntryAnimation(host, wide);
  return true;
}
function unmountBelowEntry() {
  const host = document.getElementById(CHAT_ENTRY_ID);
  if (host) host.remove();
}
function ChatEntry({ wide, useShow }) {
  const show = useShow((value) => value);
  // Mount once: wait for the harness sidebar DOM, then insert the entry.
  (0, import_react.useEffect)(() => {
    if (!show) return;
    let mounted = false;
    let obs = null;
    const stopWatching = () => {
      clearInterval(timer);
      if (obs) obs.disconnect();
    };
    const tryMount = () => {
      if (!mounted && mountBelowEntry(wide)) {
        mounted = true;
        stopWatching();
      }
    };
    const timer = setInterval(tryMount, 150);
    tryMount();
    obs = new MutationObserver(tryMount);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearInterval(timer);
      if (obs) obs.disconnect();
      unmountBelowEntry();
    };
  }, [show]);
  // Rail/wide toggles: update styles + play the matching animation in place
  // (NO rebuild), so the entry slides with the New Session icon.
  (0, import_react.useEffect)(() => {
    if (!show) return;
    const host = document.getElementById(CHAT_ENTRY_ID);
    if (!host) return;
    updateEntry(host, wide);
    playEntryAnimation(host, wide);
  }, [show, wide]);
  return null;
}
function ChatEntryToggle({ useShow, setShow }) {
  const show = useShow((value) => value);
  const toggle = () => {
    setShow?.(!show);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 0",
    width: "100%",
    boxSizing: "border-box"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: 14,
        fontWeight: 500,
        lineHeight: "20px",
        color: "var(--dsw-alias-label-primary)"
      }, children: "\u7F51\u9875\u5BF9\u8BDD\u5165\u53E3" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
        fontSize: 12,
        lineHeight: "18px",
        marginTop: 2,
        color: "var(--dsw-alias-label-secondary)"
      }, children: "\u5728\u4FA7\u8FB9\u680F\u5E95\u90E8\uFF08\u8BBE\u7F6E\u6309\u94AE\u4E0A\u65B9\uFF09\u663E\u793A chat.deepseek.com \u7684\u7F51\u9875\u5BF9\u8BDD\u5165\u53E3\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": show,
        "aria-label": "\u7F51\u9875\u5BF9\u8BDD\u5165\u53E3",
        onClick: toggle,
        style: {
          flex: "none",
          width: 38,
          height: 22,
          padding: 0,
          cursor: "pointer",
          position: "relative",
          borderRadius: 999,
          border: "1px solid var(--dsw-alias-border-l2)",
          background: show ? "var(--dsw-alias-button-info-fill)" : "var(--dsw-alias-bg-layer-2)",
          transition: "background-color 120ms ease"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: {
          position: "absolute",
          top: 1,
          left: 1,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transform: show ? "translateX(18px)" : "translateX(0)",
          transition: "transform 120ms ease"
        } })
      }
    )
  ] });
}
var inject = ["slots", "settingsScope"];
function apply(ctx) {
  const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
  const policy = new ChatEntryPolicy(scope);
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "chat-entry",
    inject: () => ({ hooks: { show: policy.show } })
  }, ChatEntry));
  ctx.slots.inject("settings.general.item", () => ctx.slots.register({
    name: "settings.general.item",
    id: "chat-entry-toggle",
    order: 30,
    inject: () => ({
      hooks: { show: policy.show },
      setShow: (next) => {
        policy.setShow(next);
      }
    })
  }, ChatEntryToggle));
}
return module.exports; } });
