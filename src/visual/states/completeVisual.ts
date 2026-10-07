import { PALETTES } from "../config/palettes";
import type { StateVisual } from "./types";

/** Resolution: bands align into one plane, light rains, everything converges. */
export const completeVisual: StateVisual = {
  state: "COMPLETE",
  palette: PALETTES.COMPLETE,
  params: {
    camDolly: -0.06, camOrbit: 0.15, camSway: 0.2,
    energy: 1, coreGlow: 1, coreBreathAmp: 0.05, coreBreathRate: 0.2,
    seed: 0.2, unfold: 1, script: 0.7, scriptSpeed: 0.03, sealTilt: 0,
    armillary: 0.9, armSpeed: 0.05, armAlign: 1, tunnel: 0.15, tunnelSpeed: 0.08, panels: 0,
    stars: 0.8, motes: 0.35, converge: 1, inflow: 0.3, orbit: 0.08, turbulence: 0.04, rain: 1,
    nebula: 0.7, nebulaSwirl: 0.1, flare: 0.6, bloom: 1,
  },
  rates: { tunnelSpeed: 2.6, converge: 2.4, armAlign: 2.2, armSpeed: 2.6, sealTilt: 2.5, panels: 3 },
  defaultRate: 2,
  waveDelay: 1.0,
  wave: [{ to: 1, duration: 0.75 }],
};
