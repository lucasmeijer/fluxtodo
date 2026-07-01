precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;
uniform float uEnergy;   // rises when you complete todos

// --- hash / noise -----------------------------------------------------------
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + 0.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  float t = uTime * 0.06;

  // domain-warped fbm for a liquid, flowing look
  vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 4.3));
  vec2 r = vec2(fbm(p * 1.6 + q * 1.4 + t * 1.3 + 1.7),
                fbm(p * 1.6 + q * 1.4 - t * 1.1 + 9.2));
  float f = fbm(p * 1.8 + r * 1.5 + t);

  // mouse ripple
  float md = distance(uv, uMouse);
  f += 0.12 * sin(md * 26.0 - uTime * 2.2) * exp(-md * 4.0);

  // palette
  vec3 c1 = vec3(0.03, 0.05, 0.17);   // deep space
  vec3 c2 = vec3(0.20, 0.10, 0.55);   // violet
  vec3 c3 = vec3(0.10, 0.75, 0.95);   // cyan
  vec3 c4 = vec3(1.00, 0.36, 0.85);   // pink

  vec3 col = mix(c1, c2, smoothstep(-0.4, 0.5, f));
  col = mix(col, c3, smoothstep(0.15, 0.75, length(q)));
  col = mix(col, c4, smoothstep(0.55, 0.95, r.x + uEnergy * 0.35));

  // glowing filaments
  float lines = abs(0.5 + 0.5 * sin((r.x + r.y) * 8.0 + uTime * 0.6));
  col += (0.10 + 0.25 * uEnergy) * c3 * pow(1.0 - lines, 4.0);

  // vignette
  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
  col *= 0.55 + 0.6 * vig;

  // subtle grain
  col += (hash2(uv * uResolution + uTime).x) * 0.015;

  gl_FragColor = vec4(col, 1.0);
}

