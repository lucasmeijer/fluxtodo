# ◇ FLUX — a WebGL Todo experience

An in-memory todo app rendered on top of a live, domain-warped GLSL background,
with particle bursts on every action — and a hand-rolled dev server that
**hot-swaps GLSL shaders in the browser without a page reload**.

## Stack

- **esbuild** — bundles the TypeScript app; `.glsl` files import as text and
  live in esbuild's dependency graph, so editing a shader is a real rebuild.
- **Node `ws`** — the dev server pushes reload/hot-swap messages to the browser
  over a WebSocket.
- **three.js + custom GLSL** — animated shader background + additive particle
  system.
- **vanilla TypeScript** — the todo UI (no framework, in-memory store).

## Run

```bash
npm install
npm run dev      # http://localhost:3000  (WebSocket on 3001)
```

Production build:

```bash
npm run build    # -> dist/
```

## How live reload works

`dev-server.mjs` runs an esbuild `context`, serves `dist/`, and injects a tiny
WebSocket client into `index.html`. It watches `src/`:

| You edit…            | Server broadcasts        | Browser does…                          |
| -------------------- | ------------------------ | -------------------------------------- |
| a `.glsl` file only  | `{ type: "shader" }`     | re-fetches the shader source and swaps the `ShaderMaterial` **in place** — scene keeps running, todo state preserved |
| anything else        | `{ type: "full" }`       | `location.reload()`                    |

Shaders are copied to `dist/shaders/*.glsl` so the browser can re-fetch the raw
source for an in-place swap. Each shader registers a setter via
`registerShader()` (`src/webgl/hot.ts`); the injected client calls
`window.__hotSwapShader(file, source)` on a shader message.

## Layout

```
src/
  main.ts               app entry: UI + wiring + render loop
  todo.ts               in-memory todo store (subscribe/notify)
  styles.css            glassmorphism / neon theme
  webgl/
    background.ts        full-screen shader quad
    particles.ts         additive particle burst system
    hot.ts               shader hot-swap registry
    shaders/
      background.vert.glsl / background.frag.glsl
      particle.vert.glsl   / particle.frag.glsl
public/index.html       shell (dev server injects the reload client)
dev-server.mjs          esbuild watch + ws broadcast + static server
build.mjs               production build
```

Try it: run `npm run dev`, open the app, then edit
`src/webgl/shaders/background.frag.glsl` (e.g. tweak a palette color) and watch
the background morph instantly while your todos stay put.
