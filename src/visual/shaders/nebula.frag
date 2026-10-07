// Deep-space nebula behind everything: near-black void, blue/green domain-
// warped clouds that intensify with thought, faint concentric field rings.
uniform float uTime;
uniform float uAspect;
uniform vec2 uCenter;
uniform vec3 uField;
uniform vec3 uField2;
uniform vec3 uCore;
uniform vec3 uDeep;
uniform float uIntensity;
uniform float uSwirl;
uniform float uDetail;
uniform float uWave;     // palette wavefront, screen-height units (<0 none)
varying vec2 vUv;

void main() {
  vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0) * 2.0;
  float r = length(p);
  float t = uTime * 0.02;
  float s = sin(t * (0.6 + uSwirl * 3.0)), c = cos(t * (0.6 + uSwirl * 3.0));
  vec2 q = mat2(c, -s, s, c) * p * 1.1;
  vec2 warp = vec2(fbm(q + vec2(0.0, t * 3.0), uDetail), fbm(q + vec2(5.2, 1.3 - t * 2.0), uDetail));
  float n = fbm(q + warp * (1.4 + uSwirl * 2.0), uDetail);
  float n2 = fbm(q * 1.7 - warp + 3.1, uDetail);

  vec3 col = uDeep;
  // Two-tone clouds, strongest in a broad ring around the core.
  float band = smoothstep(0.1, 0.8, r) * (1.0 - smoothstep(1.4, 2.6, r));
  col += uField * pow(n, 2.4) * 1.5 * uIntensity * (0.25 + band);
  col += uField2 * pow(n2, 2.2) * 0.9 * uIntensity * band;
  // Core light leaking into the medium.
  col += uCore * exp(-r * 3.2) * 0.22 * uIntensity;
  // Very faint concentric field structure.
  col += uField * (0.5 + 0.5 * sin(r * 38.0 - uTime * 0.4)) * exp(-r * 1.8) * 0.06 * uIntensity;
  if (uWave > 0.0) col += uCore * exp(-pow((r - uWave) * 7.0, 2.0)) * 0.12;
  // Dither (dark gradients band easily).
  col += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
