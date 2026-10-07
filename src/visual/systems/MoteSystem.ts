import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Points, type ShaderMaterial } from "three";
import { ROLE } from "../config/palettes";
import { FIELD } from "../config/visualConfig";
import { noise1, TAU } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";
import { pointsMaterial } from "../shaders/ShaderManager";

/** Fixed-capacity point cloud with typed-array state; nothing allocated per frame. */
class Cloud {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly pos: Float32Array;
  readonly col: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  // simulation channels
  readonly a: Float32Array;
  readonly b: Float32Array;
  readonly c: Float32Array;
  readonly d: Float32Array;
  readonly z: Float32Array;
  readonly life: Float32Array;
  readonly max: Float32Array;
  readonly fade: Float32Array;
  readonly mode: Uint8Array;
  readonly role: Uint8Array;
  visible = 0;

  constructor(readonly n: number, ctx: EngineContext) {
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.a = new Float32Array(n);
    this.b = new Float32Array(n);
    this.c = new Float32Array(n);
    this.d = new Float32Array(n);
    this.z = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.fade = new Float32Array(n);
    this.mode = new Uint8Array(n);
    this.role = new Uint8Array(n);
    const geo = new BufferGeometry();
    const attr = (arr: Float32Array, size: number) => new BufferAttribute(arr, size).setUsage(DynamicDrawUsage);
    geo.setAttribute("position", attr(this.pos, 3));
    geo.setAttribute("aColor", attr(this.col, 3));
    geo.setAttribute("aSize", attr(this.size, 1));
    geo.setAttribute("aAlpha", attr(this.alpha, 1));
    this.points = new Points(geo, pointsMaterial(ctx.textures.dot));
    this.points.frustumCulled = false;
    this.points.renderOrder = 30;
    ctx.scene.add(this.points);
  }

  commit(): void {
    const g = this.points.geometry;
    for (const k of ["position", "aColor", "aSize", "aAlpha"]) g.getAttribute(k).needsUpdate = true;
  }

  setColor(i: number, hex: number): void {
    this.col[i * 3] = ((hex >> 16) & 255) / 255;
    this.col[i * 3 + 1] = ((hex >> 8) & 255) / 255;
    this.col[i * 3 + 2] = (hex & 255) / 255;
  }

