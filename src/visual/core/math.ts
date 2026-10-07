/** Allocation-free math helpers used by every system in the hot path. */

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/** Shortest signed angular distance a→b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

/** Deterministic fast PRNG (mulberry32). Avoids Math.random() in hot loops. */
export class Rng {
  private s: number;
  constructor(seed = 0x5a6e) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(n: number): number {
    return (this.next() * n) | 0;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[(this.next() * arr.length) | 0];
  }
}

/** Integer hash → [0,1). Used for cheap stable per-element randomness. */
export function hash1(n: number): number {
  let x = Math.imul(n | 0, 0x27d4eb2d) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/** 1D value noise in [-1,1], smooth, periodic-free. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash1(i + seed * 7919);
  const b = hash1(i + 1 + seed * 7919);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}

/** Linear RGB-ish blend of two 0xRRGGBB integers. */
export function mixColor(a: number, b: number, t: number): number {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (((ar + (br - ar) * t) | 0) << 16) | (((ag + (bg - ag) * t) | 0) << 8) | ((ab + (bb - ab) * t) | 0);
}

/** Scales the brightness of a color (k in 0..∞, clamped per channel). */
export function scaleColor(c: number, k: number): number {
  const r = Math.min(255, (((c >> 16) & 255) * k) | 0);
  const g = Math.min(255, (((c >> 8) & 255) * k) | 0);
  const b = Math.min(255, ((c & 255) * k) | 0);
  return (r << 16) | (g << 8) | b;
}

export function colorToVec3(c: number, out: Float32Array | number[], offset = 0): void {
  out[offset] = ((c >> 16) & 255) / 255;
  out[offset + 1] = ((c >> 8) & 255) / 255;
  out[offset + 2] = (c & 255) / 255;
}
