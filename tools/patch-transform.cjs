// Transform for build-asar.cjs: adds the in-app chat window bridge to the
// official 0.2.x Electron shell (lib/main.js + lib/preload-app.cjs).
const MARKER = "dsh-inapp-chat shell patch";
const IPC = "dsh:desktop:openWindow";

const MAIN_BLOCK = `// === ${MARKER} (0.2.x) ===
const DSH_INAPP_CHAT_IPC = "${IPC}";
const DSH_INAPP_CHAT_URL = "https://chat.deepseek.com/";
let dshInAppChatWindow;
function dshInAppChatAllowed(value) {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "https:" && !parsed.username && !parsed.password && /(^|\\.)deepseek\\.com$/i.test(parsed.hostname);
	} catch {
		return false;
	}
}
function openDshInAppChatWindow(requested) {
	const target = typeof requested === "string" && dshInAppChatAllowed(requested) ? new URL(requested).href : DSH_INAPP_CHAT_URL;
	if (dshInAppChatWindow !== void 0 && !dshInAppChatWindow.isDestroyed()) {
		if (dshInAppChatWindow.webContents.getURL() !== target) dshInAppChatWindow.loadURL(target).catch(() => void 0);
		if (dshInAppChatWindow.isMinimized()) dshInAppChatWindow.restore();
		dshInAppChatWindow.show();
		dshInAppChatWindow.focus();
		return { ok: true };
	}
	const window = new BrowserWindow({
		width: 640,
		height: 820,
		minWidth: 360,
		minHeight: 480,
		title: "DeepSeek 网页对话",
		autoHideMenuBar: true,
		backgroundColor: "#141c2b",
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			partition: "persist:dsh-inapp-chat"
		}
	});
	dshInAppChatWindow = window;
	window.on("closed", () => {
		if (dshInAppChatWindow === window) dshInAppChatWindow = void 0;
	});
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => void 0);
		return { action: "deny" };
	});
	window.loadURL(target).catch(() => void 0);
	return { ok: true };
}
ipcMain.handle(DSH_INAPP_CHAT_IPC, (event, options) => {
	const frame = event.senderFrame;
	if (frame === null || frame === void 0 || !frame.url.startsWith("dsh-app://app/")) throw new Error("dsh desktop: rejected in-app chat window request");
	return openDshInAppChatWindow(options !== null && typeof options === "object" ? options.url : void 0);
});
// === end ${MARKER} ===
`;

const PRELOAD_BLOCK = `
// === ${MARKER} (0.2.x) ===
try {
	if (location.protocol === \`dsh-app:\` && location.hostname === "app" && process.isMainFrame !== false) {
		electron.contextBridge.exposeInMainWorld("dsh", {
			desktop: {
				openWindow: (options) => electron.ipcRenderer.invoke("${IPC}", options === null || options === void 0 ? {} : options)
			}
		});
	}
} catch (error) {
	console.warn("[dsh-inapp-chat] expose window.dsh.desktop failed:", error && error.message);
}
// === end ${MARKER} ===
`;

function insertOnce(source, needle, block, label) {
	const first = source.indexOf(needle);
	if (first === -1) throw new Error("anchor not found: " + label);
	if (source.indexOf(needle, first + 1) !== -1) throw new Error("anchor not unique: " + label);
	return source.slice(0, first) + block + source.slice(first);
}

module.exports = function transform(datas) {
	let main = datas.get("lib/main.js");
	let pre = datas.get("lib/preload-app.cjs");
	if (!main || !pre) throw new Error("expected lib/main.js and lib/preload-app.cjs in archive");
	main = main.toString("utf8");
	pre = pre.toString("utf8");
	if (main.includes(MARKER)) throw new Error("main.js already patched");
	if (pre.includes(MARKER)) throw new Error("preload already patched");

	const patchedMain = insertOnce(main, "\nasync function main() {", MAIN_BLOCK, "async function main()");
	const patchedPre = pre + PRELOAD_BLOCK;

	// cheap sanity: balanced braces of the inserted region are covered by node --check later.
	if (!patchedMain.includes(IPC) || !patchedPre.includes(IPC)) throw new Error("patch did not land");
	datas.set("lib/main.js", Buffer.from(patchedMain, "utf8"));
	datas.set("lib/preload-app.cjs", Buffer.from(patchedPre, "utf8"));
	console.log("patched main.js +" + (patchedMain.length - main.length) + "B, preload +" + (patchedPre.length - pre.length) + "B");
};
