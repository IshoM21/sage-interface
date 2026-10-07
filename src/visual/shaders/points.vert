// Shared point-sprite shader (stars, motes, bursts). Size attenuates with depth.
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uPixelRatio;
uniform float uScale;
uniform float uTime;
uniform float uTwinkle;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 1.0 - uTwinkle * 0.5 * (1.0 + sin(uTime * (1.0 + fract(aSize * 37.0) * 3.0) + position.x * 13.0));
  gl_PointSize = aSize * uPixelRatio * uScale / -mv.z;
  vColor = aColor;
  vAlpha = aAlpha * tw;
}
