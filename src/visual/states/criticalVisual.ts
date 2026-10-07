import { PALETTES } from "../config/palettes";
import type { StateVisual } from "./types";

/** Failure: inversion frames, datamosh bursts, fragmenting bands, ejected light. Still legible. */
export const criticalVisual: StateVisual = {
  state: "CRITICAL",
  palette: PALETTES.CRITICAL,
  params: {
    camDolly: 0.02, camOrbit: 0.5, camSway: 1, camShake: 0.7,
    energy: 0.95, coreGlow: 0.8, coreBreathAmp: 0.16, coreBreathRate: 1.4, coreShake: 1,
    seed: 0.5, unfold: 0.8, script: 0.6, scriptSpeed: -0.2, sealTilt: 0.4,
    armillary: 0.9, armSpeed: 0.5, armJitter: 0.6, fragment: 1, tunnel: 0.4, tunnelSpeed: 0.3, panels: 0.4,
    stars: 0.7, motes: 0.5, orbit: 0.4, turbulence: 0.9, expel: 1,
    nebula: 0.5, nebulaSwirl: 0.4, flare: 0.3, bloom: 0.9,
    pulseRate: 0.7, pulseStrength: 1, glitch: 1, aberration: 1, invert: 0.1, grain: 0.05,
  },
  rates: { fragment: 3 },
  defaultRate: 2.6,
  wave: [
    { to: 0.3, duration: 0.16, hold: 0.14 },
    { to: 1, duration: 0.38 },
  ],
};
