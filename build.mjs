import esbuild from "esbuild";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");
const SRC = path.join(__dirname, "src");

await fsp.rm(DIST, { recursive: true, force: true });
await fsp.mkdir(path.join(DIST, "shaders"), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(SRC, "main.ts")],
  bundle: true,
  outfile: path.join(DIST, "bundle.js"),
  format: "esm",
  minify: true,
  sourcemap: false,
  target: ["es2020"],
  loader: { ".glsl": "text", ".css": "css" },
});

await fsp.copyFile(
  path.join(__dirname, "public", "index.html"),
  path.join(DIST, "index.html")
);

const shaderDir = path.join(SRC, "webgl", "shaders");
for (const f of await fsp.readdir(shaderDir)) {
  if (f.endsWith(".glsl"))
    await fsp.copyFile(path.join(shaderDir, f), path.join(DIST, "shaders", f));
}

console.log("Built to dist/");
