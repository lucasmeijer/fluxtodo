import * as THREE from "three";
import vertSrc from "./shaders/background.vert.glsl";
import fragSrc from "./shaders/background.frag.glsl";
import { registerShader } from "./hot";

export function createBackground(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uEnergy: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  // --- hot-swap hooks: editing either shader file rebuilds the material ------
  registerShader("background.vert.glsl", (src) => {
    material.vertexShader = src;
    material.needsUpdate = true;
  });
  registerShader("background.frag.glsl", (src) => {
    material.fragmentShader = src;
    material.needsUpdate = true;
  });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w, h);
    const aspect = w / h;
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("pointermove", (e) => {
    uniforms.uMouse.value.set(
      e.clientX / window.innerWidth,
      1 - e.clientY / window.innerHeight
    );
  });

  // energy decays over time; pulse() spikes it
  return {
    renderer,
    scene,
    camera,
    update(time: number) {
      uniforms.uTime.value = time;
      uniforms.uEnergy.value *= 0.985;
      renderer.render(scene, camera);
    },
    pulse(amount = 0.6) {
      uniforms.uEnergy.value = Math.min(1.5, uniforms.uEnergy.value + amount);
    },
  };
}
