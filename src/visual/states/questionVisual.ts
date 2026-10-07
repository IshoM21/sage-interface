import { PALETTES } from "../config/palettes";
import type { StateVisual } from "./types";

/** Waiting for the human: travel stops, the seal turns to face you and holds still. */
export const questionVisual: StateVisual = {
  state: "QUESTION",
  palette: PALETTES.QUESTION,
  params: {
    camDolly: 0.05, camOrbit: 0, camSway: 0,
    heartbeat: 1, vignette: 0.95, energy: 0.9, coreGlow: 0.8, coreBreathAmp: 0.1, coreBreathRate: 0.22,
    seed: 0.6, unfold: 1, script: 0.6, scriptSpeed: 0, sealTilt: 0,
    armillary: 0.5, armSpeed: 0, tunnel: 0.25, tunnelSpeed: 0, panels: 0.2,
    stars: 0.6, motes: 0.25, orbit: 0.03, turbulence: 0.08,
    nebula: 0.4, nebulaSwirl: 0.03, flare: 0.3, bloom: 0.75,
  },
  rates: { camOrbit: 2.5, camSway: 2.5, camDolly: 0.8, armSpeed: 3.5, tunnelSpeed: 3, scriptSpeed: 3, orbit: 3, sealTilt: 3, armStep: 5 },
  defaultRate: 2.4,
  wave: [{ to: 1, duration: 0.6 }],
};
