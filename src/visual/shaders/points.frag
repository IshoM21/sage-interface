uniform sampler2D uMap;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vAlpha * uOpacity;
  gl_FragColor = vec4(vColor * a, a);
}
