import { FIELD } from "../config/visualConfig";
import { ROLES, type Palette, type Role, ROLE } from "../config/palettes";
import { easeInOutCubic, mixColor } from "./math";

const BUCKETS = 32;
const ROLE_COUNT = ROLES.length;
const MAX_R = FIELD.waveMax;

/** One leg of a palette wave: front travels to `to` (0..1 of waveMax) in `duration` s, then holds. */
export interface WaveLeg {
  to: number;
  duration: number;
  hold?: number;
}

/**
 * Spatial palette: colors are a function of (role, radius).
 *
 * A state change does not recolor the scene at once — a wavefront travels out
 * from the core and elements recolor as it passes them. Multi-leg waves give
 * the "first pulse transforms some segments, next pulse transforms the rest"
 * behaviour. Colors are resolved once per frame into a small LUT, so per
 * element lookups cost one array read.
 */
export class PaletteField {
  private from: Palette;
  private to: Palette;
  private legs: WaveLeg[] = [];
  private legIndex = 0;
  private legTime = 0;
  private legStart = 1;
  /** Wave front, 0..1 of waveMax. 1 = transition complete. */
  front = 1;
  readonly width = 0.16;
  private lut = new Uint32Array(ROLE_COUNT * BUCKETS);

  constructor(initial: Palette) {
    this.from = { ...initial };
    this.to = { ...initial };
    this.bake();
  }

  get transitioning(): boolean {
    return this.front < 1;
  }

  /** Radius (reference units) of the visible wavefront, or -1 when idle. */
  get frontRadius(): number {
    return this.front < 1 ? this.front * MAX_R : -1;
  }

  start(next: Palette, legs: WaveLeg[] = [{ to: 1, duration: 0.85 }]): void {
    // Freeze whatever is currently on screen (sampled mid-field) as the origin.
    const midBucket = Math.floor(BUCKETS * 0.3);
    const snap = {} as Palette;
    for (let r = 0; r < ROLE_COUNT; r++) snap[ROLES[r]] = this.lut[r * BUCKETS + midBucket];
    this.from = snap;
    this.to = { ...next };
    this.legs = legs;
    this.legIndex = 0;
    this.legTime = 0;
    this.legStart = 0;
    this.front = 0;
  }

  update(dt: number): void {
    if (this.front < 1 && this.legs.length) {
      const leg = this.legs[this.legIndex];
      this.legTime += dt;
      const t = Math.min(1, this.legTime / leg.duration);
      this.front = this.legStart + (leg.to - this.legStart) * easeInOutCubic(t);
      if (this.legTime >= leg.duration + (leg.hold ?? 0)) {
        this.legStart = leg.to;
        this.legIndex++;
        this.legTime = 0;
        if (this.legIndex >= this.legs.length) this.front = 1;
      }
    }
    this.bake();
  }

  private bake(): void {
    const frontR = this.front >= 1 ? Infinity : this.front * (1 + this.width);
    for (let r = 0; r < ROLE_COUNT; r++) {
      const role = ROLES[r];
      const a = this.from[role];
      const b = this.to[role];
      const base = r * BUCKETS;
      for (let i = 0; i < BUCKETS; i++) {
        const x = i / (BUCKETS - 1);
        const t = frontR === Infinity ? 1 : Math.min(1, Math.max(0, (frontR - x) / this.width));
        this.lut[base + i] = mixColor(a, b, t);
      }
    }
  }

  /** Color of `role` at radius `r` (reference units). */
  at(role: number, r: number): number {
    let i = ((r < 0 ? -r : r) / MAX_R) * (BUCKETS - 1);
    i = i >= BUCKETS - 1 ? BUCKETS - 1 : i | 0;
    return this.lut[role * BUCKETS + i];
  }

  /** Color of `role` at the core. */
  core(role: number): number {
    return this.lut[role * BUCKETS];
  }

  /** Target palette color (ignores the wave). */
  target(role: Role): number {
    return this.to[role];
  }
}

export { ROLE };
