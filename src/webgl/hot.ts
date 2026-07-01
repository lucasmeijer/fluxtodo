// Central registry that lets the live-reload client hot-swap GLSL sources
// without a full page reload.
type Setter = (source: string) => void;

const registry = new Map<string, Setter[]>();

export function registerShader(file: string, setter: Setter) {
  const arr = registry.get(file) ?? [];
  arr.push(setter);
  registry.set(file, arr);
}

// Exposed on window so the injected dev-server client can call it.
declare global {
  interface Window {
    __hotSwapShader?: (file: string, source: string) => void;
    __toast?: (msg: string, isError?: boolean) => void;
  }
}

export function installHotSwap() {
  window.__hotSwapShader = (file, source) => {
    const setters = registry.get(file);
    if (!setters || setters.length === 0) {
      // shader we don't know how to patch live -> full reload
      location.reload();
      return;
    }
    for (const set of setters) set(source);
  };
}
