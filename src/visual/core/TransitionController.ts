import type { SageState } from "../../machine/events";
import { CORRUPT } from "../../shared/critical";
import { MILESTONE_LEAD, WHITEOUT } from "../../shared/milestone";
import { RETRY, RETRY_PHASES } from "../../shared/retry";
import { GOLD, ROLE, SOLEMN } from "../config/palettes";
import { STATE_VISUALS, targetParams } from "../states";
import type { CameraDirector } from "./CameraDirector";
import type { PaletteField } from "./PaletteField";
import type { ParamController } from "./params";
import type { VisualBus } from "./types";

/** Retry beat timing (s): when the frame splits into 4, into 9, and returns to 1. */
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
  /** Retry grid: 1 = off, N = frame repeated in an N×N grid. */
  tiles = 1;
  /** Focus pull (0 = sharp, 1 = fully defocused) for the composite. */
  defocus = 0;
  private focusT = -1;
  private danger = false;
  /** White immersion amount (0..1) for the composite. */
  white = 0;
  private whiteT = -1;
  /** Fraction of grid cells shown as failure (inverted) frames. */
  tileInvert = 0;
  /** Inversion held during the FAILED phase of a retry. */
  private failHold = 0;
  private retryUntil = 0;
  private retryToken = 0;
  private retryStreak = 0;
  private lastRetryAt = -100;
  private montageLevel = 0;
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
    this.bus.cue({ type: "cut" });
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
    if (to === "WARNING" || to === "QUESTION") {
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
        this.criticalChoreography();
        break;
      case "COMPLETE":
        this.completeChoreography(from);
        break;
      default:
        break;
    }
  }

  /**
   * CRITICAL: first the corrupted-data interlude (the scene goes dark while
   * lines of script are written, smeared and thinned out, then a camera whip),
   * then the failure hits: red cut, inversion, datamosh, shockwave, ejection.
   */
  private criticalChoreography(): void {
    this.bus.cue({ type: "corrupt", duration: CORRUPT.duration });
    this.params.override({
      energy: 0.12, nebula: 0.12, tunnel: 0, panels: 0, armillary: 0.1, flare: 0, bloom: 0.45,
      glitch: 0, aberration: 0, motes: 0.05, script: 0.1,
    });
    this.cam.move({ channel: "dolly", amount: -0.05, attack: 0.3, hold: 0.5, release: 0.4 });
    this.at(CORRUPT.whipAt, () => {
      this.glitchKick = 0.7;
      this.cam.play(
        { channel: "dolly", amount: 0.34, attack: 0.12, release: 0.5, style: "punch" },
        { channel: "roll", amount: 0.22, attack: 0.12, release: 0.6, style: "punch" },
        { channel: "fov", amount: -6, attack: 0.12, release: 0.5, style: "punch" },
      );
    });
    this.at(CORRUPT.duration, () => {
      this.params.releaseAll();
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
    });
    this.at(CORRUPT.duration + 0.32, () => {
      this.glitchKick = 0.8;
      this.invertKick = 0.85;
      this.bus.shockwave({ speed: 7, width: 0.15, strength: 0.8, distort: 0.5, role: ROLE.primary });
      this.cam.play(
        { channel: "shake", amount: 0.12, attack: 0.03, release: 0.6, style: "punch" },
        { channel: "roll", amount: 0.07, attack: 0.06, release: 0.8, style: "punch" },
      );
    });
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
      this.bus.cue({ type: "resolve" });
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
  /**
   * Milestone: a white immersion first (light rises, holds pure white, falls
   * away); the gold ceremony starts behind the white so the scene is revealed
   * already transformed. `onCeremony` starts the seal (MilestoneSystem).
   */
  milestone(onCeremony: () => void): void {
    this.inMilestone = true;
    this.whiteT = 0;
    this.bus.cue({ type: "whiteout", rise: WHITEOUT.rise, hold: WHITEOUT.hold, fall: WHITEOUT.fall });
    // Light swells toward the white: flares and core bloom out.
    this.params.override({ flare: 1.4, coreGlow: 2.4, bloom: 1.3, energy: 1.2 });
    this.at(MILESTONE_LEAD, () => {
      this.params.release("flare", "coreGlow", "bloom", "energy");
      onCeremony();
      this.ceremony();
    }, true);
  }

  private ceremony(): void {
    this.bus.cue({ type: "milestone", phase: "start" });
    this.palette.start(GOLD, [{ to: 1, duration: 0.6 }]);
    this.params.override({ energy: 0.7, tunnel: 0, tunnelSpeed: 0.05, armillary: 0.25, panels: 0, nebula: 0.9, flare: 1, script: 0 });
    // The camera withdraws while the seal is inscribed…
    this.cam.move({ channel: "dolly", amount: -0.22, attack: 1.7, hold: 0.15, release: 0.15 });
    this.at(1.9, () => {
      this.bus.cue({ type: "milestone", phase: "release" });
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

  /**
   * Dangerous decision (QUESTION with danger): no scene change — Sage's own
   * seal "turns serious". The world around it falls away (tunnel, panels,
   * nebula), the script ring locks and turns in heavy mechanical steps, the
   * bands freeze, an amber countdown traces the seal and the light goes solemn.
   */
  setDanger(on: boolean): void {
    if (on === this.danger) return;
    this.danger = on;
    const keys = [
      "tunnel", "panels", "nebula", "motes", "flare", "bloom", "rain", "stars", "unfold", "script", "scriptSpeed",
      "scriptStep", "countdown", "armillary", "armSpeed", "armStep", "vignette", "coreGlow", "camOrbit", "camSway", "sealTilt",
      "shards", "shardSpeed", "network",
    ] as const;
    if (on) {
      this.palette.start(SOLEMN, [{ to: 0.5, duration: 0.5, hold: 0.25 }, { to: 1, duration: 0.6 }]);
      this.params.override({
        tunnel: 0, panels: 0, nebula: 0.08, motes: 0.05, flare: 0, bloom: 0.5, rain: 0, stars: 0.25,
        unfold: 1, script: 1, scriptSpeed: 0, scriptStep: 1, countdown: 1,
        armillary: 0.35, armSpeed: 0, armStep: 0, vignette: 1, coreGlow: 0.55,
        camOrbit: 0, camSway: 0, sealTilt: 0, shards: 0.12, shardSpeed: 0, network: 0,
      });
      this.cam.move({ channel: "dolly", amount: 0.06, attack: 1.4, hold: 600, release: 0.8 });
    } else {
      this.params.release(...keys);
      this.palette.start(STATE_VISUALS[this.state].palette, [{ to: 1, duration: 0.6 }]);
      this.cam.clear();
    }
  }

  /**
   * One failed attempt and its retry, timed after the anime (see shared/retry.ts):
   * glitch → FAILED (paper/red inversion held) → REPEATING ATTEMPT → attempt surge.
   * From the third retry of a streak the failure/retry happen inside a growing
   * grid whose cells mix attempt (normal) and failure (inverted) frames.
   * Retries arriving while a cycle is still playing escalate the grid instead.
   */
  retry(): void {
    const now = this.t;
    this.retryStreak = now - this.lastRetryAt < RETRY.streakGap ? this.retryStreak + 1 : 0;
    this.lastRetryAt = now;

    if (now < this.retryUntil) {
      // Quick succession: escalate the montage.
      this.montageLevel = Math.min(this.montageLevel + 1, RETRY.montageGrid.length - 1);
      this.setGrid(RETRY.montageGrid[this.montageLevel], 0.6);
      this.glitchKick = Math.max(this.glitchKick, 0.9);
      this.retryUntil = Math.max(this.retryUntil, now + 1.2);
      const token = ++this.retryToken;
      this.at(1.2, () => token === this.retryToken && this.endRetry());
      return;
    }

    const montage = this.retryStreak >= RETRY.montageFrom;
    const token = ++this.retryToken;
    const live = (fn: () => void) => () => token === this.retryToken && fn();
    this.retryUntil = now + RETRY_PHASES.end;
    this.montageLevel = 0;

    // 1) glitch: the attempt breaks.
    this.bus.cue({ type: "retry" });
    this.glitchKick = 1;
    this.flashCut(ROLE.core, 1, 0.8);
    this.bus.shockwave({ speed: 9, width: 0.2, strength: 0.7, distort: 0.6, role: ROLE.primary });
    this.cam.move({ channel: "shake", amount: 0.08, attack: 0.03, release: 0.3, style: "punch" });

    // 2) FAILED: hold the paper/red inversion (montage: inside a growing grid).
    this.at(RETRY_PHASES.failedAt, live(() => {
      this.failHold = montage ? 0 : 0.85;
      this.cam.play(
        { channel: "shake", amount: 0.1, attack: 0.03, release: 0.6, style: "punch" },
        { channel: "roll", amount: -0.06, attack: 0.06, release: 0.9, style: "punch" },
      );
      if (montage) {
        this.setGrid(RETRY.montageGrid[0], 0.75);
        this.at(RETRY.failed * 0.45, live(() => this.setGrid(RETRY.montageGrid[1], 0.7)));
      }
    }));

    // 3) REPEATING ATTEMPT: back to normal light (montage: more cells recover).
    this.at(RETRY_PHASES.repeatAt, live(() => {
      this.failHold = 0;
      this.invertKick = 0.5;
      if (montage) {
        this.setGrid(RETRY.montageGrid[2], 0.45);
        this.at(RETRY.repeat * 0.5, live(() => this.setGrid(RETRY.montageGrid[3], 0.3)));
      }
    }));

    // 4) attempt surge: grid collapses, flash, the camera is thrown in again.
    this.at(RETRY_PHASES.attemptAt, live(() => {
      this.setGrid(1, 0);
      this.flashCut(ROLE.core, 1, 0.7);
      this.bus.flash(0.5);
      this.params.override({ tunnelSpeed: 2.6 });
      this.cam.play(
        { channel: "dolly", amount: 0.24, attack: 0.12, hold: 0.05, release: 0.9, style: "punch" },
        { channel: "fov", amount: -4, attack: 0.12, release: 0.8, style: "punch" },
      );
    }));
    this.at(RETRY_PHASES.end, live(() => this.endRetry()));
  }

  private setGrid(cells: number, invertRatio: number): void {
    if (cells !== this.tiles && cells > 1) this.bus.cue({ type: "retryStep", step: cells * cells });
    this.tiles = cells;
    this.tileInvert = invertRatio;
  }

  private endRetry(): void {
    this.setGrid(1, 0);
    this.failHold = 0;
    this.params.release("tunnelSpeed");
    this.retryUntil = 0;
  }

  update(dt: number): void {
    this.t += dt;
    // Cuts are frame-counted, not time-based: a cut is one or two frames.
    if (this.cutFrames > 0) this.cutFrames--;
    else this.cut = Math.max(0, this.cut - dt * 12);
    this.glitchKick = Math.max(0, this.glitchKick - dt * 2.2);
    this.invertKick = Math.max(this.failHold, this.invertKick - dt * 3.2);
    if (this.focusT >= 0) {
      // Out of focus for a moment, then the focus snaps in.
      this.focusT += dt;
      this.defocus = this.focusT < 0.45 ? 1 : Math.max(0, 1 - ((this.focusT - 0.45) / 0.9) ** 0.6);
      if (this.focusT > 1.5) this.focusT = -1;
    }
    if (this.whiteT >= 0) {
      this.whiteT += dt;
      const { rise, hold, fall } = WHITEOUT;
      const w = this.whiteT;
      // Rise eases in (light accumulating), fall eases out.
      this.white = w < rise ? (w / rise) ** 2.2 : w < rise + hold ? 1 : Math.max(0, 1 - ((w - rise - hold) / fall) ** 0.7);
      if (w > rise + hold + fall) {
        this.whiteT = -1;
        this.white = 0;
      }
    }
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
