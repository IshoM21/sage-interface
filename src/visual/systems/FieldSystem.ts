import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  Quaternion,
  Vector3,
  type ShaderMaterial,
} from "three";
import { ROLE } from "../config/palettes";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Rng, TAU } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";
import { pointsMaterial } from "../shaders/ShaderManager";

const Z_FAR = -42;
const Z_NEAR = 7;

/** Shard textures: a soft-edged solid chip and a thin outlined frame. */
function shardTexture(outline: boolean): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 96;
  const g = c.getContext("2d")!;
  if (outline) {
    g.strokeStyle = "#fff";
    g.lineWidth = 6;
    g.strokeRect(5, 5, 118, 86);
  } else {
    const grad = g.createLinearGradient(0, 0, 128, 96);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0.65)");
    g.fillStyle = grad;
    g.fillRect(6, 6, 116, 84);
    // Faint inner "data" lines, like the show's panels.
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 4; i++) g.fillRect(16, 20 + i * 16, 40 + ((i * 37) % 60), 4);
  }
  const t = new CanvasTexture(c);
  t.generateMipmaps = true;
  return t;
}

interface Shard {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  vr: Vector3;
  size: number;
  aspect: number;
  bright: number;
}

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const pos = new Vector3();
const scl = new Vector3();
const col = new Color();

/**
 * Background fill, after the show's analysis scenes (S1E1 ~9:21–10:18,
 * S2E11 ~12:33): floating data shards (solid chips and outlined frames)
 * tumbling toward the camera through depth, near out-of-focus bokeh dust,
 * and a network of long beaded light-lines and wide orbit arcs crossing the
 * whole frame. Density/speed per state via params.shards/shardSpeed/network.
 */
export class FieldSystem implements VisualSystem {
  readonly name = "field";
  private solid!: InstancedMesh<PlaneGeometry, MeshBasicMaterial>;
  private frames!: InstancedMesh<PlaneGeometry, MeshBasicMaterial>;
  private shards: Shard[] = [];
  private bokeh!: Points<BufferGeometry, ShaderMaterial>;
  private bokehPos!: Float32Array;
  private network = new Group();
  /** All network lines / arcs batched into two draw calls. */
  private lines: LineSegments2 | null = null;
  private arcs: LineSegments2 | null = null;
  private geo = new PlaneGeometry(1, 1);
  private texSolid = shardTexture(false);
  private texFrame = shardTexture(true);
  private rng = new Rng(0x5ead);

  constructor(private ctx0: EngineContext) {
    this.build(ctx0);
  }

