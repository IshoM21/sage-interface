// Script ring revealed angularly (written around the circle as it appears).
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uReveal;  // 0..1 of the full circle
uniform float uStart;   // angle offset where writing begins
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float ang = fract((atan(p.y, p.x) - uStart) / 6.2831853);
  float mask = 1.0 - smoothstep(uReveal - 0.01, uReveal, ang);
  float a = texture2D(uMap, vUv).a * mask * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}
