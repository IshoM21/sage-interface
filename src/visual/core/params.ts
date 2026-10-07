/**
 * Continuous visual parameters.
 *
 * Each state declares *targets*; the ParamController eases live values toward
 * them every frame, so every state change is a smooth morph. Systems only read
 * live values. Choreography (flashes, overrides) is layered on top by the
 * TransitionController.
 */
export interface VisualParams {
  /** Global brightness multiplier. */
  energy: number;
  coreGlow: number;
  coreBreathAmp: number;
  /** Breaths per second. */
  coreBreathRate: number;
  /** Core instability (CRITICAL). */
  coreShake: number;
  /** Double-beat pulse of the core (QUESTION: "waiting for you"). */
  heartbeat: number;

  /** Double-square seed visibility (READY's minimal emblem). */
  seed: number;
  /** 0 = square seed only → 1 = rhombus + circles fully constructed. */
  unfold: number;
  /** Rotating script ring visibility and speed. */
  script: number;
  scriptSpeed: number;
  /** 0..1 — the script ring locks and turns in heavy mechanical steps (dangerous decision). */
  scriptStep: number;
  /** 0..1 — amber countdown line tracing the seal while a decision is pending. */
  countdown: number;
  /** Seal plane tilt amount (3D sway). */
  sealTilt: number;

  /** Armillary bands visibility, rotation speed, mechanical stepping, alignment. */
  armillary: number;
  armSpeed: number;
  armStep: number;
  /** 0..1 — bands rotate into one plane facing the camera (symmetry / resolution). */
  armAlign: number;
  armJitter: number;
  /** 0..1 — bands and seal break apart (CRITICAL). */
  fragment: number;

  /** Hyperspace tunnel: speed-line visibility, travel speed, flying panel density. */
  tunnel: number;
  tunnelSpeed: number;
  panels: number;

  stars: number;
  /** CPU energy motes: density, orbital speed, inward pull, turbulence, ejection. */
  motes: number;
  orbit: number;
  inflow: number;
  turbulence: number;
  expel: number;
  /** Nodes / motes pulled into the core (COMPLETE). */
  converge: number;
  /** Falling light (the "Understood" frame). */
  rain: number;
  /** Kanji of thought drifting through depth (analysis). */
  kanjiField: number;
  /** Background fill: data shards (density), their travel speed, and the beaded line network. */
  shards: number;
  shardSpeed: number;
  network: number;

  /** Prismatic lens flares and bloom strength. */
  flare: number;
  bloom: number;
  nebula: number;
  nebulaSwirl: number;

  modules: number;

  pulseRate: number;
  pulseStrength: number;

  /** Camera baseline: dolly (fraction of fit distance, + = closer), slow orbit, roll sway, shake. */
  camDolly: number;
  camOrbit: number;
  camSway: number;
  camShake: number;

  glitch: number;
  aberration: number;
  /** Palette inversion toward red/white (CRITICAL "failure" frames). */
  invert: number;
  grain: number;
  vignette: number;
}

export type ParamKey = keyof VisualParams;

export const BASE_PARAMS: VisualParams = {
  energy: 0.8, coreGlow: 0.4, coreBreathAmp: 0.06, coreBreathRate: 0.12, coreShake: 0, heartbeat: 0,
  seed: 1, unfold: 0, script: 0, scriptSpeed: 0.05, scriptStep: 0, countdown: 0, sealTilt: 0.35,
  armillary: 0, armSpeed: 0.2, armStep: 0, armAlign: 0, armJitter: 0, fragment: 0,
  tunnel: 0, tunnelSpeed: 0, panels: 0,
  stars: 0.6, motes: 0.1, orbit: 0.1, inflow: 0, turbulence: 0.15, expel: 0, converge: 0, rain: 0, kanjiField: 0, shards: 0.2, shardSpeed: 0.15, network: 0.1,
  flare: 0, bloom: 0.6, nebula: 0.35, nebulaSwirl: 0.1,
  modules: 0,
  pulseRate: 0, pulseStrength: 0,
  camDolly: 0, camOrbit: 0.25, camSway: 0.5, camShake: 0,
  glitch: 0, aberration: 0.22, invert: 0, grain: 0.02, vignette: 0.75,
};

export type RateMap = Partial<Record<ParamKey, number>>;

export class ParamController {
  readonly live: VisualParams = { ...BASE_PARAMS };
  private target: VisualParams = { ...BASE_PARAMS };
  private rates: RateMap = {};
  private defaultRate = 2.2;
  private keys = Object.keys(BASE_PARAMS) as ParamKey[];
  /** Temporary override layer used by choreographies. */
  private overrides: Partial<VisualParams> = {};

  setTarget(target: VisualParams, rates: RateMap = {}, defaultRate = 2.2): void {
    this.target = target;
    this.rates = rates;
    this.defaultRate = defaultRate;
  }

  override(values: Partial<VisualParams>): void {
    Object.assign(this.overrides, values);
  }

  release(...keys: ParamKey[]): void {
    for (const k of keys) delete this.overrides[k];
  }

  releaseAll(): void {
    this.overrides = {};
  }

  /** Jump instantly (first frame). */
  snap(): void {
    Object.assign(this.live, this.target, this.overrides);
  }

  update(dt: number): void {
    const live = this.live;
    for (const k of this.keys) {
      const goal = this.overrides[k] ?? this.target[k];
      const rate = this.rates[k] ?? this.defaultRate;
      live[k] = live[k] + (goal - live[k]) * (1 - Math.exp(-rate * dt));
    }
  }
}
