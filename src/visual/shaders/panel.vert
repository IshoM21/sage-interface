// Instanced translucent "data panels" flying toward the camera through the tunnel.
attribute vec4 aData;   // angle, radius, z0, size
attribute vec2 aShape;  // aspect, spin
uniform float uTravel;
uniform vec2 uRange;
varying vec2 vUv;
varying float vFade;
varying float vDefocus;
uniform float uFocus;
void main() {
  vUv = uv;
  float span = uRange.y - uRange.x;
  float z = uRange.x + mod(aData.z + uTravel * 0.8, span);
  vec2 d = vec2(cos(aData.x), sin(aData.x));
  float c = cos(aShape.y), s = sin(aShape.y);
  // Out-of-focus panels swell slightly and soften (sampled from blurrier mips).
  vDefocus = clamp(abs(z - uFocus) / 26.0, 0.0, 1.0);
  vec2 local = vec2(position.x * aShape.x, position.y) * aData.w * (1.0 + vDefocus * 0.35);
  local = mat2(c, -s, s, c) * local;
  vec3 p = vec3(d * aData.y + local, z);
  vFade = smoothstep(uRange.x, uRange.x + 20.0, z) * (1.0 - smoothstep(uRange.y - 9.0, uRange.y, z));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
