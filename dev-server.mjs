import esbuild from "esbuild";
import { WebSocketServer } from "ws";
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DIST = path.join(__dirname, "dist");
const SRC = path.join(__dirname, "src");
const SHADER_SRC = path.join(SRC, "webgl", "shaders");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".glsl": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// ---- The live-reload client that gets injected into the page ----------------
const LIVERELOAD_CLIENT = `
<script>
(() => {
  // Same-origin WebSocket so it works through proxies (Atelier preview) and https.
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = proto + "//" + location.host + "/__livereload";
  let ws;
  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => console.log("[hot] live-reload connected");
    ws.onmessage = async (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "shader" && window.__hotSwapShader) {
        try {
          const res = await fetch("/shaders/" + msg.file + "?t=" + Date.now());
          const source = await res.text();
          window.__hotSwapShader(msg.file, source);
          console.log("%c[hot] shader swapped: " + msg.file, "color:#4ff");
          window.__toast && window.__toast("shader hot-swapped: " + msg.file);
        } catch (err) {
          console.warn("[hot] shader swap failed, reloading", err);
          location.reload();
        }
      } else if (msg.type === "full") {
        console.log("[hot] full reload");
        location.reload();
      } else if (msg.type === "building") {
        window.__toast && window.__toast("rebuilding\u2026");
      } else if (msg.type === "error") {
        console.error("[build error]\\n" + msg.message);
        window.__toast && window.__toast("build error (see console)", true);
      }
    };
    ws.onclose = () => setTimeout(connect, 700);
  }
  connect();
})();
</script>
`;

// ---- esbuild setup ----------------------------------------------------------
const buildOptions = {
  entryPoints: [path.join(SRC, "main.ts")],
  bundle: true,
  outfile: path.join(DIST, "bundle.js"),
  format: "esm",
  sourcemap: true,
  target: ["es2020"],
  loader: {
    ".glsl": "text",
    ".css": "css",
  },
  logLevel: "silent",
};

let ctx;
let lastError = null;

async function rebuild() {
  try {
    await ctx.rebuild();
    lastError = null;
    return true;
  } catch (err) {
    lastError = err;
    console.error("\n\u274c Build failed:\n", err.message || err);
    return false;
  }
}

async function copyShaders() {
  const outDir = path.join(DIST, "shaders");
  await fsp.mkdir(outDir, { recursive: true });
  const files = await fsp.readdir(SHADER_SRC);
  for (const f of files) {
    if (f.endsWith(".glsl")) {
      await fsp.copyFile(path.join(SHADER_SRC, f), path.join(outDir, f));
    }
  }
}

async function copyStatic() {
  await fsp.mkdir(DIST, { recursive: true });
  await fsp.copyFile(
    path.join(__dirname, "public", "index.html"),
    path.join(DIST, "index.html")
  );
}

// ---- HTTP server ------------------------------------------------------------
function serve() {
  const server = http.createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      const filePath = path.join(DIST, urlPath);
      if (!filePath.startsWith(DIST)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      let data = await fsp.readFile(filePath);
      const ext = path.extname(filePath);
      if (ext === ".html") {
        data = Buffer.from(
          data.toString("utf8").replace("</body>", LIVERELOAD_CLIENT + "</body>")
        );
      }
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  // Attach the live-reload WebSocket to THIS server (same port/origin) so it
  // survives proxies (Atelier preview) and https upgrades.
  wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/__livereload") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });
  server.listen(PORT, () =>
    console.log(`\u2728 Dev server:  http://localhost:${PORT}  (live-reload on same origin)`)
  );
  return server;
}

// ---- WebSocket broadcast ----------------------------------------------------
let wss;
function broadcast(obj) {
  const data = JSON.stringify(obj);
  let n = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1) { client.send(data); n++; }
  }
  console.log(`   → broadcast ${obj.type} to ${n}/${wss.clients.size} client(s)`);
}

// ---- Watcher ----------------------------------------------------------------
let debounce = null;
const pending = new Set();

function onChange(file) {
  pending.add(file);
  clearTimeout(debounce);
  debounce = setTimeout(flush, 60);
}

async function flush() {
  const files = [...pending];
  pending.clear();
  broadcast({ type: "building" });

  const ok = await rebuild();
  if (!ok) {
    broadcast({ type: "error", message: (lastError?.message || String(lastError)) });
    return;
  }

  const onlyShaders = files.length > 0 && files.every((f) => f.endsWith(".glsl"));
  if (onlyShaders) {
    await copyShaders();
    for (const f of files) {
      broadcast({ type: "shader", file: path.basename(f) });
      console.log(`\u26a1 shader hot-swap \u2192 ${path.basename(f)}`);
    }
  } else {
    await copyShaders();
    await copyStatic();
    broadcast({ type: "full" });
    console.log(`\u21bb full reload (${files.map((f) => path.basename(f)).join(", ")})`);
  }
}

// fs.watch({ recursive: true }) is unreliable with atomic saves, bind mounts,
// and some container filesystems. A small polling snapshot catches all of those
// cases, including files being added, renamed, or deleted.
const WATCH_INTERVAL = Number(process.env.WATCH_INTERVAL) || 250;
const WATCH_ROOTS = [SRC, path.join(__dirname, "public")];

function isEditorTemp(file) {
  const name = path.basename(file);
  return name.startsWith(".") || name.endsWith("~") || name.endsWith(".swp");
}

async function snapshotTree(root, snapshot) {
  let entries;
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`[watch] cannot read ${root}:`, err.message);
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    const full = path.join(root, entry.name);
    if (isEditorTemp(full)) return;
    if (entry.isDirectory()) return snapshotTree(full, snapshot);
    if (!entry.isFile()) return;
    try {
      const stat = await fsp.stat(full);
      snapshot.set(full, `${stat.mtimeMs}:${stat.size}`);
    } catch (err) {
      if (err.code !== "ENOENT") console.warn(`[watch] cannot stat ${full}:`, err.message);
    }
  }));
}

async function takeSnapshot() {
  const snapshot = new Map();
  await Promise.all(WATCH_ROOTS.map((root) => snapshotTree(root, snapshot)));
  return snapshot;
}

async function watch() {
  let previous = await takeSnapshot();
  let scanning = false;

  setInterval(async () => {
    if (scanning) return;
    scanning = true;
    try {
      const next = await takeSnapshot();
      for (const [file, signature] of next) {
        if (previous.get(file) !== signature) onChange(file);
      }
      for (const file of previous.keys()) {
        if (!next.has(file)) onChange(file);
      }
      previous = next;
    } catch (err) {
      console.warn("[watch] scan failed:", err.message);
    } finally {
      scanning = false;
    }
  }, WATCH_INTERVAL);

  console.log(`👀 polling src/ and public/ every ${WATCH_INTERVAL}ms`);
}

// ---- boot -------------------------------------------------------------------
(async () => {
  ctx = await esbuild.context(buildOptions);
  await rebuild();
  await copyStatic();
  await copyShaders();
  serve();
  await watch();
  console.log("   edit a .glsl file to see a live shader hot-swap\n");
})();
