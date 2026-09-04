precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;
uniform float uEnergy;
uniform float uSpeed;
uniform float uScale;
uniform float uRipple;
uniform float uGlow;
uniform float uSaturation;

#define PI 3.14159265359

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float softLine(float value, float width) {
  return 1.0 - smoothstep(0.0, width, abs(value));
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 mouse = (uMouse - 0.5) * vec2(aspect, 1.0);

  float time = uTime * (0.16 + uSpeed * 0.035);
  float energy = min(uEnergy, 1.5);

  // Pull the warp core subtly toward the pointer.
  vec2 core = mouse * 0.16;
  vec2 q = p - core;
  float radius = length(q);
  float angle = atan(q.y, q.x);

  // A rotating spiral tunnel: crisp, graphic, and very different from clouds.
  float turns = 9.0 + uScale * 5.0;
  float spiralPhase = angle * 5.0 - log(radius + 0.055) * turns + time * 2.1;
  float spiral = pow(max(0.0, 0.5 + 0.5 * cos(spiralPhase)), 12.0);
  spiral *= smoothstep(0.035, 0.28, radius) * (1.0 - smoothstep(0.35, 1.15, radius));

  // Concentric shock rings travel outward from the core.
  float ringPhase = radius * 22.0 - time * 3.2;
  float rings = pow(max(0.0, 0.5 + 0.5 * cos(ringPhase)), 24.0);
  rings *= smoothstep(0.08, 0.22, radius) * (1.0 - smoothstep(0.65, 1.25, radius));

  // Polar star lanes rush toward the viewer.
  float sector = floor((angle + PI) / (2.0 * PI) * 150.0);
  float depth = fract(sector * 0.618 + 1.0 / (radius + 0.045) * 0.075 - time * 0.55);
  float seed = hash21(vec2(sector, floor(time * 0.55)));
  float ray = pow(max(0.0, 1.0 - abs(fract((angle / (2.0 * PI)) * 150.0) - 0.5) * 2.0), 20.0);
  float stars = ray * pow(depth, 7.0) * step(0.69, seed);
  stars *= smoothstep(0.16, 0.48, radius);

  // Pointer sends a luminous circular disturbance through the tunnel.
  float pointerDistance = distance(p, mouse);
  float ripple = softLine(sin(pointerDistance * 28.0 - uTime * 3.5), 0.13);
  ripple *= exp(-pointerDistance * 3.5) * 0.16 * uRipple;

  vec3 midnight = vec3(0.008, 0.004, 0.025);
  vec3 violet = vec3(0.28, 0.015, 0.52);
  vec3 hotPink = vec3(1.0, 0.025, 0.32);
  vec3 solar = vec3(1.0, 0.72, 0.08);
  vec3 electricBlue = vec3(0.04, 0.58, 1.0);

  // Angular color bands revolve independently from the geometry.
  float paletteShift = 0.5 + 0.5 * sin(angle * 2.0 - time + radius * 5.0);
  vec3 neon = mix(hotPink, solar, paletteShift);
  neon = mix(neon, electricBlue, 0.5 + 0.5 * sin(angle * 3.0 + time * 0.7));

  vec3 col = midnight;
  col += violet * (0.12 / (radius + 0.14));
  col += neon * spiral * (0.38 + 0.15 * uGlow);
  col += mix(hotPink, solar, radius) * rings * (0.25 + energy * 0.7);
  col += mix(electricBlue, solar, depth) * stars * (1.2 + uGlow * 0.28);
  col += solar * ripple;

  // Black-hole core, surrounded by a hot event horizon.
  float horizon = exp(-abs(radius - (0.105 + energy * 0.012)) * 85.0);
  col += mix(hotPink, solar, 0.55 + 0.45 * sin(time)) * horizon * (0.8 + energy);
  col *= smoothstep(0.025, 0.12, radius);
  col += vec3(0.015, 0.005, 0.025) * (1.0 - smoothstep(0.0, 0.085, radius));

  // Keep the edges cinematic and add fine analog grain.
  float vignette = smoothstep(1.12, 0.22, length((uv - 0.5) * vec2(0.85, 1.0)));
  col *= 0.42 + 0.75 * vignette;
  col += (hash21(gl_FragCoord.xy + floor(uTime * 30.0)) - 0.5) * 0.035;

  float luminance = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luminance), col, 0.8 + uSaturation * 1.5);
  col = col / (1.0 + col * 0.38);

  gl_FragColor = vec4(col, 1.0);
}
