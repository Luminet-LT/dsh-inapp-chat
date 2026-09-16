'use strict';
/**
 * Minimal, dependency-free asar tool used to patch the DeepSeek Harness
 * desktop shell (app.asar) from outside the installed application.
 *
 * Commands
 *   list   <asar>
 *   dump   <asar> <entry> [entry...]
 *   patch  <src.asar> <dst.asar>       (applies the dsh in-app chat window patch)
 *   verify <src.asar> <dst.asar>       (file-by-file comparison)
 */
const fs = require('node:fs');
const crypto = require('node:crypto');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readAsar(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const headerSize = head.readUInt32LE(4);
  const jsonSize = head.readUInt32LE(12);
  const jb = Buffer.alloc(jsonSize);
  fs.readSync(fd, jb, 0, jsonSize, 16);
  const header = JSON.parse(jb.toString('utf8'));
  const base = 8 + headerSize;
  return { fd, header, base, headerSize, jsonSize, file };
}

function entries(header) {
  const out = [];
  (function walk(node, prefix) {
    for (const name of Object.keys(node.files || {})) {
      const child = node.files[name];
      const p = prefix + name;
      if (child.files) walk(child, p + '/');
      else out.push({ path: p, node: child });
    }
  })(header, '');
  return out;
}

function readEntry(handle, node) {
  const size = node.size;
  const buf = Buffer.alloc(size);
  fs.readSync(handle.fd, buf, 0, size, handle.base + parseInt(node.offset, 10));
  return buf;
}

function listAsar(handle) {
  for (const e of entries(handle.header)) {
    console.log(`${e.path}  size=${e.node.size}  offset=${e.node.offset}${e.node.unpacked ? '  unpacked' : ''}`);
  }
}

function dumpAsar(handle, paths) {
  for (const p of paths) {
    const node = p.split('/').reduce((n, k) => (n && n.files ? n.files[k] : undefined), handle.header);
    if (!node) {
      console.log(`=== ${p} NOT FOUND ===`);
      continue;
    }
    console.log(`=== ${p} (${node.size} bytes) ===`);
    console.log(readEntry(handle, node).toString('utf8'));
  }
}

// ---------------------------------------------------------------------------
// The patch itself
// ---------------------------------------------------------------------------
const CHAT_WINDOW_BLOCK = `// ---------------------------------------------------------------------------
// 应用内「网页对话」窗口
//   面板里的 chat.deepseek.com 入口默认会被本壳丢给系统浏览器（见 createWindow
//   里的 openExternal 拦截）。这里改成在应用内开一个对话框形态的子窗口：站点走
//   顶层导航，不受该站 frame-ancestors 'none' 的限制，因此页面能正常显示与登录。
// ---------------------------------------------------------------------------
const CHAT_URL = 'https://chat.deepseek.com/';
// 这些域名在应用内窗口中打开（登录 / 账号相关页面也留在窗口里）
const IN_APP_HOSTS = ['chat.deepseek.com', 'account.deepseek.com'];

function isInAppHost(hostname) {
  return IN_APP_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h));
}

function isInAppUrl(target) {
  try {
    return isInAppHost(new URL(target).hostname);
  } catch {
    return false;
  }
}

let chatWindow = null;
let chatWindowUrl = null;

function openChatWindow(target) {
  const url = typeof target === 'string' && /^https?:\\/\\//i.test(target) ? target : CHAT_URL;
  if (chatWindow && !chatWindow.isDestroyed()) {
    if (url !== chatWindowUrl) {
      chatWindowUrl = url;
      chatWindow.loadURL(url);
    }
    if (chatWindow.isMinimized()) chatWindow.restore();
    chatWindow.show();
    chatWindow.focus();
    return chatWindow;
  }
  chatWindowUrl = url;
  chatWindow = new BrowserWindow({
    width: 460,
    height: 800,
    minWidth: 360,
    minHeight: 480,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false, // 对话框形态：浮在主窗口之上，主窗口仍可继续使用
    title: 'DeepSeek 网页对话',
    icon: iconImage(),
    backgroundColor: '#141c2b',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  chatWindow.loadURL(url);
  // 窗口内自己弹出的新窗口：站内的留在应用内，其余仍交给系统浏览器
  chatWindow.webContents.setWindowOpenHandler(({ url: t }) => {
    if (isInAppUrl(t)) chatWindow.loadURL(t);
    else if (/^https?:\\/\\//i.test(t)) shell.openExternal(t);
    return { action: 'deny' };
  });
  chatWindow.on('closed', () => {
    chatWindow = null;
    chatWindowUrl = null;
  });
  return chatWindow;
}
`;

