precision highp float;

varying float vAlpha;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;

  float glow = smoothstep(0.5, 0.0, d);

  // rainbow-ish per particle color
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (vSeed + vec3(0.0, 0.33, 0.67)));
  col = mix(vec3(1.0), col, 0.7);

  gl_FragColor = vec4(col * glow, glow * vAlpha);
}
