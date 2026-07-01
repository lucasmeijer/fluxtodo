attribute vec3 aVelocity;
attribute float aSeed;
attribute float aBirth;

uniform float uTime;
uniform float uLife;
uniform float uSize;

varying float vAlpha;
varying float vSeed;

void main() {
  float age = uTime - aBirth;
  float life = clamp(age / uLife, 0.0, 1.0);

  vec3 pos = position + aVelocity * age;
  pos.y -= 0.55 * age * age;            // gravity
  pos += 0.15 * sin(vec3(aSeed * 6.28) + uTime * 3.0) * age; // swirl

  vAlpha = (1.0 - life) * step(0.0, age) * (1.0 - step(1.0, life));
  vSeed = aSeed;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (1.0 - life * 0.6) * (300.0 / -mv.z);
}