const NEW_LINK_BLOCK = `  // 外部链接一律交给系统浏览器；白名单站点（chat.deepseek.com）例外：
  // 在应用内弹出对话框窗口，不再离开应用。
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isInAppUrl(target)) {
      openChatWindow(target);
      return { action: 'deny' };
    }
    if (/^https?:\\/\\//i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    const current = new URL(mainWindow.webContents.getURL());
    const next = new URL(target);
    if (current.origin !== next.origin) {
      event.preventDefault();
      if (isInAppUrl(target)) openChatWindow(target);
      else shell.openExternal(target);
    }
  });
`;

const OLD_LINK_BLOCK = `  // 外部链接一律交给系统浏览器，避免在应用内打开
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\\/\\//i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    const current = new URL(mainWindow.webContents.getURL());
    const next = new URL(target);
    if (current.origin !== next.origin) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
`;

const IPC_ANCHOR = `    ipcMain.handle('diagnostics:get', () => diagnosticsState);`;
const IPC_ADDITION = `${IPC_ANCHOR}
    // 应用内开窗：供 preload 暴露的 window.dsh.desktop.openWindow 使用，
    // 也让 harness 页面上的插件可以主动请求一个应用内窗口。
    ipcMain.handle('dsh:desktop:openWindow', (_event, options) => {
      const target = options && typeof options.url === 'string' ? options.url : undefined;
      openChatWindow(target);
      return { ok: true };
    });`;

const MAIN_WINDOW_ANCHOR = `let mainWindow = null;
let tray = null;`;

