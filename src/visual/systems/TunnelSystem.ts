import { InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, type ShaderMaterial } from "three";
import { ROLE } from "../config/palettes";
import { TUNNEL } from "../config/visualConfig";
import type { EngineContext, VisualSystem } from "../core/types";
import { panelMaterial, streakMaterial } from "../shaders/ShaderManager";

function instanced(base: PlaneGeometry, count: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  g.setAttribute("uv", base.getAttribute("uv"));
  g.instanceCount = count;
  return g;
}

/**
 * Hyperspace: speed lines on a cylinder around the view axis plus flying
 * translucent data panels, all moving toward the camera. Animated entirely in
 * the vertex shader from one accumulated `travel` scalar.
 */
export class TunnelSystem implements VisualSystem {
  readonly name = "tunnel";
  private lines!: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private panels!: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private base = new PlaneGeometry(1, 1);
  private travel = 0;
  private counts = 0;

  constructor(private ctx0: EngineContext) {
    this.build(ctx0);
  }

  private build(ctx: EngineContext): void {
    this.dispose();
    const { rng, quality } = ctx;
    const n = quality.speedLines;
    const lg = instanced(this.base, n);
    const data = new Float32Array(n * 4);
    const seed = new Float32Array(n);
    const span = TUNNEL.zNear - TUNNEL.zFar;
    for (let i = 0; i < n; i++) {
      data[i * 4] = rng.next() * Math.PI * 2;
      data[i * 4 + 1] = TUNNEL.rMin + (TUNNEL.rMax - TUNNEL.rMin) * rng.next() ** 0.7;
      data[i * 4 + 2] = rng.next() * span;
      data[i * 4 + 3] = rng.range(2, 7);
      seed[i] = rng.next();
    }
    lg.setAttribute("aData", new InstancedBufferAttribute(data, 4));
    lg.setAttribute("aSeed", new InstancedBufferAttribute(seed, 1));
    const lm = streakMaterial(0);
    lm.uniforms.uRange.value.set(TUNNEL.zFar, TUNNEL.zNear);
    this.lines = new Mesh(lg, lm);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = -50;

    const m = quality.panels;
    const pg = instanced(this.base, m);
    const pd = new Float32Array(m * 4);
    const shape = new Float32Array(m * 2);
    for (let i = 0; i < m; i++) {
      pd[i * 4] = rng.next() * Math.PI * 2;
      pd[i * 4 + 1] = rng.range(3, 8.5);
      pd[i * 4 + 2] = rng.next() * span;
      pd[i * 4 + 3] = rng.range(0.35, 1.15);
      shape[i * 2] = rng.range(1.2, 1.8);
      shape[i * 2 + 1] = rng.range(-0.25, 0.25);
    }
    pg.setAttribute("aData", new InstancedBufferAttribute(pd, 4));
    pg.setAttribute("aShape", new InstancedBufferAttribute(shape, 2));
    const pm = panelMaterial(ctx.textures.panel);
    pm.uniforms.uRange.value.set(TUNNEL.zFar, TUNNEL.zNear);
    this.panels = new Mesh(pg, pm);
    this.panels.frustumCulled = false;
    this.panels.renderOrder = -45;

    ctx.scene.add(this.lines, this.panels);
    this.counts = n + m;
  }

  setQuality(ctx: EngineContext): void {
    this.build(ctx);
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, palette } = ctx;
    this.travel += dt * p.tunnelSpeed * 24;
    const lu = this.lines.material.uniforms;
    lu.uTravel.value = this.travel;
    lu.uStretch.value = 0.25 + p.tunnelSpeed * 1.2;
    lu.uWidth.value = 0.035;
    lu.uOpacity.value = p.tunnel * p.energy * 0.45;
    lu.uColor.value.setHex(palette.at(ROLE.secondary, 5));
    this.lines.visible = lu.uOpacity.value > 0.003;

    const pu = this.panels.material.uniforms;
    pu.uTravel.value = this.travel;
    pu.uOpacity.value = p.panels * p.energy * 0.32;
    pu.uColor.value.setHex(palette.at(ROLE.primary, 5));
    this.panels.visible = pu.uOpacity.value > 0.003;
  }

  stats() {
    return { particles: this.counts };
  }

  private dispose(): void {
    for (const m of [this.lines, this.panels]) {
      if (!m) continue;
      this.ctx0.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
  }

  destroy(): void {
    this.dispose();
    this.base.dispose();
  }
}
