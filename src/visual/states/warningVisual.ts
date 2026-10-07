import { PALETTES } from "../config/palettes";
import type { StateVisual } from "./types";

/** Attention: amber pulses, wobbling bands, irregular motion — the core stays stable. */
export const warningVisual: StateVisual = {
  state: "WARNING",
  palette: PALETTES.WARNING,
  params: {
    shards: 0.6, shardSpeed: 0.6, network: 0.55,
    camDolly: 0.04, camOrbit: 0.4, camSway: 0.6, camShake: 0.15,
    energy: 0.95, coreGlow: 0.7, coreBreathAmp: 0.04, coreBreathRate: 0.2,
    seed: 0.4, unfold: 1, script: 0.7, scriptSpeed: 0.12, sealTilt: 0.3,
    armillary: 0.9, armSpeed: 0.35, armJitter: 1, tunnel: 0.5, tunnelSpeed: 0.45, panels: 0.35,
    stars: 0.8, motes: 0.45, orbit: 0.3, turbulence: 0.6,
    nebula: 0.7, nebulaSwirl: 0.25, flare: 0.5, bloom: 0.85,
    pulseRate: 0.55, pulseStrength: 0.8,
  },
  defaultRate: 1.8,
  wave: [
    { to: 0.36, duration: 0.32, hold: 0.32 },
    { to: 0.7, duration: 0.32, hold: 0.28 },
    { to: 1, duration: 0.45 },
  ],
};
