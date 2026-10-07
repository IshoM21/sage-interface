import type { Camera, PerspectiveCamera, Scene } from "three";
import type { SageState, ToolModule } from "../../machine/events";
import type { QualitySettings } from "../config/quality";
import type { Rng } from "./math";
import type { PaletteField } from "./PaletteField";
import type { VisualParams } from "./params";
import type { SharedTextures } from "./textures";

export interface ViewInfo {
  /** CSS pixels. */
  width: number;
  height: number;
  pixelRatio: number;
  aspect: number;
  /** Visible half-extents of the z = 0 plane, in world units. */
  halfW: number;
  halfH: number;
}

/** Semantic data from the state machine that visuals may use (never agent-specific). */
export interface VisualSignals {
  activeModule: ToolModule | null;
  completedModules: readonly ToolModule[];
  /** Monotonic retry counter; a change triggers the "repeating attempt" beat. */
  retries: number;
  /** A dangerous decision is pending (mechanical seal). */
  danger: boolean;
}

/**
 * Semantic "something just happened on screen" notifications, emitted at the
 * exact frame they occur. The engine knows nothing about audio; a host can
 * subscribe (VisualEngine.onCue) to sync sound, haptics, logging…
 */
export type VisualCue =
  | { type: "state"; from: SageState; to: SageState }
  | { type: "cut" }
  | { type: "flash"; amount: number }
  | { type: "shock"; strength: number }
  | { type: "punch"; amount: number }
  | { type: "pulse"; strength: number }
  | { type: "glitch"; amount: number }
  | { type: "resolve" }
  | { type: "retry" }
  | { type: "retryStep"; step: number }
  | { type: "milestone"; phase: "start" | "release" }
  | { type: "module" }
  | { type: "heartbeat" }
  | { type: "corrupt"; duration: number }
  | { type: "whiteout"; rise: number; hold: number; fall: number }
  | { type: "danger"; on: boolean }
  | { type: "gear"; heavy: boolean };

/** Cross-system effects. Implemented by the engine, consumed by any system. */
export interface VisualBus {
  cue(c: VisualCue): void;
  shockwave(opts: { speed?: number; width?: number; strength?: number; role?: number; distort?: number }): void;
  burst(x: number, y: number, count: number, speed: number, role: number, life?: number): void;
  flash(amount: number, role?: number): void;
}

export interface EngineContext {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Screen-attached layer (children follow the camera). */
  hud: Camera;
  params: Readonly<VisualParams>;
  palette: PaletteField;
  quality: QualitySettings;
  textures: SharedTextures;
  rng: Rng;
  view: ViewInfo;
  /** Smoothed pointer, -1..1 from the centre. */
  pointer: { x: number; y: number };
  /** Seconds since start (paused while hidden). */
  time: number;
  /** Seconds, clamped. */
  dt: number;
  state: SageState;
  prevState: SageState;
  stateTime: number;
  signals: VisualSignals;
  bus: VisualBus;
}

export interface SystemStats {
  particles?: number;
  objects?: number;
}

/**
 * A visual system owns its Three objects and pools. Systems are updated in
 * registration order every frame and must not allocate in `update`.
 */
export interface VisualSystem {
  readonly name: string;
  update(ctx: EngineContext): void;
  resize?(ctx: EngineContext): void;
  setQuality?(ctx: EngineContext): void;
  onStateChange?(from: SageState, to: SageState, ctx: EngineContext): void;
  stats?(): SystemStats;
  destroy(): void;
}
