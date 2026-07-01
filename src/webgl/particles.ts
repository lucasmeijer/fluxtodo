import * as THREE from "three";
import vertSrc from "./shaders/particle.vert.glsl";
import fragSrc from "./shaders/particle.frag.glsl";
import { registerShader } from "./hot";

const MAX = 4000;
const LIFE = 1.6;

export function createParticles(scene: THREE.Scene) {
  const geo = new THREE.BufferGeometry();
  const position = new Float32Array(MAX * 3);
  const velocity = new Float32Array(MAX * 3);
  const seed = new Float32Array(MAX);
  const birth = new Float32Array(MAX);
  birth.fill(-1000);

  geo.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geo.setAttribute("aVelocity", new THREE.BufferAttribute(velocity, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setAttribute("aBirth", new THREE.BufferAttribute(birth, 1));

  const uniforms = {
    uTime: { value: 0 },
    uLife: { value: LIFE },
    uSize: { value: 26 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  registerShader("particle.vert.glsl", (src) => {
    material.vertexShader = src;
    material.needsUpdate = true;
  });
  registerShader("particle.frag.glsl", (src) => {
    material.fragmentShader = src;
    material.needsUpdate = true;
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  let now = 0;

  // world-space burst at normalized screen coords (0..1)
  function burst(nx: number, ny: number, count = 90, hue = Math.random()) {
    // map screen -> our ortho world space [-aspect..aspect] x [-1..1]
    const aspect = window.innerWidth / window.innerHeight;
    const wx = (nx * 2 - 1) * aspect;
    const wy = ny * 2 - 1;

    for (let i = 0; i < count; i++) {
      const idx = cursor % MAX;
      cursor++;
      const a = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.1;
      position[idx * 3] = wx;
      position[idx * 3 + 1] = wy;
      position[idx * 3 + 2] = 0;
      velocity[idx * 3] = Math.cos(a) * speed;
      velocity[idx * 3 + 1] = Math.sin(a) * speed + 0.4;
      velocity[idx * 3 + 2] = 0;
      seed[idx] = (hue + Math.random() * 0.12) % 1;
      birth[idx] = now;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aVelocity.needsUpdate = true;
    geo.attributes.aSeed.needsUpdate = true;
    geo.attributes.aBirth.needsUpdate = true;
  }

  return {
    points,
    update(time: number) {
      now = time;
      uniforms.uTime.value = time;
    },
    burst,
  };
}
