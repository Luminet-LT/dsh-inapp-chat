// Rebuild an Electron app.asar with a small text patch preserved.
// Roundtrip mode (no transform) must reproduce the source byte-for-byte.
const fs = require("fs");
const crypto = require("crypto");

const BLOCK = 4194304;

function readHeader(asarPath) {
  const fd = fs.openSync(asarPath, "r");
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const jsonLen = head.readUInt32LE(12);
  const padded = (jsonLen + 3) & ~3;
  const jsonBuf = Buffer.alloc(jsonLen);
  fs.readSync(fd, jsonBuf, 0, jsonLen, 16);
  const header = JSON.parse(jsonBuf.toString("utf8"));
  return { fd, header, dataStart: 16 + padded };
}

function collect(header) {
  const out = [];
  (function walk(node, prefix) {
    for (const [name, child] of Object.entries(node.files || {})) {
      const p = prefix ? prefix + "/" + name : name;
      if (child.files) walk(child, p);
      else out.push({ path: p, node: child });
    }
  })(header, "");
  return out;
}

function integrityFor(buf) {
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const blocks = [];
  for (let i = 0; i < buf.length; i += BLOCK) {
    blocks.push(crypto.createHash("sha256").update(buf.subarray(i, i + BLOCK)).digest("hex"));
  }
  if (blocks.length === 0) blocks.push(hash);
  return { algorithm: "SHA256", hash, blockSize: BLOCK, blocks };
}

function rebuild(srcPath, outPath, transform) {
  const { fd, header, dataStart } = readHeader(srcPath);
  const entries = collect(header);
  const datas = new Map();
  for (const e of entries) {
    if (e.node.unpacked) continue;
    const size = Number(e.node.size);
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, dataStart + Number(e.node.offset));
    datas.set(e.path, buf);
  }
  fs.closeSync(fd);
  if (transform) transform(datas);

  let offset = 0;
  for (const e of entries) {
    if (e.node.unpacked) continue;
    const buf = datas.get(e.path);
    e.node.size = buf.length;
    e.node.offset = String(offset);
    e.node.integrity = integrityFor(buf);
    offset += buf.length;
  }

  const json = JSON.stringify(header);
  const jsonLen = Buffer.byteLength(json);
  const padded = (jsonLen + 3) & ~3;
  const out = fs.openSync(outPath, "w");
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(8 + padded, 4);
  prefix.writeUInt32LE(4 + padded, 8);
  prefix.writeUInt32LE(jsonLen, 12);
  fs.writeSync(out, prefix);
  fs.writeSync(out, Buffer.from(json, "utf8"));
  fs.writeSync(out, Buffer.alloc(padded - jsonLen));
  for (const e of entries) {
    if (e.node.unpacked) continue;
    fs.writeSync(out, datas.get(e.path));
  }
  fs.closeSync(out);
  return { entries: entries.length, unpacked: entries.filter((e) => e.node.unpacked).length };
}

const mode = process.argv[2];
const src = process.argv[3];
const dst = process.argv[4];
const t0 = Date.now();
const stats = rebuild(src, dst, mode === "patch" ? require("./patch-transform.cjs") : undefined);
const h1 = crypto.createHash("sha256").update(fs.readFileSync(src)).digest("hex");
const h2 = crypto.createHash("sha256").update(fs.readFileSync(dst)).digest("hex");
console.log(JSON.stringify({ mode, ...stats, identical: h1 === h2, seconds: ((Date.now() - t0) / 1000).toFixed(1) }));
if (mode === "roundtrip" && h1 !== h2) { console.error("ROUNDTRIP MISMATCH"); process.exit(2); }
