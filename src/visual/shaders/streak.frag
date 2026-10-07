uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vFade;
void main() {
  float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float along = sin(vUv.y * 3.14159);
  float a = across * across * along * vFade * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}
