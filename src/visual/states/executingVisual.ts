import { PALETTES } from "../config/palettes";
import type { StateVisual } from "./types";

/** Action: faster travel, bands snap in mechanical steps, module sigils engage. */
export const executingVisual: StateVisual = {
  state: "EXECUTING",
  palette: PALETTES.EXECUTING,
  params: {
    shards: 0.85, shardSpeed: 1.9, network: 0.7,
    camDolly: 0.06, camOrbit: 0.35, camSway: 0.3, camShake: 0.12,
    kanjiField: 0.25, energy: 1.05, coreGlow: 0.9, coreBreathAmp: 0.04, coreBreathRate: 1.1,
    seed: 0.3, unfold: 1, script: 0.8, scriptSpeed: 0.35, sealTilt: 0.15,
    armillary: 1, armSpeed: 0.5, armStep: 1, tunnel: 1, tunnelSpeed: 1.8, panels: 0.7,
    stars: 0.9, motes: 0.4, orbit: 0.3, turbulence: 0.08,
    nebula: 0.85, nebulaSwirl: 0.3, flare: 0.8, bloom: 0.95, modules: 1,
  },
  rates: { armStep: 4, modules: 3 },
  defaultRate: 2.4,
  wave: [{ to: 1, duration: 0.7 }],
};
