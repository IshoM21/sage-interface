import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type ShaderMaterial } from "three";
import { ROLE } from "../config/palettes";
import { circlePoints, disposeLine, makeLine, polygonPoints, setProgress, type SageLine } from "../core/lines";
import { clamp, easeInOutCubic, Rng, smoothstep, TAU } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";
import { scriptMaterial } from "../shaders/ShaderManager";

export const MILESTONE_DURATION = 5.6;
export const MILESTONE_RELEASE = 1.9;

/**
 * MILESTONE / SKILL ACQUIRED — the rare "ultimate" ceremony, in gold:
 * an ornate script ring is written around the core, a dodecagon and a double
 * rhombus are inscribed, fine rays fan out; at the release a flash and double
 * wave fire, light falls, and the seal dissolves outward.
 */
export class MilestoneSystem implements VisualSystem {
  readonly name = "milestone";
  private root = new Group();
  private ring: Mesh<PlaneGeometry, ShaderMaterial>;
  private dodeca: SageLine;
  private rhombA: SageLine;
  private rhombB: SageLine;
  private halo: SageLine;
  private rays: Mesh<BufferGeometry, MeshBasicMaterial>;
  private t = -1;
  private released = false;

  constructor(ctx: EngineContext) {
    const R = 4.25;
    this.ring = new Mesh(new PlaneGeometry(R * 2, R * 2), scriptMaterial(ctx.textures.scriptOrnate));
    this.ring.frustumCulled = false;
    this.dodeca = makeLine(polygonPoints(1.05, 12, Math.PI / 2, 6), 3);
    this.halo = makeLine(circlePoints(1.35, 128), 1.2);
    this.rhombA = makeLine(polygonPoints(2.75, 4, Math.PI / 2, 24), 3.2);
    this.rhombB = makeLine(polygonPoints(2.55, 4, Math.PI / 2, 24), 1.2);

    // Fine rays: thin triangles from the centre, faded by vertex colour.
    const rng = new Rng(77);
    const N = 90;
    const pos = new Float32Array(N * 9);
    const col = new Float32Array(N * 9);
    for (let i = 0; i < N; i++) {
      const a = rng.next() * TAU;
      const len = rng.range(4, 11);
      const w = rng.range(0.004, 0.018);
      const c = Math.cos(a), s = Math.sin(a);
      pos.set([-s * w, c * w, 0, s * w, -c * w, 0, c * len, s * len, 0], i * 9);
      const k = rng.range(0.4, 1);
      col.set([k, k, k, k, k, k, 0, 0, 0], i * 9);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("color", new BufferAttribute(col, 3));
    this.rays = new Mesh(
      g,
      new MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending }),
    );
    this.rays.frustumCulled = false;

    this.root.add(this.rays, this.ring, this.halo.line, this.dodeca.line, this.rhombA.line, this.rhombB.line);
    this.root.visible = false;
    this.root.renderOrder = 50;
    ctx.scene.add(this.root);
  }

  get playing(): boolean {
    return this.t >= 0;
  }

  play(): void {
    this.t = 0;
    this.released = false;
    this.root.visible = true;
  }

  update(ctx: EngineContext): void {
    if (this.t < 0) return;
    const { dt, palette, bus } = ctx;
    this.t += dt;
    const t = this.t;
    if (t >= MILESTONE_DURATION) {
      this.t = -1;
      this.root.visible = false;
      return;
    }
    if (!this.released && t >= MILESTONE_RELEASE) {
      this.released = true;
      bus.flash(1.1, ROLE.core);
      bus.shockwave({ speed: 9, width: 0.3, strength: 1, distort: 1, role: ROLE.core });
      bus.shockwave({ speed: 5.5, width: 0.15, strength: 0.6, distort: 0.3, role: ROLE.accent });
      bus.burst(0, 0, 220, 7, ROLE.accent, 1.8);
    }
    const out = smoothstep(MILESTONE_DURATION - 1.1, MILESTONE_DURATION, t);
    const a = 1 - out;
    const boost = this.released ? Math.max(0, 1 - (t - MILESTONE_RELEASE) * 1.4) : 0;
    this.root.scale.setScalar(1 + easeInOutCubic(out) * 0.25);
    this.root.rotation.z = this.released ? (t - MILESTONE_RELEASE) * 0.05 : 0;

    const gold = palette.core(ROLE.primary);
    const light = palette.core(ROLE.accent);
    const core = palette.core(ROLE.core);

    const ru = this.ring.material.uniforms;
    ru.uReveal.value = easeInOutCubic(clamp((t - 0.3) / 1.3));
    ru.uOpacity.value = a * (0.85 + boost * 0.4);
    ru.uColor.value.setHex(gold);
    this.ring.rotation.z = -t * 0.06;

    setProgress(this.halo, easeInOutCubic(clamp((t - 0.4) / 0.8)));
    setProgress(this.dodeca, easeInOutCubic(clamp((t - 0.7) / 0.9)));
    setProgress(this.rhombA, easeInOutCubic(clamp((t - 1.1) / 0.6)));
    setProgress(this.rhombB, easeInOutCubic(clamp((t - 1.25) / 0.6)));
    this.halo.material.color.setHex(light);
    this.halo.material.opacity = a * 0.7;
    this.dodeca.material.color.setHex(core);
    this.dodeca.material.opacity = a * (0.9 + boost);
    for (const r of [this.rhombA, this.rhombB]) {
      r.material.color.setHex(gold);
      r.material.opacity = a * (0.85 + boost * 0.5);
    }
    // Rays fan in before the release and flare at it.
    this.rays.material.color.setHex(gold);
    this.rays.material.opacity = a * (smoothstep(0.2, 1.4, t) * 0.55 + boost * 0.6);
    this.rays.rotation.z = t * 0.03;
  }

  destroy(): void {
    this.root.parent?.remove(this.root);
    for (const l of [this.dodeca, this.rhombA, this.rhombB, this.halo]) disposeLine(l);
    this.ring.geometry.dispose();
    this.ring.material.dispose();
    this.rays.geometry.dispose();
    this.rays.material.dispose();
  }
}
