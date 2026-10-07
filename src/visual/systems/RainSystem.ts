import { InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, type ShaderMaterial } from "three";
import { ROLE } from "../config/palettes";
import type { EngineContext, VisualSystem } from "../core/types";
import { streakMaterial } from "../shaders/ShaderManager";

const Y_RANGE = 9;

/** Falling light behind the seal — the "understood / resolved" atmosphere. GPU-animated. */
export class RainSystem implements VisualSystem {
  readonly name = "rain";
  private mesh!: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private base = new PlaneGeometry(1, 1);
  private travel = 0;
  private count = 0;

  constructor(private ctx0: EngineContext) {
    this.build(ctx0);
  }

  private build(ctx: EngineContext): void {
    if (this.mesh) {
      ctx.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    const n = ctx.quality.rain;
    const g = new InstancedBufferGeometry();
    g.index = this.base.index;
    g.setAttribute("position", this.base.getAttribute("position"));
    g.setAttribute("uv", this.base.getAttribute("uv"));
    g.instanceCount = n;
    const data = new Float32Array(n * 4);
    const seed = new Float32Array(n);
    const { rng } = ctx;
    for (let i = 0; i < n; i++) {
      // Denser near the vertical centre line, like light pouring from the core.
      const x = (rng.next() - 0.5) * 2;
      data[i * 4] = Math.sign(x) * Math.abs(x) ** 1.6 * 11;
      data[i * 4 + 1] = rng.next() * Y_RANGE * 2;
      data[i * 4 + 2] = rng.range(-6, -1.5);
      data[i * 4 + 3] = rng.range(0.15, 0.7);
      seed[i] = rng.next();
    }
    g.setAttribute("aData", new InstancedBufferAttribute(data, 4));
    g.setAttribute("aSeed", new InstancedBufferAttribute(seed, 1));
    const m = streakMaterial(1);
    m.uniforms.uRange.value.set(-Y_RANGE, Y_RANGE);
    m.uniforms.uWidth.value = 0.025;
    this.mesh = new Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -40;
    ctx.scene.add(this.mesh);
    this.count = n;
  }

  setQuality(ctx: EngineContext): void {
    this.build(ctx);
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, palette } = ctx;
    const u = this.mesh.material.uniforms;
    const op = p.rain * p.energy * 0.75;
    this.mesh.visible = op > 0.003;
    if (!this.mesh.visible) return;
    this.travel += dt * 3.2;
    u.uTravel.value = this.travel;
    u.uOpacity.value = op;
    u.uColor.value.setHex(palette.at(ROLE.accent, 3));
  }

  stats() {
    return { particles: this.count };
  }

  destroy(): void {
    this.ctx0.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.base.dispose();
  }
}
