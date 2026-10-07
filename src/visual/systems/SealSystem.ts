import { Group, Mesh, PlaneGeometry, type ShaderMaterial } from "three";
import { ROLE } from "../config/palettes";
import { SEAL } from "../config/visualConfig";
import { circlePoints, disposeLine, makeLine, polygonPoints, setProgress, type SageLine } from "../core/lines";
import { damp, easeOutBack, noise1, smoothstep, TAU } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";
import { scriptMaterial } from "../shaders/ShaderManager";

interface Stage {
  l: SageLine;
  /** Window of `unfold` during which this element is written. */
  from: number;
  to: number;
  role: number;
  r: number;
  alpha: number;
  seed: number;
}

/**
 * The seal: everything starts as a thin double square tilted in space (the
 * seed). As the agent engages, the seal is *written* — outer circle, rhombus,
 * inner circle, vertex rings — and a band of original script is inscribed
 * around it. The whole plane sways in 3D; CRITICAL breaks it apart.
 */
export class SealSystem implements VisualSystem {
  readonly name = "seal";
  readonly group = new Group();
  private seedA: SageLine;
  private seedB: SageLine;
  private stages: Stage[] = [];
  private script: Mesh<PlaneGeometry, ShaderMaterial>;
  private seedP = 0;
  private reveal = 0;
  private spin = 0;
  /** Countdown line around the seal (dangerous decision). */
  private countdown: SageLine;
  private countT = 0;
  private stepTimer = 0;
  private step = { from: 0, to: 0, t: 1 };

  constructor(ctx: EngineContext) {
    const s = SEAL.seedSquare;
    this.seedA = makeLine(polygonPoints(s, 4, Math.PI / 4, 16), 1.6);
    this.seedB = makeLine(polygonPoints(s * 0.84, 4, Math.PI / 4 + 0.14, 16), 1.1);
    this.group.add(this.seedA.line, this.seedB.line);

    const add = (l: SageLine, from: number, to: number, role: number, r: number, alpha: number) => {
      this.group.add(l.line);
      this.stages.push({ l, from, to, role, r, alpha, seed: this.stages.length * 1.7 });
    };
    add(makeLine(circlePoints(SEAL.circle, 160), 1.4), 0, 0.55, ROLE.primary, SEAL.circle, 0.9);
    add(makeLine(circlePoints(SEAL.circle + 0.12, 160, -Math.PI / 2), 0.8), 0.15, 0.7, ROLE.secondary, SEAL.circle, 0.5);
    add(makeLine(polygonPoints(SEAL.rhombus, 4, Math.PI / 2, 24), 2.4), 0.25, 0.8, ROLE.accent, SEAL.rhombus, 1);
    add(makeLine(polygonPoints(SEAL.rhombus * 0.93, 4, Math.PI / 2, 24), 1), 0.32, 0.86, ROLE.primary, SEAL.rhombus, 0.7);
    add(makeLine(circlePoints(SEAL.innerCircle, 96), 1.2), 0.45, 0.95, ROLE.primary, SEAL.innerCircle, 0.8);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 2;
      const pts = circlePoints(0.16, 32).map((v, k) => (k % 3 === 0 ? v + Math.cos(a) * SEAL.rhombus : k % 3 === 1 ? v + Math.sin(a) * SEAL.rhombus : v));
      add(makeLine(pts, 1.2), 0.7 + i * 0.05, 0.9 + i * 0.025, ROLE.accent, SEAL.rhombus, 0.9);
    }

