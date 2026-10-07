import type { SageState } from "../../machine/events";
import { GOLD, ROLE } from "../config/palettes";
import { STATE_VISUALS, targetParams } from "../states";
import type { CameraDirector } from "./CameraDirector";
import type { PaletteField } from "./PaletteField";
import type { ParamController } from "./params";
import type { VisualBus } from "./types";

/** Retry beat timing (s): when the frame splits into 4, into 9, and returns to 1. */
export const RETRY_TIMING = { grid4: 0.36, grid9: 0.9, end: 1.4 } as const;

interface Cue {
  at: number;
  run: () => void;
  /** Survives state changes (ceremonies that must finish). */
  keep: boolean;
}

/**
 * Turns a discrete state change into a performance:
 *  1. new param targets (eased per-parameter by ParamController),
 *  2. a palette wave that recolors the scene from the core outward,
 *  3. timed cues (flashes, shockwaves, temporary overrides).
 *
 * It also owns the editing rhythm — camera moves (push-ins, pull-backs,
 * roll snaps, FOV punches) and full-frame "cut" flashes — plus short-lived
 * post effects: inversion flashes, the datamosh kick and the retry grid.
 */
export class TransitionController {
  private cues: Cue[] = [];
  private t = 0;
  glitchKick = 0;
  invertKick = 0;
  /** Retry grid: 1 = off, 2/3 = frame repeated in a grid. */
  tiles = 1;
  /** Full-frame cut flash: amount and role, held for a couple of frames. */
  cut = 0;
  cutRole: number = ROLE.core;
  private cutFrames = 0;
  private state: SageState = "READY";
  private inMilestone = false;

  constructor(
    private params: ParamController,
    private palette: PaletteField,
    private bus: VisualBus,
    private cam: CameraDirector,
  ) {}

  /** A hard editing cut: 1–2 frames of solid light. */
  private flashCut(role: number = ROLE.core, frames = 2, amount = 0.85): void {
    this.cut = amount;
    this.cutRole = role;
    this.cutFrames = frames;
  }

  private at(delay: number, run: () => void, keep = false): void {
    this.cues.push({ at: this.t + delay, run, keep });
  }

