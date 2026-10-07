// Corrupted data dump: lines of (invented) script are written bottom-first,
// dragged sideways into smeared bars, then thinned out. uP = progress 0..1.
uniform sampler2D uMap;
uniform float uP;
uniform float uLines;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  float line = floor(vUv.y * uLines);
  float h = hash12(vec2(line, 7.0));
  // Written: lower lines first, each typed left → right quickly.
  float appear = 0.12 + vUv.y * 0.24 + h * 0.06;
  float typed = clamp((uP - appear) / 0.1, 0.0, 1.0);
  // Smear: lines get dragged right, leaving a streak.
  float smear = smoothstep(0.4, 0.7, uP) * (0.04 + h * 0.3);
  // Thin out: lines vanish at random moments near the end.
  float alive = 1.0 - step(0.7 + h * 0.25, uP);

  vec3 col = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < 8; i++) {
    float k = float(i) / 7.0;
    vec2 uv = vec2(vUv.x - smear * k, vUv.y);
    float t = texture2D(uMap, uv).a * step(uv.x, typed) * step(0.0, uv.x);
    float w = mix(1.0, 0.55, k) * (smear > 0.005 ? 1.0 : (i == 0 ? 1.0 : 0.0));
    a = max(a, t * w);
  }
  a *= alive * uOpacity;
  col = mix(vec3(0.82, 0.95, 0.88), vec3(1.0), a);
  gl_FragColor = vec4(col * a, a);
}