    const size = SEAL.scriptOuter * 2 / 0.985;
    this.script = new Mesh(new PlaneGeometry(size, size), scriptMaterial(ctx.textures.script));
    this.script.frustumCulled = false;
    this.group.add(this.script);
    this.countdown = makeLine(circlePoints(SEAL.circle + 0.32, 200), 2.2);
    this.group.add(this.countdown.line);
    setProgress(this.countdown, 0);
    ctx.scene.add(this.group);
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, time, palette } = ctx;
    const e = Math.min(1.2, p.energy);

    // 3D sway: the seal is a plane floating in space, not a flat overlay.
    const tilt = p.sealTilt;
    this.group.rotation.x = Math.sin(time * 0.13) * 0.55 * tilt + ctx.pointer.y * 0.05;
    this.group.rotation.y = Math.sin(time * 0.1 + 1.3) * 0.7 * tilt - ctx.pointer.x * 0.05;

    // Seed: written in at start, slowly turning.
    this.seedP = damp(this.seedP, p.seed > 0.02 ? 1 : 0, 1.1, dt);
    setProgress(this.seedA, this.seedP);
    setProgress(this.seedB, smoothstep(0.25, 1, this.seedP));
    this.spin += dt * (0.05 + p.armSpeed * 0.1);
    this.seedA.line.rotation.z = this.spin;
    this.seedB.line.rotation.z = -this.spin * 0.6;
    const seedColor = palette.at(ROLE.accent, 1);
    this.seedA.material.color.setHex(seedColor);
    this.seedB.material.color.setHex(palette.at(ROLE.primary, 1));
    this.seedA.material.opacity = p.seed * e;
    this.seedB.material.opacity = p.seed * e * 0.7;

    // Constructed elements, each written within its own window of `unfold`.
    const frag = p.fragment;
    for (const st of this.stages) {
      const k = smoothstep(st.from, st.to, p.unfold);
      setProgress(st.l, k);
      st.l.material.color.setHex(palette.at(st.role, st.r));
      let flicker = 1;
      if (frag > 0.01) {
        const n = noise1(time * 3 + st.seed, 4);
        st.l.line.position.set(n * 0.25 * frag, noise1(time * 2.6 + st.seed, 9) * 0.25 * frag, noise1(time + st.seed, 2) * frag);
        st.l.line.rotation.z = noise1(time * 0.7 + st.seed, 5) * 0.12 * frag;
        flicker = n > 0.55 ? 0.15 : 1;
      } else if (st.l.line.position.x !== 0) {
        st.l.line.position.set(0, 0, 0);
        st.l.line.rotation.z = 0;
      }
      st.l.material.opacity = st.alpha * e * flicker;
    }

    // Script band, inscribed around the circle and turning.
    this.reveal = damp(this.reveal, p.script > 0.03 ? 1 : 0, 0.9, dt);
    const u = this.script.material.uniforms;
    u.uReveal.value = this.reveal;
    u.uOpacity.value = p.script * e * 0.85;
    u.uColor.value.setHex(palette.at(ROLE.primary, SEAL.scriptOuter));
    // Mechanical lock: the script ring stops gliding and turns in heavy steps.
    if (p.scriptStep > 0.5) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && this.step.t >= 1) {
        this.stepTimer = 1.35;
        this.step = { from: this.script.rotation.z, to: this.script.rotation.z - TAU / 36, t: 0 };
        ctx.bus.cue({ type: "gear", heavy: true });
      }
    } else {
      this.stepTimer = 0.5;
      this.script.rotation.z += dt * p.scriptSpeed;
    }
    if (this.step.t < 1) {
      this.step.t = Math.min(1, this.step.t + dt / 0.45);
      this.script.rotation.z = this.step.from + (this.step.to - this.step.from) * easeOutBack(this.step.t);
    }

    // Countdown: an amber line traces the seal while the decision is pending.
    if (p.countdown > 0.01) {
      this.countT += dt;
      setProgress(this.countdown, Math.min(1, this.countT / 24));
      this.countdown.material.color.setHex(palette.at(ROLE.accent, SEAL.circle));
      this.countdown.material.opacity = p.countdown * (0.75 + 0.25 * Math.sin(time * 3));
    } else if (this.countT !== 0) {
      this.countT = 0;
      setProgress(this.countdown, 0);
    }
    this.script.visible = u.uOpacity.value > 0.003 && this.reveal > 0.002;
  }

  stats() {
    return { objects: this.stages.length + 3 };
  }

  destroy(): void {
    this.group.parent?.remove(this.group);
    for (const l of [this.seedA, this.seedB, this.countdown, ...this.stages.map((s) => s.l)]) disposeLine(l);
    this.script.geometry.dispose();
    this.script.material.dispose();
  }
}