  enter(from: SageState, to: SageState): void {
    this.state = to;
    const sv = STATE_VISUALS[to];
    this.cues = this.cues.filter((c) => c.keep);
    this.params.releaseAll();
    this.params.setTarget(targetParams(to), sv.rates, sv.defaultRate);
    this.tiles = 1;

    if (!this.inMilestone) {
      const startWave = () => this.palette.start(sv.palette, sv.wave);
      if (sv.waveDelay) this.at(sv.waveDelay, startWave);
      else startWave();
    }

    const live = this.params.live;
    if (to === "WARNING" || to === "CRITICAL" || to === "QUESTION") {
      // The previous energy dims briefly before the new state takes over.
      this.params.override({ energy: live.energy * 0.55 });
      this.at(0.22, () => this.params.release("energy"));
    }

    switch (to) {
      case "READY":
        // Settle: a slow breath out.
        if (from !== "READY") this.cam.move({ channel: "dolly", amount: -0.06, attack: 1.2, release: 2 });
        break;
      case "LISTENING":
        this.bus.shockwave({ speed: 3, width: 0.1, strength: 0.35, distort: 0.08, role: ROLE.secondary });
        // Leaning in to listen.
        this.cam.move({ channel: "dolly", amount: 0.07, attack: 0.9, hold: 0.2, release: 1.4 });
        break;
      case "ANALYZING":
        // Hard cut, then the camera is thrown forward into the tunnel.
        this.flashCut(ROLE.core, 1, 0.9);
        this.params.override({ tunnelSpeed: 2.8 });
        this.at(0.55, () => this.params.release("tunnelSpeed"));
        this.bus.shockwave({ speed: 7, width: 0.12, strength: 0.4, distort: 0.25 });
        this.bus.flash(0.35);
        this.cam.play(
          { channel: "dolly", amount: 0.3, attack: 0.16, hold: 0.08, release: 1.3, style: "punch" },
          { channel: "fov", amount: -5, attack: 0.16, release: 1.1, style: "punch" },
          { channel: "roll", amount: 0.05, attack: 0.5, release: 1.6 },
        );
        break;
      case "EXECUTING":
        // Mechanical: a roll snap and a short shove, like a gear engaging.
        this.flashCut(ROLE.accent, 1, 0.6);
        this.bus.shockwave({ speed: 8, width: 0.1, strength: 0.4, distort: 0.25, role: ROLE.accent });
        this.cam.play(
          { channel: "roll", amount: from === "EXECUTING" ? 0.04 : 0.09, attack: 0.09, release: 0.75, style: "punch" },
          { channel: "dolly", amount: 0.12, attack: 0.1, release: 0.7, style: "punch" },
          { channel: "shake", amount: 0.04, attack: 0.05, release: 0.35, style: "punch" },
        );
        break;
      case "QUESTION":
        // Everything stops; the camera slowly leans in and holds your gaze.
        this.cam.clear();
        this.at(0.5, () => this.bus.flash(0.3, ROLE.accent));
        this.cam.move({ channel: "dolly", amount: 0.04, attack: 1.6, hold: 1, release: 2.5 });
        break;
      case "WARNING": {
        // One pulse per palette leg: each wave transforms more of the structure.
        let tt = 0;
        for (const leg of sv.wave ?? []) {
          this.at(tt, () => {
            this.bus.shockwave({ speed: 7, width: 0.2, strength: 0.85, distort: 0.45, role: ROLE.primary });
            this.cam.play(
              { channel: "dolly", amount: 0.06, attack: 0.08, release: 0.5, style: "punch" },
              { channel: "shake", amount: 0.05, attack: 0.04, release: 0.4, style: "punch" },
            );
          });
          tt += leg.duration + (leg.hold ?? 0);
        }
        break;
      }
      case "CRITICAL":
        this.flashCut(ROLE.primary, 2, 0.9);
        this.glitchKick = 1;
        this.invertKick = 1;
        this.bus.flash(0.3, ROLE.primary);
        this.bus.shockwave({ speed: 11, width: 0.3, strength: 1, distort: 1, role: ROLE.primary });
        this.bus.burst(0, 0, 140, 8, ROLE.secondary, 1.3);
        this.cam.play(
          { channel: "shake", amount: 0.22, attack: 0.04, release: 1.1, style: "punch" },
          { channel: "roll", amount: -0.12, attack: 0.08, release: 1, style: "punch" },
          { channel: "dolly", amount: 0.2, attack: 0.08, release: 0.9, style: "punch" },
        );
        this.at(0.32, () => {
          this.glitchKick = 0.8;
          this.invertKick = 0.85;
          this.bus.shockwave({ speed: 7, width: 0.15, strength: 0.8, distort: 0.5, role: ROLE.primary });
          this.cam.play(
            { channel: "shake", amount: 0.12, attack: 0.03, release: 0.6, style: "punch" },
            { channel: "roll", amount: 0.07, attack: 0.06, release: 0.8, style: "punch" },
          );
        });
        break;
      case "COMPLETE":
        this.completeChoreography(from);
        break;
      default:
        break;
    }
  }

  /**
   * ANALYZING/EXECUTING → COMPLETE (~1.2 s): the tunnel decelerates, motes
   * converge, the bands swing into one plane, a flash and radial wave release
   * the result; the deep-blue "understood" field takes over.
   */
  private completeChoreography(from: SageState): void {
    const busy = from === "ANALYZING" || from === "EXECUTING";
    this.params.override({ armAlign: 0, rain: 0 });
    this.at(busy ? 0.4 : 0.15, () => this.params.release("armAlign"));
    // Tension: the camera creeps in while everything converges…
    this.cam.move({ channel: "dolly", amount: 0.14, attack: 0.95, hold: 0.05, release: 0.25 });
    this.cam.move({ channel: "fov", amount: -3, attack: 0.95, release: 0.3 });
    this.at(1.0, () => {
      // …then the release: a cut of light and the camera thrown back.
      this.flashCut(ROLE.core, 2, 0.95);
      this.cam.play(
        { channel: "dolly", amount: -0.17, attack: 0.14, hold: 0.2, release: 2.2, style: "punch" },
        { channel: "fov", amount: 5, attack: 0.14, release: 1.6, style: "punch" },
        { channel: "shake", amount: 0.07, attack: 0.03, release: 0.5, style: "punch" },
      );
      this.bus.flash(1.1, ROLE.core);
      this.bus.shockwave({ speed: 10, width: 0.35, strength: 1, distort: 0.9, role: ROLE.core });
      this.bus.burst(0, 0, 180, 6.5, ROLE.accent, 1.5);
      this.params.override({ energy: 1.3, coreGlow: 1.5 });
      this.params.release("rain");
    });
    this.at(1.12, () => this.bus.shockwave({ speed: 6, width: 0.12, strength: 0.5, distort: 0.2, role: ROLE.secondary }));
    this.at(1.6, () => this.params.release("energy", "coreGlow"));
  }

