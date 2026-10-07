import { PALETTES } from "../config/palettes";
import type { StateVisual } from "./types";

/** The seed: a thin double square tilting slowly in a black void. Nearly nothing moves. */
export const readyVisual: StateVisual = {
  state: "READY",
  palette: PALETTES.READY,
  params: {
    camDolly: 0, camOrbit: 0.25, camSway: 0.5,
    energy: 0.8, coreGlow: 0.35, coreBreathAmp: 0.07, coreBreathRate: 0.1,
    seed: 1, unfold: 0, script: 0, sealTilt: 0.45,
    armillary: 0, tunnel: 0, panels: 0,
    stars: 0.55, motes: 0.08, orbit: 0.08, turbulence: 0.1,
    nebula: 0.32, nebulaSwirl: 0.08, bloom: 0.55, flare: 0,
  },
  defaultRate: 1.4,
  wave: [{ to: 1, duration: 1.4 }],
};
