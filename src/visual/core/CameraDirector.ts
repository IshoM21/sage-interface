import type { PerspectiveCamera } from "three";
import { CAMERA, ENGINE } from "../config/visualConfig";
import { clamp, easeInOutCubic, easeOutCubic, easeOutExpo, noise1 } from "./math";
import type { EngineContext } from "./types";

export type CameraChannel = "dolly" | "roll" | "panX" | "panY" | "fov" | "shake";

/** One camera move: rises to `amount` in `attack`, holds, then decays in `release`. */
export interface CameraMove {
  channel: CameraChannel;
  amount: number;
  attack: number;
  hold?: number;
  release: number;
  /** "punch" = explosive attack (expo), "smooth" = cinematic ease. */
  style?: "punch" | "smooth";
}

interface ActiveMove extends Required<CameraMove> {
  t: number;
}

const MAX_MOVES = 16;

/**
 * The cinematographer. The camera is never animated directly by systems:
 * it is the sum of
 *  - a per-state *baseline* (eased params: dolly, slow orbit, sway, shake),
 *  - short *moves* fired by the TransitionController (push-ins, pull-backs,
 *    roll snaps, FOV punches, shakes) — the editing rhythm,
 *  - pointer parallax.
 *
 * Units: dolly is a fraction of the fit distance (+ = closer), roll and pan in
 * radians / world units, fov in degrees, shake in world units.
 */
export class CameraDirector {
  private moves: ActiveMove[] = [];
  private sum: Record<CameraChannel, number> = { dolly: 0, roll: 0, panX: 0, panY: 0, fov: 0, shake: 0 };
  /** Base distance that fits the field in the window (set on resize). */
  fitDistance = 13;
  /** Called when a forceful push/pull is fired (for audio sync). */
  onPunch: ((amount: number) => void) | null = null;

  move(m: CameraMove): void {
    if (m.style === "punch" && m.channel === "dolly" && Math.abs(m.amount) >= 0.1) this.onPunch?.(Math.abs(m.amount));
    if (this.moves.length >= MAX_MOVES) this.moves.shift();
    this.moves.push({ hold: 0, style: "smooth", ...m, t: 0 });
  }

  /** Several moves at once. */
  play(...moves: CameraMove[]): void {
    for (const m of moves) this.move(m);
  }

  clear(): void {
    this.moves.length = 0;
  }

  private envelope(m: ActiveMove): number {
    const { t, attack, hold, release, style } = m;
    if (t < attack) {
      const k = clamp(t / attack);
      return style === "punch" ? easeOutExpo(k) : easeOutCubic(k);
    }
    if (t < attack + hold) return 1;
    return 1 - easeInOutCubic(clamp((t - attack - hold) / release));
  }

  update(camera: PerspectiveCamera, ctx: EngineContext): void {
    const { dt, time, params: p, pointer } = ctx;
    const s = this.sum;
    s.dolly = s.roll = s.panX = s.panY = s.fov = s.shake = 0;
    for (let i = 0; i < this.moves.length; i++) {
      const m = this.moves[i];
      m.t += dt;
      if (m.t >= m.attack + m.hold + m.release) {
        this.moves.splice(i--, 1);
        continue;
      }
      s[m.channel] += m.amount * this.envelope(m);
    }

    // Baseline: a slow orbit (the seal is seen from slightly different
    // angles over time) and a gentle roll sway; both vanish in QUESTION.
    const orbit = p.camOrbit;
    const ox = Math.sin(time * 0.11) * 0.9 * orbit;
    const oy = Math.cos(time * 0.083) * 0.55 * orbit;
    const roll = Math.sin(time * 0.07) * 0.035 * p.camSway + s.roll;

    const shake = p.camShake * 0.06 + s.shake;
    const sx = shake > 0.0005 ? noise1(time * 23, 41) * shake : 0;
    const sy = shake > 0.0005 ? noise1(time * 19, 43) * shake : 0;

    const dolly = clamp(p.camDolly + s.dolly, -0.6, 0.7);
    const dist = this.fitDistance * (1 - dolly);
    camera.position.set(
      pointer.x * ENGINE.parallax + ox + s.panX + sx,
      -pointer.y * ENGINE.parallax + oy + s.panY + sy,
      dist,
    );
    camera.lookAt(s.panX * 0.6, s.panY * 0.6, 0);
    if (roll !== 0) camera.rotateZ(roll);

    const fov = CAMERA.fov + s.fov;
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
}
