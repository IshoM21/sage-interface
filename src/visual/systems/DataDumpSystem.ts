import { AdditiveBlending, CanvasTexture, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { CAMERA } from "../config/visualConfig";
import { ALPHABET_SIZE, drawGlyph } from "../core/glyphs";
import { Rng } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";
import basicVert from "../shaders/basic.vert?raw";
import dumpFrag from "../shaders/datadump.frag?raw";
import noise from "../shaders/noise.glsl?raw";

const LINES = 34;
const DEPTH = 4;

/** An atlas of "code" lines written in the interface's own procedural script. */
function linesTexture(): CanvasTexture {
  const W = 2048;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const rng = new Rng(0xc0de);
  const lh = H / LINES;
  g.strokeStyle = g.fillStyle = "#fff";
  g.lineCap = "round";
  for (let l = 0; l < LINES; l++) {
    if (rng.next() < 0.18) continue; // blank lines, like a listing
    const gh = lh * 0.55;
    const gw = gh * 0.62;
    g.lineWidth = gh * 0.11;
    let x = W * (rng.next() < 0.5 ? 0.06 : 0.3 + rng.next() * 0.3);
    const end = x + W * (0.15 + rng.next() * 0.45);
    while (x < end) {
      if (rng.next() < 0.12) {
        x += gw * 1.2; // word gap
        continue;
      }
      g.save();
      g.translate(x, l * lh + (lh - gh) / 2);
      drawGlyph(g, rng.int(ALPHABET_SIZE), gw, gh);
      g.restore();
      x += gw * 1.05;
    }
  }
  const t = new CanvasTexture(c);
  t.flipY = true;
  return t;
}

/**
 * The corrupted-data interlude (CRITICAL entry): a full-screen plane attached
 * to the camera, animated entirely by one progress uniform.
 */
export class DataDumpSystem implements VisualSystem {
  readonly name = "datadump";
  private mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private t = -1;
  private duration = 1.1;

  constructor(ctx: EngineContext) {
    const mat = new ShaderMaterial({
      vertexShader: basicVert,
      fragmentShader: noise + "\n" + dumpFrag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uMap: { value: linesTexture() },
        uP: { value: 0 },
        uLines: { value: LINES },
        uOpacity: { value: 1 },
      },
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), mat);
    this.mesh.position.set(0, 0, -DEPTH);
    this.mesh.renderOrder = 90;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    ctx.camera.add(this.mesh);
  }

  play(duration: number): void {
    this.t = 0;
    this.duration = duration;
    this.mesh.visible = true;
  }

  update(ctx: EngineContext): void {
    // Always fill the view at the plane's depth.
    const halfH = Math.tan((CAMERA.fov * Math.PI) / 360) * DEPTH;
    this.mesh.scale.set(halfH * 2 * ctx.view.aspect * 0.92, halfH * 2 * 0.86, 1);
    if (this.t < 0) return;
    this.t += ctx.dt;
    const p = this.t / this.duration;
    this.mesh.material.uniforms.uP.value = p;
    if (p >= 1) {
      this.t = -1;
      this.mesh.visible = false;
    }
  }

  destroy(): void {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.uniforms.uMap.value.dispose();
    this.mesh.material.dispose();
  }
}
