import { AdditiveBlending, Mesh, MeshBasicMaterial, RingGeometry } from "three";
import type { SageState } from "../../machine/events";
import { ROLE } from "../config/palettes";
import { FIELD } from "../config/visualConfig";
import type { EngineContext, VisualSystem } from "../core/types";

interface Wave {
  mesh: Mesh<RingGeometry, MeshBasicMaterial>;
  alive: boolean;
  r: number;
  speed: number;
  width: number;
  life: number;
  max: number;
  strength: number;
  distort: number;
  role: number;
}

const POOL = 8;

/**
 * Radial waves (state pulses, flashes, completion). The strongest one also
 * drives the composite shader's refraction ring.
 */
export class ShockwaveSystem implements VisualSystem {
  readonly name = "shockwaves";
  private waves: Wave[] = [];
  private pulseAcc = 0;
  private geo = new RingGeometry(0.985, 1, 192);
  readonly strongest = { r: -1, amount: 0, width: 0.3 };
  onPulse: ((strength: number) => void) | null = null;

  constructor(ctx: EngineContext) {
    for (let i = 0; i < POOL; i++) {
      const mesh = new Mesh(
        this.geo,
        new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: AdditiveBlending }),
      );
      mesh.visible = false;
      mesh.renderOrder = 40;
      ctx.scene.add(mesh);
      this.waves.push({ mesh, alive: false, r: 0, speed: 0, width: 0, life: 0, max: 1, strength: 0, distort: 0, role: 0 });
    }
  }

  spawn(o: { speed?: number; width?: number; strength?: number; role?: number; distort?: number }): void {
    let w = this.waves.find((x) => !x.alive);
    if (!w) w = this.waves.reduce((a, b) => (a.life < b.life ? a : b));
    w.alive = true;
    w.r = FIELD.coreRadius;
    w.speed = o.speed ?? 6;
    w.width = o.width ?? 0.15;
    w.strength = o.strength ?? 0.6;
    w.distort = o.distort ?? 0.4;
    w.role = o.role ?? ROLE.primary;
    w.max = w.life = (FIELD.waveMax - w.r) / w.speed;
  }

  onStateChange(_from: SageState, _to: SageState): void {
    this.pulseAcc = 0.6;
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, palette } = ctx;
    if (p.pulseRate > 0.02) {
      this.pulseAcc += dt * p.pulseRate;
      if (this.pulseAcc >= 1) {
        this.pulseAcc = 0;
        this.spawn({ speed: 5 + 2.5 * p.pulseStrength, width: 0.12 + 0.15 * p.pulseStrength, strength: p.pulseStrength, distort: 0.25 + 0.4 * p.glitch });
        this.onPulse?.(p.pulseStrength);
      }
    }
    let bestR = -1, bestA = 0, bestW = 0.3;
    for (const w of this.waves) {
      if (!w.alive) continue;
      w.life -= dt;
      w.r += w.speed * dt;
      if (w.life <= 0) {
        w.alive = false;
        w.mesh.visible = false;
        continue;
      }
      const k = w.life / w.max;
      const env = k * k;
      w.mesh.visible = true;
      w.mesh.scale.setScalar(w.r);
      w.mesh.material.opacity = env * w.strength * p.energy;
      w.mesh.material.color.setHex(palette.at(w.role, w.r));
      const amount = env * w.distort;
      if (amount > bestA) {
        bestA = amount;
        bestR = w.r;
        bestW = w.width;
      }
    }
    this.strongest.r = bestR;
    this.strongest.amount = bestA;
    this.strongest.width = bestW;
  }

  destroy(): void {
    for (const w of this.waves) {
      w.mesh.parent?.remove(w.mesh);
      w.mesh.material.dispose();
    }
    this.geo.dispose();
  }
}
