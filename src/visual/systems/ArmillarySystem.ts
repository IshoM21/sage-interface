import { AdditiveBlending, CylinderGeometry, DoubleSide, Euler, Group, Mesh, MeshBasicMaterial, Quaternion } from "three";
import type { SageState } from "../../machine/events";
import { ROLE } from "../config/palettes";
import { ARMILLARY } from "../config/visualConfig";
import { easeOutBack, hash1, lerp, noise1 } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";

interface Band {
  def: (typeof ARMILLARY)[number];
  pivot: Group;
  mesh: Mesh<CylinderGeometry, MeshBasicMaterial>;
  spin: number;
  stepFrom: number;
  stepTo: number;
  stepT: number;
  stepTimer: number;
  step: number;
  seed: number;
}

const tiltQ = new Quaternion();
const alignQ = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0));
const tmpE = new Euler();

/**
 * Armillary sphere: thick luminous ribbons on independent tilted axes around
 * the core (plus an octagonal frame). Thought = free rotation on all axes;
 * action = mechanical angular steps; resolution = all bands swing into one
 * plane facing the viewer (perfect concentric symmetry).
 */
export class ArmillarySystem implements VisualSystem {
  readonly name = "armillary";
  private root = new Group();
  private bands: Band[] = [];
  private kick = 0;

  constructor(ctx: EngineContext) {
    ARMILLARY.forEach((def, i) => {
      const octagon = def.sides === 8;
      const geo = new CylinderGeometry(def.r, def.r, def.h, def.sides, 1, true);
      const map = (octagon ? ctx.textures.bandSolid : ctx.textures.band).clone();
      map.needsUpdate = true;
      map.repeat.x = octagon ? 8 : 2 + i;
      const mat = new MeshBasicMaterial({
        map, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, depthTest: false, blending: AdditiveBlending,
      });
      const mesh = new Mesh(geo, mat);
      const pivot = new Group();
      pivot.add(mesh);
      this.root.add(pivot);
      this.bands.push({ def, pivot, mesh, spin: hash1(i) * 6, stepFrom: 0, stepTo: 0, stepT: 1, stepTimer: 0, step: 0, seed: i * 3.3 });
    });
    ctx.scene.add(this.root);
  }

  onStateChange(_from: SageState, to: SageState): void {
    if (to === "EXECUTING") for (const b of this.bands) b.stepTimer = hash1(b.seed * 10) * 0.4;
  }

  /** Called on WARNING/CRITICAL pulses. */
  pulse(strength: number): void {
    this.kick = Math.max(this.kick, strength);
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, time, palette } = ctx;
    const vis = p.armillary * Math.min(1.2, p.energy);
    this.root.visible = vis > 0.004;
    if (!this.root.visible) return;
    this.kick = Math.max(0, this.kick - dt * 2.5);

    for (const b of this.bands) {
      const d = b.def;
      // Continuous spin around the band's own axis.
      b.spin += dt * d.speed * p.armSpeed * 2.2 * (1 - 0.8 * p.armStep);
      // Mechanical steps (EXECUTING).
      if (p.armStep > 0.5) {
        b.stepTimer -= dt;
        if (b.stepTimer <= 0 && b.stepT >= 1) {
          b.stepTimer = 0.35 + hash1(((time * 5) | 0) + b.seed * 13) * 0.8;
          b.stepFrom = b.step;
          b.stepTo = b.step + (Math.PI / 4) * Math.sign(d.speed);
          b.stepT = 0;
        }
      }
      if (b.stepT < 1) {
        b.stepT = Math.min(1, b.stepT + dt / 0.32);
        b.step = b.stepFrom + (b.stepTo - b.stepFrom) * easeOutBack(b.stepT);
      }

      // Tilt: own axes, wobbling under WARNING, aligning to the view plane on COMPLETE.
      const jit = p.armJitter * 0.18 + this.kick * 0.25;
      tmpE.set(
        d.tiltX + time * 0.07 * Math.sign(d.speed) * p.armSpeed + noise1(time * 1.7 + b.seed, 1) * jit,
        d.tiltY + time * 0.05 * p.armSpeed + noise1(time * 1.3 + b.seed, 2) * jit,
        0,
      );
      tiltQ.setFromEuler(tmpE);
      if (p.armAlign > 0.001) tiltQ.slerp(alignQ, p.armAlign);
      b.pivot.quaternion.copy(tiltQ);
      b.mesh.rotation.y = b.spin + b.step;

      // CRITICAL: bands slip off-centre and flicker.
      const frag = p.fragment;
      if (frag > 0.01) {
        b.pivot.position.set(noise1(time * 2 + b.seed, 7) * 0.3 * frag, noise1(time * 2.3 + b.seed, 8) * 0.3 * frag, 0);
        b.pivot.scale.setScalar(1 + noise1(time * 4 + b.seed, 3) * 0.06 * frag);
      } else if (b.pivot.position.x !== 0) {
        b.pivot.position.set(0, 0, 0);
        b.pivot.scale.setScalar(1);
      }
      const flick = frag > 0.3 && noise1(time * 9 + b.seed, 4) > 0.5 ? 0.25 : 1;
      const alignBoost = lerp(1, 1.3, p.armAlign);
      b.mesh.material.opacity = Math.min(1, vis * (d.sides === 8 ? 0.7 : 1.15) * flick * alignBoost);
      b.mesh.material.color.setHex(palette.at(d.sides === 8 ? ROLE.secondary : ROLE.accent, d.r));
    }
  }

  stats() {
    return { objects: this.bands.length };
  }

  destroy(): void {
    this.root.parent?.remove(this.root);
    for (const b of this.bands) {
      b.mesh.geometry.dispose();
      b.mesh.material.map?.dispose();
      b.mesh.material.dispose();
    }
  }
}
