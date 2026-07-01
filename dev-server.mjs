import esbuild from "esbuild";
import { WebSocketServer } from "ws";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const WS_PORT = PORT + 1;
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
  const url = "ws://" + location.hostname + ":${WS_PORT}";
  let ws;
  function connect() {
    ws = new WebSocket(url);
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
  server.listen(PORT, () =>
    console.log(`\u2728 Dev server:  http://localhost:${PORT}`)
  );
  return server;
}

// ---- WebSocket broadcast ----------------------------------------------------
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`\ud83d\udd0c Live-reload WS on port ${WS_PORT}`);
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

function watch() {
  fs.watch(SRC, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const full = path.join(SRC, filename);
    // ignore editor temp files
    if (filename.endsWith("~") || filename.startsWith(".")) return;
    onChange(full);
  });
  // index.html lives in public/
  fs.watch(path.join(__dirname, "public"), (_e, filename) => {
    if (filename) onChange(path.join(__dirname, "public", filename));
  });
}

// ---- boot -------------------------------------------------------------------
(async () => {
  ctx = await esbuild.context(buildOptions);
  await rebuild();
  await copyStatic();
  await copyShaders();
  serve();
  watch();
  console.log("\ud83d\udc40 watching src/ \u2014 edit a .glsl file to see a live shader hot-swap\n");
})();
