import { Rng, TAU } from "./math";

/**
 * An original procedural script ("Sage script"). Each glyph is composed from
 * a small set of calligraphic primitives — stems with serifs, bowls, hooks,
 * loops, bars, dots — chosen deterministically per glyph index, so the
 * alphabet is stable across runs. Used only for decorative rings.
 */
type Prim = (g: CanvasRenderingContext2D, w: number, h: number, r: Rng) => void;

const stem: Prim = (g, w, h, r) => {
  const x = (r.next() < 0.5 ? 0.3 : 0.62) * w;
  g.moveTo(x, h * 0.05);
  g.lineTo(x, h * 0.95);
  // serifs
  g.moveTo(x - w * 0.12, h * 0.95);
  g.lineTo(x + w * 0.12, h * 0.95);
  if (r.next() < 0.6) {
    g.moveTo(x - w * 0.1, h * 0.08);
    g.lineTo(x + w * 0.14, h * 0.02);
  }
};
const twinStem: Prim = (g, w, h) => {
  for (const x of [0.28, 0.66]) {
    g.moveTo(x * w, h * 0.12);
    g.lineTo(x * w, h * 0.92);
  }
  g.moveTo(0.28 * w, h * 0.12);
  g.quadraticCurveTo(0.47 * w, -h * 0.05, 0.66 * w, h * 0.12);
};
const bowl: Prim = (g, w, h, r) => {
  const left = r.next() < 0.5;
  const cx = left ? w * 0.42 : w * 0.5;
  const cy = h * (r.next() < 0.5 ? 0.35 : 0.65);
  g.moveTo(cx, cy - h * 0.2);
  g.ellipse(cx, cy, w * 0.26, h * 0.2, 0, -Math.PI / 2, Math.PI / 2, left);
};
const hook: Prim = (g, w, h, r) => {
  const y = r.next() < 0.5 ? h * 0.18 : h * 0.82;
  g.moveTo(w * 0.15, y);
  g.bezierCurveTo(w * 0.4, y - h * 0.25, w * 0.75, y + h * 0.2, w * 0.85, y - h * 0.05);
};
const loop: Prim = (g, w, h, r) => {
  const y = r.next() < 0.5 ? h * 0.2 : h * 0.55;
  g.moveTo(w * 0.62, y);
  g.arc(w * 0.5, y, w * 0.12, 0, TAU);
};
const bar: Prim = (g, w, h, r) => {
  const y = h * (0.35 + r.next() * 0.3);
  g.moveTo(w * 0.12, y);
  g.lineTo(w * 0.88, y + (r.next() - 0.5) * h * 0.15);
};
const chevron: Prim = (g, w, h) => {
  g.moveTo(w * 0.15, h * 0.6);
  g.lineTo(w * 0.5, h * 0.82);
  g.lineTo(w * 0.85, h * 0.6);
};
const PRIMS = [stem, twinStem, bowl, hook, loop, bar, chevron];

export const ALPHABET_SIZE = 40;

/** Draws glyph `index` in a w×h box at the current transform origin (top-left). */
export function drawGlyph(g: CanvasRenderingContext2D, index: number, w: number, h: number): void {
  const r = new Rng(0x9e37 + index * 7919);
  const count = 2 + (index % 3);
  g.beginPath();
  stem(g, w, h, r); // every glyph has a spine
  for (let i = 0; i < count; i++) PRIMS[1 + r.int(PRIMS.length - 1)](g, w, h, r);
  g.stroke();
  if (r.next() < 0.35) {
    g.beginPath();
    g.arc(w * (0.3 + r.next() * 0.4), h * (r.next() < 0.5 ? -0.08 : 1.08), w * 0.07, 0, TAU);
    g.fill();
  }
}

/**
 * Paints a circular band of script into a square canvas (centre = canvas centre).
 * `inner`/`outer` are fractions of the canvas half-size.
 */
export function paintScriptRing(
  g: CanvasRenderingContext2D,
  size: number,
  inner: number,
  outer: number,
  seed: number,
  ornate: boolean,
): void {
  const c = size / 2;
  const r0 = inner * c;
  const r1 = outer * c;
  const band = r1 - r0;
  const rng = new Rng(seed);
  g.save();
  g.translate(c, c);
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineCap = "round";
  g.lineJoin = "round";
  // Boundary lines.
  g.lineWidth = size * (ornate ? 0.004 : 0.0025);
  for (const rr of [r0, r1]) {
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    g.stroke();
  }
  if (ornate) {
    g.lineWidth = size * 0.0012;
    for (const rr of [r0 + band * 0.08, r1 - band * 0.08]) {
      g.beginPath();
      g.arc(0, 0, rr, 0, TAU);
      g.stroke();
    }
  }
  // Glyphs, upright relative to the ring (baseline toward the centre).
  const gh = band * (ornate ? 0.62 : 0.55);
  const gw = gh * 0.62;
  const mid = (r0 + r1) / 2;
  const step = (gw * 1.18) / mid;
  g.lineWidth = gh * (ornate ? 0.085 : 0.07);
  for (let a = 0; a < TAU - step; a += step) {
    if (rng.next() < 0.07) continue; // word gaps
    g.save();
    g.rotate(a);
    g.translate(0, -mid);
    g.translate(-gw / 2, -gh / 2);
    drawGlyph(g, rng.int(ALPHABET_SIZE), gw, gh);
    g.restore();
  }
  g.restore();
}