  dispose(): void {
    this.points.parent?.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

const EJECTED = 1;

/**
 * Energy motes orbiting the core in a slightly thick disc (2.5D), pulled in
 * while listening/converging, expelled under CRITICAL; plus a burst pool for
 * flashes and impacts.
 */
export class MoteSystem implements VisualSystem {
  readonly name = "motes";
  private motes!: Cloud;
  private bursts!: Cloud;
  private cursor = 0;

  constructor(private ctx0: EngineContext) {
    this.build(ctx0);
  }

  private build(ctx: EngineContext): void {
    this.motes?.dispose();
    this.bursts?.dispose();
    this.motes = new Cloud(ctx.quality.motes, ctx);
    this.bursts = new Cloud(ctx.quality.burst, ctx);
    for (let i = 0; i < this.motes.n; i++) this.spawn(i, ctx, true);
  }

  setQuality(ctx: EngineContext): void {
    this.build(ctx);
  }

  private spawn(i: number, ctx: EngineContext, initial: boolean): void {
    const m = this.motes;
    const { rng, params } = ctx;
    const rim = !initial && (params.inflow > 0.2 || params.converge > 0.2);
    m.mode[i] = 0;
    m.a[i] = rim ? rng.range(3.8, 5.6) : 0.6 + rng.next() ** 0.8 * 4.6;
    m.b[i] = rng.next() * TAU;
    m.c[i] = (0.25 + rng.next() * 0.9) * (i % 2 === 0 ? 1 : -1) * (1.2 / (0.6 + m.a[i] * 0.4));
    m.z[i] = rng.range(-0.6, 0.6);
    m.d[i] = rng.next() * 1000;
    m.role[i] = (i & 7) === 0 ? ROLE.accent : ROLE.primary;
    m.size[i] = 0.06 + rng.next() * 0.1;
    m.life[i] = 1;
  }

  burst(x: number, y: number, count: number, speed: number, role: number, life = 1.2): void {
    const b = this.bursts;
    const rng = this.ctx0.rng;
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % b.n;
      const a = rng.next() * TAU;
      const s = speed * (0.35 + rng.next() * 0.65);
      b.pos[i * 3] = x;
      b.pos[i * 3 + 1] = y;
      b.pos[i * 3 + 2] = 0.3;
      b.a[i] = Math.cos(a) * s;
      b.b[i] = Math.sin(a) * s;
      b.c[i] = (rng.next() - 0.5) * s * 0.4;
      b.max[i] = b.life[i] = life * (0.5 + rng.next() * 0.5);
      b.size[i] = 0.08 + rng.next() * 0.12;
      b.role[i] = role;
    }
  }

  update(ctx: EngineContext): void {
    this.updateMotes(ctx);
    this.updateBursts(ctx);
  }

  private updateMotes(ctx: EngineContext): void {
    const m = this.motes;
    const { dt, time, params: p, palette, rng, view } = ctx;
    const active = (p.motes * m.n) | 0;
    let vis = 0;
    for (let i = 0; i < m.n; i++) {
      const on = i < active;
      let f = m.fade[i] + (on ? 1 : -1) * dt * 1.2;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      m.fade[i] = f;
      if (f <= 0 && !on) {
        m.alpha[i] = 0;
        continue;
      }
      vis++;
      let r = m.a[i];
      let th = m.b[i];
      if (m.mode[i] === EJECTED) {
        r += m.c[i] * dt;
        m.c[i] *= 1 - dt * 0.6;
        m.life[i] -= dt * 0.9;
        if (m.life[i] <= 0) this.spawn(i, ctx, false);
      } else {
        th += m.c[i] * p.orbit * dt * 1.5;
        r -= (p.inflow * (0.3 + r * 0.22) + p.converge * (0.6 + r * 0.9)) * dt;
        r += noise1(time * 0.7 + m.d[i], i & 3) * p.turbulence * 0.3 * dt;
        if (r < FIELD.coreRadius) this.spawn(i, ctx, false);
        if (p.expel > 0.05 && rng.chance(p.expel * dt * 0.05)) {
          m.mode[i] = EJECTED;
          m.c[i] = rng.range(2.5, 6);
          m.life[i] = 1;
        }
      }
      m.a[i] = r;
      m.b[i] = th;
      m.pos[i * 3] = Math.cos(th) * r;
      m.pos[i * 3 + 1] = Math.sin(th) * r;
      m.pos[i * 3 + 2] = m.z[i] * Math.min(1, r * 0.4);
      const rim = r > 5 ? Math.max(0, 1 - (r - 5) / 1.5) : 1;
      m.alpha[i] = f * (0.55 + 0.45 * Math.sin(time * 3 + m.d[i])) * rim * p.energy;
      m.setColor(i, palette.at(m.role[i], r));
    }
    m.visible = vis;
    m.points.material.uniforms.uPixelRatio.value = view.pixelRatio;
    m.commit();
  }

  private updateBursts(ctx: EngineContext): void {
    const b = this.bursts;
    const { dt, palette, view } = ctx;
    let vis = 0;
    for (let i = 0; i < b.n; i++) {
      if (b.life[i] <= 0) {
        b.alpha[i] = 0;
        continue;
      }
      vis++;
      b.life[i] -= dt;
      const drag = 1 - dt * 1.5;
      b.a[i] *= drag;
      b.b[i] *= drag;
      b.c[i] *= drag;
      b.pos[i * 3] += b.a[i] * dt;
      b.pos[i * 3 + 1] += b.b[i] * dt;
      b.pos[i * 3 + 2] += b.c[i] * dt;
      const k = Math.max(0, b.life[i] / b.max[i]);
      b.alpha[i] = k * k;
      b.setColor(i, palette.at(b.role[i], Math.hypot(b.pos[i * 3], b.pos[i * 3 + 1])));
    }
    b.visible = vis;
    b.points.material.uniforms.uPixelRatio.value = view.pixelRatio;
    b.commit();
  }

  stats() {
    return { particles: this.motes.visible + this.bursts.visible };
  }

  destroy(): void {
    this.motes.dispose();
    this.bursts.dispose();
  }
}
