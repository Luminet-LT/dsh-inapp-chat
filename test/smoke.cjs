'use strict';
/**
 * Smoke test for the client bundle — no browser, no build step, no network.
 *
 * It loads lib/client.js through a fake module loader and a minimal DOM, mounts
 * the sidebar entry the way the harness slots do, and then drives the click
 * handler through every branch:
 *
 *   1. standard bridge (window.dsh.desktop.openWindow)  -> in-app window
 *   2. legacy bridge (window.chrome.webview.postMessage) -> in-app window
 *   3. Electron shell, no bridge                        -> in-app dialog
 *   4. plain browser, no bridge                         -> new tab (anchor default)
 *
 * Run: node test/smoke.cjs
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CHAT_URL = 'https://chat.deepseek.com/';
const code = fs.readFileSync(path.join(__dirname, '..', 'lib', 'client.js'), 'utf8');

// ----------------------------------------------------------------- fake DOM
// Re-link the child list after every mutation so parentElement / nextSibling
// look like the real thing (the harness entry mount walks both).
function reindex(parent) {
  parent.children.forEach((child, index) => {
    child.parentNode = parent;
    child.parentElement = parent;
    child.previousSibling = index > 0 ? parent.children[index - 1] : null;
    child.nextSibling = index + 1 < parent.children.length ? parent.children[index + 1] : null;
  });
}

function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    style: {},
    children: [],
    attributes: {},
    listeners: {},
    textContent: '',
    innerHTML: '',
    value: '',
    parentNode: null,
    _classes: new Set(),
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    appendChild(child) { this.children.push(child); reindex(this); return child; },
    removeChild(child) { this.children = this.children.filter((c) => c !== child); reindex(this); return child; },
    insertBefore(child, ref) {
      const at = ref ? this.children.indexOf(ref) : -1;
      if (at === -1) this.children.push(child);
      else this.children.splice(at, 0, child);
      reindex(this);
      return child;
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatch(type, event) { (this.listeners[type] || []).forEach((fn) => fn(event || {})); },
    querySelector(selector) { return findAll(this, selector)[0] || null; },
    querySelectorAll(selector) { return findAll(this, selector); },
    closest() { return null; },
    contains() { return false; },
    focus() { this._focused = true; },
    getBoundingClientRect() { return { width: 240, height: 38, top: 0, left: 0 }; },
    get classList() {
      const set = this._classes;
      return {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
        toggle: (c) => (set.has(c) ? set.delete(c) : set.add(c)),
      };
    },
    get className() { return [...this._classes].join(' '); },
    set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
  };
  return el;
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function matches(el, selector) {
  if (selector.startsWith('#')) return el.id === selector.slice(1);
  if (selector.startsWith('.')) return el._classes.has(selector.slice(1));
  const tag = selector.match(/^[a-z]+/i);
  return tag ? el.tagName === tag[0].toUpperCase() : false;
}

function findAll(root, selector) {
  const out = [];
  for (const child of root.children || []) {
    if (matches(child, selector)) out.push(child);
    out.push(...findAll(child, selector));
  }
  return out;
}

const body = makeElement('body');
const head = makeElement('head');
const newSessionButton = makeElement('button');
newSessionButton.textContent = '新对话';
const sidebarRow = makeElement('div');
sidebarRow.appendChild(newSessionButton);
body.appendChild(sidebarRow);

const document = {
  body,
  head,
  getElementById(id) { return findAll(body, '#' + id).concat(findAll(head, '#' + id))[0] || null; },
  createElement: makeElement,
  querySelectorAll(selector) {
    if (selector === 'button') return [newSessionButton];
    return [];
  },
  addEventListener() {},
};

const elementsCreated = [];
const documentProxy = new Proxy(document, {
  get(target, prop) {
    if (prop === 'createElement') {
      return (tag) => { const el = makeElement(tag); elementsCreated.push(el); return el; };
    }
    return target[prop];
  },
});

const windowStub = {
  __ModuleLoader__: { load(def) { windowStub.__definition = def; } },
  addEventListener() {},
  removeEventListener() {},
  getSelection() { return null; },
  location: { href: '', origin: 'http://127.0.0.1:59166' },
  innerWidth: 1280,
  innerHeight: 800,
};

const navigatorStub = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Electron/31.0.0 Chrome/126 Safari/537.36',
  clipboard: null,
};

const storeStub = {
  createSnapshotStore(initial) {
    let value = initial;
    return {
      getSnapshot: () => value,
      set: (next) => { value = next; },
      subscribe: () => () => {},
    };
  },
};

const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useEffect: (fn) => { fn(); },
  useMemo: (fn) => fn(),
  useRef: (v) => ({ current: v }),
  useState: (v) => [v, () => {}],
  useSyncExternalStore: (_sub, getSnapshot) => getSnapshot(),
};

const stubs = {
  react: reactStub,
  'react/jsx-runtime': {
    jsx: (type, props) => ({ $$jsx: true, type, props }),
    jsxs: (type, props) => ({ $$jsx: true, type, props }),
    Fragment: {},
  },
  '@deepseek-ai/dsh-client-store': storeStub,
  '@deepseek-ai/dsh-client-ui-primitives': {},
};
const fakeRequire = (id) => {
  if (!(id in stubs)) throw new Error('unexpected require: ' + id);
  return stubs[id];
};

// ------------------------------------------------------------ load the bundle
const factory = new Function('window', 'document', 'navigator', 'require', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'setInterval', 'clearInterval', 'setTimeout', code);
factory(
  windowStub,
  documentProxy,
  navigatorStub,
  fakeRequire,
  class { observe() {} disconnect() {} },
  () => 0,
  () => {},
  () => 0,
  () => {},
  () => 0,
);

const definition = windowStub.__definition;
assert.ok(definition, 'bundle did not register itself with the module loader');
assert.strictEqual(definition.id, 'dsh-inapp-chat', 'module id must be dsh-inapp-chat');

const mod = definition.factory(fakeRequire);
assert.strictEqual(typeof mod.apply, 'function', 'apply must be exported');
assert.deepStrictEqual(mod.inject, ['slots', 'settingsScope'], 'inject must declare slots + settingsScope');

// ------------------------------------------------------------- mount via slots
const registered = [];
const ctx = {
  slots: {
    inject(_name, fn) { fn(); },
    register(def, component) { registered.push({ def, component }); return def; },
  },
  settingsScope: {
    bind() {
      return { getSnapshot: () => ({ value: undefined }), subscribe: () => () => {}, set: () => {} };
    },
  },
};
mod.apply(ctx);

assert.strictEqual(registered.length, 2, 'expected two slot registrations (entry + settings toggle)');
const entry = registered.find((r) => r.def.name === 'sidebar.footer.action');
const toggle = registered.find((r) => r.def.name === 'settings.general.item');
assert.ok(entry && toggle, 'expected sidebar entry + settings toggle slots');

// Mount the entry exactly like the harness does: inject() becomes props.
entry.component({ ...entry.def.inject(), wide: true, useShow: (fn) => fn(true) });

const host = document.getElementById('dsh-chat-entry');
assert.ok(host, 'sidebar entry host was not mounted below the New session button');
const anchor = host.children.find((c) => c.tagName === 'A');
assert.ok(anchor, 'entry anchor missing');
assert.strictEqual(anchor.href, CHAT_URL);
assert.strictEqual(anchor.target, '_blank');
assert.strictEqual(anchor.listeners.click.length, 1, 'anchor must have exactly one click handler');

function click() {
  const event = { prevented: false, preventDefault() { this.prevented = true; } };
  anchor.dispatch('click', event);
  return event;
}

function dialogRoot() {
  return document.getElementById('dsh-inapp-chat-dialog');
}

// ---------------------------------------------------- 1) standard bridge path
{
  const calls = [];
  windowStub.dsh = { desktop: { openWindow: (options) => { calls.push(options); return Promise.resolve(); } } };
  const event = click();
  assert.strictEqual(calls.length, 1, 'bridge openWindow must be called once');
  assert.strictEqual(calls[0].url, CHAT_URL);
  assert.strictEqual(event.prevented, true, 'anchor default must be suppressed when the bridge opens a window');
  delete windowStub.dsh;
}

// ------------------------------------------------------ 2) legacy bridge path
{
  const messages = [];
  windowStub.chrome = { webview: { postMessage: (m) => messages.push(m) } };
  const event = click();
  assert.strictEqual(messages.length, 1, 'legacy postMessage must be called once');
  const payload = JSON.parse(messages[0]);
  assert.strictEqual(payload.type, 'dsh.desktop.openWindow');
  assert.strictEqual(payload.url, CHAT_URL);
  assert.strictEqual(event.prevented, true);
  delete windowStub.chrome;
}

// ------------------------------- 3) Electron shell without a bridge -> dialog
{
  const event = click();
  assert.strictEqual(event.prevented, true, 'must not fall through to the OS browser inside a desktop shell');
  const root = dialogRoot();
  assert.ok(root, 'fallback dialog was not created');
  assert.ok(root.classList.contains('dshiac-open'), 'dialog must be visible');
  const buttons = findAll(root, 'button');
  const labels = buttons.map((b) => b.textContent);
  assert.ok(labels.includes('在系统浏览器打开'), 'dialog must offer opening in the system browser');
  assert.ok(labels.includes('复制修补命令'), 'dialog must offer copying the shell-patch command');
  assert.strictEqual(dialogRoot(), root, 'dialog must be reused, not rebuilt');
}

// ------------------------------------------- 4) plain browser -> new tab only
{
  navigatorStub.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
  const event = click();
  assert.strictEqual(event.prevented, false, 'a plain browser must keep the anchor target=_blank default');
  navigatorStub.userAgent = 'Mozilla/5.0 Electron/31.0.0';
}

// --------------------------------------------------------------- settings toggle
{
  let written = null;
  const props = { ...toggle.def.inject(), useShow: (fn) => fn(true) };
  props.setShow = (next) => { written = next; };
  const tree = toggle.component(props);
  assert.ok(tree && tree.$$jsx, 'settings toggle must render a tree');
  assert.strictEqual(tree.type, 'div');
  const switchButton = tree.props.children[1];
  assert.strictEqual(switchButton.type, 'button');
  switchButton.props.onClick();
  assert.strictEqual(written, false, 'clicking the switch must write the new preference');
}

console.log('smoke: all checks passed');
console.log('  · module id + exports + inject declaration');
console.log('  · sidebar entry mounts below the New session button');
console.log('  · bridge path opens an in-app window and suppresses the anchor');
console.log('  · legacy WebView2 bridge path posts the same payload');
console.log('  · Electron shell without a bridge shows the in-app dialog');
console.log('  · plain browser keeps opening a new tab');
console.log('  · settings toggle writes the preference');
