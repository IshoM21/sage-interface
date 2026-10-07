import { PALETTES } from "../config/palettes";
import type { StateVisual } from "./types";

/** Thought: hyperspace tunnel, armillary bands on every axis, blown-out core, script ring. */
export const analyzingVisual: StateVisual = {
  state: "ANALYZING",
  palette: PALETTES.ANALYZING,
  params: {
    shards: 1, shardSpeed: 1, network: 1,
    camDolly: 0.1, camOrbit: 0.85, camSway: 1,
    kanjiField: 1, energy: 1.1, coreGlow: 1, coreBreathAmp: 0.06, coreBreathRate: 0.5,
    seed: 0.4, unfold: 1, script: 1, scriptSpeed: 0.18, sealTilt: 0.25,
    armillary: 1, armSpeed: 0.8, tunnel: 1, tunnelSpeed: 1, panels: 1,
    stars: 1, motes: 0.85, orbit: 0.5, turbulence: 0.3,
    nebula: 1, nebulaSwirl: 0.45, flare: 1, bloom: 1,
  },
  rates: { tunnelSpeed: 1.2, unfold: 1.6 },
  defaultRate: 1.8,
  wave: [{ to: 1, duration: 0.9 }],
};