const PRELOAD_ADDITION = `
// ---------------------------------------------------------------------------
// 桌面壳 API：把「应用内开窗」能力暴露给页面（与 dsh-desktop-shell 的
// window.dsh.desktop 约定一致）。暴露失败不影响原有快捷键行为。
// ---------------------------------------------------------------------------
try {
  const { contextBridge, ipcRenderer } = require('electron');
  contextBridge.exposeInMainWorld('dsh', {
    desktop: {
      openWindow: (options) => ipcRenderer.invoke('dsh:desktop:openWindow', options || {}),
    },
  });
} catch (err) {
  console.warn('[desktop] 暴露 window.dsh.desktop 失败：', err && err.message);
}
`;

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first === -1) throw new Error(`anchor not found: ${label}`);
  if (source.indexOf(needle, first + 1) !== -1) throw new Error(`anchor not unique: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patchMainJs(source) {
  let out = replaceOnce(source, OLD_LINK_BLOCK, NEW_LINK_BLOCK, 'link interception block');
  out = replaceOnce(out, IPC_ANCHOR, IPC_ADDITION, 'ipcMain diagnostics anchor');
  out = replaceOnce(out, MAIN_WINDOW_ANCHOR, CHAT_WINDOW_BLOCK + '\n' + MAIN_WINDOW_ANCHOR, 'mainWindow declaration');
  return out;
}

function patchMainPreload(source) {
  if (source.includes("exposeInMainWorld('dsh'")) return source; // already patched
  return source + PRELOAD_ADDITION;
}

function patchAsar(srcPath, dstPath, options) {
  const skipPatch = !!(options && options.skipPatch);
  const handle = readAsar(srcPath);
  const all = entries(handle.header);
  const unpacked = all.filter((e) => e.node.unpacked);
  if (unpacked.length) throw new Error('asar contains unpacked entries; unsupported: ' + unpacked.map((e) => e.path).join(', '));

  const blobs = new Map();
  let patched = 0;
  for (const e of all) {
    let buf = readEntry(handle, e.node);
    if (!skipPatch && e.path === 'main.js') {
      buf = Buffer.from(patchMainJs(buf.toString('utf8')), 'utf8');
      patched++;
    } else if (!skipPatch && e.path === 'main-preload.js') {
      buf = Buffer.from(patchMainPreload(buf.toString('utf8')), 'utf8');
      patched++;
    }
    blobs.set(e.path, buf);
  }
  fs.closeSync(handle.fd);
  if (!skipPatch && patched !== 2) throw new Error(`expected to patch 2 files, patched ${patched}`);

  // Rebuild the header in its original key order, tightly packed like the
  // original archive (offsets are relative to the start of the file data).
  let offset = 0;
  for (const e of all) {
    const buf = blobs.get(e.path);
    const hash = sha256(buf);
    e.node.size = buf.length;
    e.node.offset = String(offset);
    e.node.integrity = {
      algorithm: 'SHA256',
      hash,
      blockSize: 4194304,
      blocks: [hash],
    };
    offset += buf.length;
  }

  // The archive header is an Electron Pickle holding one string. The original
  // archive keeps that string 4-byte aligned, so replicate the exact byte
  // layout: [4][headerSize][jsonSize+4][jsonSize][json padded to %4][files].
  let json = Buffer.from(JSON.stringify(handle.header), 'utf8');
  const pad = (4 - (json.length % 4)) % 4;
  if (pad) json = Buffer.concat([json, Buffer.alloc(pad, 0x20)]); // trailing spaces: valid JSON
  const jsonSize = json.length;
  const headerSize = jsonSize + 8;
  const head = Buffer.alloc(16);
  head.writeUInt32LE(4, 0);
  head.writeUInt32LE(headerSize, 4);
  head.writeUInt32LE(jsonSize + 4, 8);
  head.writeUInt32LE(jsonSize, 12);

  const fd = fs.openSync(dstPath, 'w');
  fs.writeSync(fd, head);
  fs.writeSync(fd, json);
  for (const e of all) fs.writeSync(fd, blobs.get(e.path));
  fs.closeSync(fd);
  console.log(`patched ${srcPath} -> ${dstPath} (${all.length} files, ${offset} bytes of data)`);
}

function verifyAsar(srcPath, dstPath) {
  const a = readAsar(srcPath);
  const b = readAsar(dstPath);
  const ea = entries(a.header);
  const eb = entries(b.header);
  if (ea.length !== eb.length) throw new Error(`entry count differs: ${ea.length} vs ${eb.length}`);
  let same = 0;
  const changed = [];
  for (let i = 0; i < ea.length; i++) {
    if (ea[i].path !== eb[i].path) throw new Error(`entry order differs at ${i}: ${ea[i].path} vs ${eb[i].path}`);
    const bufA = readEntry(a, ea[i].node);
    const bufB = readEntry(b, eb[i].node);
    if (bufA.equals(bufB)) same++;
    else changed.push(`${ea[i].path} (${bufA.length} -> ${bufB.length} bytes)`);
  }
  // integrity must match the stored bytes in the patched archive
  const bad = [];
  for (const e of eb) {
    const buf = readEntry(b, e.node);
    if (!e.node.integrity || e.node.integrity.hash !== sha256(buf)) bad.push(e.path);
  }
  fs.closeSync(a.fd);
  fs.closeSync(b.fd);
  console.log(`identical files: ${same}/${ea.length}`);
  console.log('changed files:', changed.length ? changed.join(', ') : '(none)');
  console.log('integrity mismatches:', bad.length ? bad.join(', ') : '(none)');
  return { changed, bad };
}

function extractAsar(handle, outDir, paths) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const p of paths) {
    const node = p.split('/').reduce((n, k) => (n && n.files ? n.files[k] : undefined), handle.header);
    if (!node) throw new Error('not found: ' + p);
    const out = require('node:path').join(outDir, p.replace(/[\\/]/g, '__'));
    fs.writeFileSync(out, readEntry(handle, node));
    console.log(out);
  }
  fs.closeSync(handle.fd);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'list') listAsar(readAsar(rest[0]));
else if (cmd === 'extract') extractAsar(readAsar(rest[0]), rest[1], rest.slice(2));
else if (cmd === 'dump') dumpAsar(readAsar(rest[0]), rest.slice(1));
else if (cmd === 'patch') patchAsar(rest[0], rest[1]);
else if (cmd === 'rewrite') patchAsar(rest[0], rest[1], { skipPatch: true });
else if (cmd === 'verify') verifyAsar(rest[0], rest[1]);
else {
  console.log('usage: node asar_tool.cjs <list|dump|patch|verify> ...');
  process.exit(2);
}
