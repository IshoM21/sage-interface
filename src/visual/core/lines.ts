import { AdditiveBlending } from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { TAU } from "./math";

/**
 * Thick anti-aliased lines (Line2) for the seal geometry. WebGL ignores
 * `linewidth` on plain lines, so every constructed stroke uses this.
 * Progressive drawing ("the line is being written") = limiting the instanced
 * segment count, which costs nothing per frame.
 */
/** Every live line material and its CSS-pixel width. */
const materials = new Map<LineMaterial, number>();
let pixelRatio = 1;

export interface SageLine {
  line: Line2;
  material: LineMaterial;
  segments: number;
  /** CSS-pixel width (scaled by pixel ratio internally). */
  width: number;
}

export function makeLine(points: number[], width: number, closed = false): SageLine {
  const pts = closed ? [...points, points[0], points[1], points[2]] : points;
  const geometry = new LineGeometry();
  geometry.setPositions(pts);
  const material = new LineMaterial({
    color: 0xffffff,
    linewidth: width * pixelRatio,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    worldUnits: false,
  });
  materials.set(material, width);
  const line = new Line2(geometry, material);
  line.frustumCulled = false;
  return { line, material, segments: pts.length / 3 - 1, width };
}

/** Reveal the first `p` (0..1) of the line. */
export function setProgress(l: SageLine, p: number): void {
  const n = p >= 1 ? l.segments : Math.max(0, Math.floor(p * l.segments));
  l.line.geometry.instanceCount = n;
  l.line.visible = n > 0;
}

export function disposeLine(l: SageLine): void {
  materials.delete(l.material);
  l.line.geometry.dispose();
  l.material.dispose();
}

/** Keep every line's resolution and pixel-ratio-scaled width in sync. */
export function resizeLines(width: number, height: number, ratio: number): void {
  pixelRatio = ratio;
  for (const [m, w] of materials) {
    m.resolution.set(width * ratio, height * ratio);
    m.linewidth = w * ratio;
  }
}

export function circlePoints(r: number, segments: number, start = Math.PI / 2, z = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + (i / segments) * TAU;
    out.push(Math.cos(a) * r, Math.sin(a) * r, z);
  }
  return out;
}

/** Regular polygon, each edge subdivided so progressive drawing is smooth. */
export function polygonPoints(r: number, sides: number, rotation: number, subdiv = 12, z = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a0 = rotation + (i / sides) * TAU;
    const a1 = rotation + ((i + 1) / sides) * TAU;
    const x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
    for (let k = 0; k < subdiv; k++) {
      const t = k / subdiv;
      out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z);
    }
  }
  out.push(out[0], out[1], out[2]);
  return out;
}