  private build(ctx: EngineContext): void {
    this.dispose();
    const n = ctx.quality.shards;
    const mat = (map: CanvasTexture) =>
      new MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending });
    this.solid = new InstancedMesh(this.geo, mat(this.texSolid), Math.ceil(n * 0.6));
    this.frames = new InstancedMesh(this.geo, mat(this.texFrame), Math.floor(n * 0.4));
    for (const im of [this.solid, this.frames]) {
      im.instanceMatrix.setUsage(DynamicDrawUsage);
      im.frustumCulled = false;
      im.renderOrder = -44;
      // Ensure the instanceColor buffer exists (brightness = fade, additive).
      im.setColorAt(0, col.set(0));
      ctx.scene.add(im);
    }
    this.shards = [];
    for (let i = 0; i < n; i++) this.shards.push(this.spawn({} as Shard, true));

    // Near bokeh dust.
    const b = ctx.quality.bokeh;
    this.bokehPos = new Float32Array(b * 3);
    const colA = new Float32Array(b * 3).fill(1);
    const size = new Float32Array(b);
    const alpha = new Float32Array(b);
    for (let i = 0; i < b; i++) {
      this.bokehPos[i * 3] = this.rng.range(-14, 14);
      this.bokehPos[i * 3 + 1] = this.rng.range(-8, 8);
      this.bokehPos[i * 3 + 2] = this.rng.range(Z_FAR * 0.5, 5);
      size[i] = this.rng.range(0.5, 2.6);
      alpha[i] = this.rng.range(0.15, 0.6);
    }
    const bg = new BufferGeometry();
    bg.setAttribute("position", new BufferAttribute(this.bokehPos, 3).setUsage(DynamicDrawUsage));
    bg.setAttribute("aColor", new BufferAttribute(colA, 3));
    bg.setAttribute("aSize", new BufferAttribute(size, 1));
    bg.setAttribute("aAlpha", new BufferAttribute(alpha, 1));
    this.bokeh = new Points(bg, pointsMaterial(ctx.textures.dot));
    this.bokeh.material.uniforms.uTwinkle.value = 0.4;
    this.bokeh.frustumCulled = false;
    this.bokeh.renderOrder = -43;
    ctx.scene.add(this.bokeh);

    // Beaded light-line network: long lines converging near the core, plus wide arcs.
    const lineSegs: number[] = [];
    for (let i = 0; i < ctx.quality.networkLines; i++) {
      const a = this.rng.next() * TAU;
      const off = this.rng.range(-1.2, 1.2);
      const len = this.rng.range(14, 26);
      const z = this.rng.range(-9, -2);
      const nx = -Math.sin(a), ny = Math.cos(a);
      lineSegs.push(
        Math.cos(a) * len + nx * off, Math.sin(a) * len + ny * off, z,
        -Math.cos(a) * len * 0.15 + nx * off, -Math.sin(a) * len * 0.15 + ny * off, z,
      );
    }
    const arcSegs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const rx = this.rng.range(7, 13);
      const ry = rx * this.rng.range(0.25, 0.55);
      const rot = this.rng.next() * Math.PI;
      const z = this.rng.range(-10, -3);
      const pt = (t: number) => {
        const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
        return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot), z];
      };
      for (let k = 0; k < 160; k++) arcSegs.push(...pt((k / 160) * TAU), ...pt(((k + 1) / 160) * TAU));
    }
    const batch = (segs: number[], width: number, dash: number, gap: number) => {
      const g = new LineSegmentsGeometry();
      g.setPositions(segs);
      const m = new LineMaterial({
        color: 0xffffff, linewidth: width * ctx.view.pixelRatio, transparent: true, depthTest: false, depthWrite: false,
        blending: AdditiveBlending, dashed: true, dashSize: dash, gapSize: gap,
      });
      m.resolution.set(ctx.view.width * ctx.view.pixelRatio, ctx.view.height * ctx.view.pixelRatio);
      const l = new LineSegments2(g, m);
      l.computeLineDistances();
      l.frustumCulled = false;
      l.renderOrder = -42;
      this.network.add(l);
      return l;
    };
    this.lines = batch(lineSegs, 1.3, 0.08, 0.11);
    this.arcs = batch(arcSegs, 1.6, 0.08, 0.1);
    ctx.scene.add(this.network);
  }

  private spawn(s: Shard, initial: boolean): Shard {
    const r = this.rng;
    // Wide spread; fewer right on the axis so the seal stays readable.
    let x = r.range(-16, 16);
    const y = r.range(-9, 9);
    if (Math.abs(x) < 2.5 && Math.abs(y) < 2.5) x += Math.sign(x || 1) * 3;
    s.x = x;
    s.y = y;
    s.z = initial ? r.range(Z_FAR, Z_NEAR) : Z_FAR;
    s.rx = r.next() * TAU;
    s.ry = r.next() * TAU;
    s.rz = r.next() * TAU;
    s.vr = new Vector3(r.range(-1, 1), r.range(-1, 1), r.range(-0.6, 0.6));
    s.size = r.range(0.08, 0.42) * (r.next() < 0.1 ? 2.2 : 1);
    s.aspect = r.range(0.5, 1.4);
    s.bright = r.range(0.35, 1);
    return s;
  }

  setQuality(ctx: EngineContext): void {
    this.build(ctx);
  }

  resize(ctx: EngineContext): void {
    const { width, height, pixelRatio } = ctx.view;
    for (const [l, w] of [[this.lines, 1.3], [this.arcs, 1.6]] as const) {
      if (!l) continue;
      l.material.resolution.set(width * pixelRatio, height * pixelRatio);
      l.material.linewidth = w * pixelRatio;
    }
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, time, palette, view } = ctx;
    const vis = Math.min(1.2, p.energy);
    const speed = p.shardSpeed * 9 + 0.3 * p.shards;
    const base = palette.at(ROLE.accent, 5);
    const nSolid = this.solid.count;
    let iS = 0, iF = 0;
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i];
      s.z += dt * speed;
      s.rx += s.vr.x * dt * (0.4 + p.shardSpeed);
      s.ry += s.vr.y * dt * (0.4 + p.shardSpeed);
      s.rz += s.vr.z * dt * (0.4 + p.shardSpeed);
      if (s.z > Z_NEAR) this.spawn(s, false);
      // Density: only the first fraction of the pool is visible.
      const on = i / this.shards.length < p.shards;
      const depthFade = Math.min(1, (s.z - Z_FAR) / 10) * Math.min(1, (Z_NEAR - s.z) / 3);
      const k = on ? depthFade * s.bright * 0.75 * vis : 0;
      pos.set(s.x, s.y, s.z);
      q.setFromEuler(e.set(s.rx, s.ry, s.rz));
      scl.set(s.size * s.aspect, s.size, 1);
      m4.compose(pos, q, scl);
      col.setHex(base).multiplyScalar(k);
      if (iS < nSolid && i % 5 < 3) {
        this.solid.setMatrixAt(iS, m4);
        this.solid.setColorAt(iS++, col);
      } else if (iF < this.frames.count) {
        this.frames.setMatrixAt(iF, m4);
        this.frames.setColorAt(iF++, col);
      }
    }
    for (const im of [this.solid, this.frames]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    // Bokeh drifts toward the camera too, slower (parallax depth).
    const bp = this.bokehPos;
    for (let i = 0; i < bp.length; i += 3) {
      bp[i + 2] += dt * speed * 0.45;
      if (bp[i + 2] > 6) bp[i + 2] = Z_FAR * 0.5;
    }
    this.bokeh.geometry.getAttribute("position").needsUpdate = true;
    const bu = this.bokeh.material.uniforms;
    bu.uTime.value = time;
    bu.uPixelRatio.value = view.pixelRatio;
    bu.uOpacity.value = (0.25 + 0.75 * p.shards) * vis;

    // Network: slow rotation, beads crawl along the lines.
    this.network.visible = p.network > 0.01;
    if (this.network.visible) {
      this.network.rotation.z += dt * 0.012 * (0.3 + p.shardSpeed);
      const lc = palette.at(ROLE.secondary, 6);
      const crawl = time * (0.15 + p.shardSpeed * 0.5);
      for (const [l, op, dir] of [[this.lines, 0.35, -1], [this.arcs, 0.28, 0.5]] as const) {
        if (!l) continue;
        l.material.color.setHex(lc);
        l.material.opacity = p.network * op * vis;
        l.material.dashOffset = crawl * dir;
      }
    }
  }

  private dispose(): void {
    const scene = this.ctx0.scene;
    for (const im of [this.solid, this.frames]) {
      if (!im) continue;
      scene.remove(im);
      im.material.dispose();
      im.dispose();
    }
    if (this.bokeh) {
      scene.remove(this.bokeh);
      this.bokeh.geometry.dispose();
      this.bokeh.material.dispose();
    }
    for (const l of [this.lines, this.arcs]) {
      if (!l) continue;
      this.network.remove(l);
      l.geometry.dispose();
      l.material.dispose();
    }
    this.lines = this.arcs = null;
    scene.remove(this.network);
  }

  stats() {
    return { particles: this.shards.length + this.bokehPos.length / 3 };
  }

  destroy(): void {
    this.dispose();
    this.geo.dispose();
    this.texSolid.dispose();
    this.texFrame.dispose();
  }
}
