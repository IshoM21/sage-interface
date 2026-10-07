// Instanced light streaks. Two layouts share this shader:
//  - TUNNEL: streaks lie on a cylinder around the view axis and travel toward
//    the camera (hyperspace speed lines).
//  - RAIN:   streaks fall vertically on a plane behind the seal.
// Motion is integrated on the CPU as one scalar (uTravel), so per-frame CPU
// cost is O(1) regardless of instance count.
attribute vec4 aData;   // tunnel: angle, radius, z0, length | rain: x, y0, z, length
attribute float aSeed;
uniform float uTravel;
uniform float uWidth;
uniform float uStretch;
uniform float uMode;    // 0 tunnel, 1 rain
uniform vec2 uRange;    // tunnel: zFar, zNear | rain: yBottom, yTop
varying vec2 vUv;
varying float vFade;
uniform float uFocus;

void main() {
  vUv = uv;
  vec3 p;
  if (uMode < 0.5) {
    float span = uRange.y - uRange.x;
    float z = uRange.x + mod(aData.z + uTravel * (0.6 + aSeed * 0.8), span);
    vec2 d = vec2(cos(aData.x), sin(aData.x));
    vec2 tng = vec2(-d.y, d.x);
    float len = aData.w * uStretch;
    float defocus = clamp(abs(z - uFocus) / 30.0, 0.0, 1.0);
    p = vec3(d * aData.y + tng * position.x * uWidth * (1.0 + defocus * 2.5), z + position.y * len);
    vFade = smoothstep(uRange.x, uRange.x + 18.0, z) * (1.0 - smoothstep(uRange.y - 6.0, uRange.y, z)) * (1.0 - defocus * 0.6);
  } else {
    float span = uRange.y - uRange.x;
    float y = uRange.y - mod(aData.y - uTravel * (0.7 + aSeed * 0.6), span);
    p = vec3(aData.x + position.x * uWidth, y + position.y * aData.w * uStretch, aData.z);
    vFade = smoothstep(uRange.x, uRange.x + 2.0, y) * (1.0 - smoothstep(uRange.y - 2.0, uRange.y, y));
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
