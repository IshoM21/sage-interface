import { PALETTES } from "../config/palettes";
import type { StateVisual } from "./types";

/** Receiving: the seed unfolds, light drifts inward, the first bands wake. */
export const listeningVisual: StateVisual = {
  state: "LISTENING",
  palette: PALETTES.LISTENING,
  params: {
    shards: 0.45, shardSpeed: 0.35, network: 0.35,
    camDolly: 0.05, camOrbit: 0.3, camSway: 0.5,
    energy: 0.95, coreGlow: 0.6, coreBreathAmp: 0.1, coreBreathRate: 0.3,
    seed: 1, unfold: 0.55, script: 0.35, scriptSpeed: 0.08, sealTilt: 0.3,
    armillary: 0.25, armSpeed: 0.25, tunnel: 0.25, tunnelSpeed: 0.25, panels: 0.1,
    stars: 0.7, motes: 0.45, inflow: 1, orbit: 0.2, turbulence: 0.15,
    nebula: 0.5, nebulaSwirl: 0.15, flare: 0.2, bloom: 0.7,
  },
  defaultRate: 2,
  wave: [{ to: 1, duration: 0.9 }],
};
