uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vFade;
varying float vDefocus;
void main() {
  float a = texture2D(uMap, vUv, vDefocus * 4.5).a * vFade * uOpacity * (1.0 - vDefocus * 0.55);
  gl_FragColor = vec4(uColor * a, a);
}
