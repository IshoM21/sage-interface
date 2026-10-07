// Single post pass after bloom (linear space, before OutputPass):
// retry grid, shockwave refraction, datamosh blocks, chromatic aberration,
// failure inversion (dark → paper white, light → red), flash, grain, vignette.
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uAspect;
uniform vec2 uCenter;
uniform float uTiles;
uniform float uTileInvert;   // fraction of grid cells shown as failure frames
uniform float uShockR;
uniform float uShockWidth;
uniform float uShockStrength;
uniform float uAberration;
uniform float uGlitch;
uniform float uInvert;
uniform vec3 uInvertInk;
uniform float uFlash;
uniform float uCut;
uniform float uWhite;
uniform float uDefocus;    // focus pull (mechanical seal)      // white immersion (milestone opening)        // full-frame flash frame (editing "cut")
uniform vec3 uCutColor;
uniform vec3 uFlashColor;
uniform float uGrain;
uniform float uVignette;
varying vec2 vUv;

vec3 sampleAt(vec2 uv) { return texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb; }

void main() {
  vec2 uv = vUv;

  // Retry beat: the frame repeats in a grid (each tile slightly offset in time/brightness).
  float tileShade = 1.0;
  float tileFail = 0.0;
  if (uTiles > 1.01) {
    vec2 cell = floor(uv * uTiles);
    // Cells flip between attempt (normal) and failure (inverted) frames.
    tileFail = step(hash12(cell * 1.7 + floor(uTime * 5.0)), uTileInvert);
    uv = fract(uv * uTiles);
    tileShade = 0.75 + 0.25 * hash12(cell + floor(uTime * 8.0));
  }

  vec2 d = (uv - uCenter) * vec2(uAspect, 1.0);
  float r = length(d) * 2.0;
  vec2 dir = r > 1e-4 ? normalize(d) : vec2(0.0);

  if (uShockStrength > 0.001) {
    float x = (r - uShockR) / max(uShockWidth, 1e-3);
    uv -= dir / vec2(uAspect, 1.0) * exp(-x * x) * x * uShockStrength * 0.014;
  }

  // Datamosh: coarse blocks jump sideways and smear.
  if (uGlitch > 0.001) {
    vec2 block = floor(uv * vec2(16.0, 9.0));
    float tick = floor(uTime * 12.0);
    float h = hash12(block + tick);
    float on = step(1.0 - 0.18 * uGlitch, h);
    uv.x += on * (hash12(block.yx + tick) - 0.5) * 0.12 * uGlitch;
    uv.y += on * (hash12(block + tick + 3.0) - 0.5) * 0.03 * uGlitch;
  }

  vec3 col = sampleAt(uv);
  if (uDefocus > 0.01) {
    // Cheap disc blur for focus pulls (only active for ~1 s).
    vec3 acc = col;
    float rad = uDefocus * 0.012;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236;
      acc += sampleAt(uv + vec2(cos(a), sin(a) * uAspect) * rad);
      acc += sampleAt(uv + vec2(cos(a + 0.26), sin(a + 0.26) * uAspect) * rad * 0.5);
    }
    col = acc / 25.0;
  }
  if (uAberration > 0.001) {
    vec2 ca = dir / vec2(uAspect, 1.0) * uAberration * 0.006 * (0.25 + r);
    col.r = sampleAt(uv + ca).r;
    col.b = sampleAt(uv - ca).b;
  }

  // Failure inversion: paper-white ground, red ink where there was light.
  float invertAmount = max(uInvert, tileFail * 0.9);
  if (invertAmount > 0.001) {
    float lum = dot(min(col, vec3(1.0)), vec3(0.299, 0.587, 0.114));
    vec3 paper = vec3(0.92, 0.9, 0.88);
    vec3 inv = mix(paper, uInvertInk, smoothstep(0.08, 0.6, lum));
    col = mix(col, inv, invertAmount);
  }

  col *= tileShade;
  col += uFlashColor * uFlash * (0.08 + 0.92 * exp(-r * 2.2));
  col = mix(col, uCutColor, uCut);
  col = mix(col, vec3(1.0, 0.995, 0.975), uWhite);
  col += (hash12(gl_FragCoord.xy + uTime * 97.0) - 0.5) * uGrain;
  float vig = smoothstep(2.2, 0.4, length((vUv - 0.5) * vec2(uAspect, 1.0)) * 2.0);
  col *= mix(1.0, vig, uVignette * (1.0 - uInvert));
  gl_FragColor = vec4(col, 1.0);
}