  /** Gold "ultimate" ceremony; timing mirrors MilestoneSystem. */
  milestone(): void {
    this.inMilestone = true;
    this.palette.start(GOLD, [{ to: 1, duration: 0.6 }]);
    this.params.override({ energy: 0.7, tunnel: 0, tunnelSpeed: 0.05, armillary: 0.25, panels: 0, nebula: 0.9, flare: 1, script: 0 });
    // The camera withdraws while the seal is inscribed…
    this.cam.move({ channel: "dolly", amount: -0.22, attack: 1.7, hold: 0.15, release: 0.15 });
    this.at(1.9, () => {
      // …and slams in at the release.
      this.flashCut(ROLE.core, 2, 1);
      this.cam.play(
        { channel: "dolly", amount: 0.3, attack: 0.12, hold: 0.15, release: 2.4, style: "punch" },
        { channel: "fov", amount: -6, attack: 0.12, release: 2, style: "punch" },
        { channel: "shake", amount: 0.09, attack: 0.03, release: 0.7, style: "punch" },
      );
      this.params.release("energy");
      this.params.override({ rain: 1, bloom: 1.25 });
    }, true);
    this.at(4.7, () => {
      this.inMilestone = false;
      this.palette.start(STATE_VISUALS[this.state].palette, [{ to: 1, duration: 1 }]);
      this.params.release("tunnel", "tunnelSpeed", "armillary", "panels", "nebula", "flare", "script", "rain", "bloom");
    }, true);
  }

  /** "Failed. Repeating attempt." — inversion flash, datamosh, frame repeated in a grid. */
  retry(): void {
    this.invertKick = 1;
    this.glitchKick = 1;
    this.flashCut(ROLE.core, 1, 0.8);
    this.bus.shockwave({ speed: 9, width: 0.2, strength: 0.7, distort: 0.6, role: ROLE.primary });
    const punch = () =>
      this.cam.play(
        { channel: "dolly", amount: 0.16, attack: 0.05, release: 0.22, style: "punch" },
        { channel: "shake", amount: 0.06, attack: 0.03, release: 0.2, style: "punch" },
      );
    punch();
    this.at(RETRY_TIMING.grid4, () => {
      this.tiles = 2;
      this.invertKick = Math.max(this.invertKick, 0.5);
      punch();
    });
    this.at(RETRY_TIMING.grid9, () => {
      this.tiles = 3;
      this.invertKick = Math.max(this.invertKick, 0.5);
      punch();
    });
    this.at(RETRY_TIMING.end, () => {
      this.tiles = 1;
      this.glitchKick = 0.6;
    });
  }

  update(dt: number): void {
    this.t += dt;
    // Cuts are frame-counted, not time-based: a cut is one or two frames.
    if (this.cutFrames > 0) this.cutFrames--;
    else this.cut = Math.max(0, this.cut - dt * 12);
    this.glitchKick = Math.max(0, this.glitchKick - dt * 2.2);
    this.invertKick = Math.max(0, this.invertKick - dt * 3.2);
    if (!this.cues.length) return;
    for (let i = 0; i < this.cues.length; i++) {
      const c = this.cues[i];
      if (this.t >= c.at) {
        this.cues.splice(i--, 1);
        c.run();
      }
    }
  }
}
