import type { SageState } from "../machine/events";

/**
 * Ambient sound design per state. A low drone (up to 5 voices) through a
 * breathing low-pass filter, plus optional textures: "air" (filtered noise),
 * "sparkle" (sparse high plucks — thought), "tick" (mechanical clicks —
 * action) and "grit" (saturation — failure). Everything crossfades.
 */
export interface AmbientProfile {
  /** Drone voices in Hz (unused voices are silent). */
  notes: number[];
  gain: number;
  cutoff: number;
  lfoRate: number;
  lfoDepth: number;
  air: number;
  /** Plucks per second. */
  sparkle: number;
  /** Ticks per second. */
  tick: number;
  grit: number;
}

const A = 55; // A1 — everything is built around A
const ratio = (semitones: number) => A * 2 ** (semitones / 12);

export const AMBIENT: Record<SageState, AmbientProfile> = {
  // Almost silence: a deep, slow-breathing fifth.
  READY: { notes: [A, ratio(7), A * 2], gain: 0.07, cutoff: 360, lfoRate: 0.05, lfoDepth: 90, air: 0, sparkle: 0.05, tick: 0, grit: 0 },
  // Opening up: the filter lifts, a little air enters.
  LISTENING: { notes: [A, ratio(7), A * 2, ratio(19)], gain: 0.08, cutoff: 720, lfoRate: 0.09, lfoDepth: 220, air: 0.012, sparkle: 0.35, tick: 0, grit: 0 },
  // Thought: added ninth, moving filter, airy rush of the tunnel, sparse sparkles.
  ANALYZING: { notes: [A, ratio(7), ratio(14), ratio(19), A * 4], gain: 0.085, cutoff: 1500, lfoRate: 0.16, lfoDepth: 520, air: 0.03, sparkle: 3.2, tick: 0, grit: 0 },
  // Action: tighter, brighter, mechanical clock.
  EXECUTING: { notes: [A, ratio(7), A * 2, A * 4], gain: 0.08, cutoff: 1150, lfoRate: 0.5, lfoDepth: 200, air: 0.022, sparkle: 0.6, tick: 7, grit: 0 },
  // Waiting: the drone thins out; one soft high tone hangs in the air.
  QUESTION: { notes: [A * 2, ratio(19), ratio(43)], gain: 0.045, cutoff: 1900, lfoRate: 0.04, lfoDepth: 120, air: 0.006, sparkle: 0, tick: 0, grit: 0 },
  // Resolution: a wide major chord.
  COMPLETE: { notes: [A, A * 2, ratio(16), ratio(19), A * 4], gain: 0.09, cutoff: 2300, lfoRate: 0.07, lfoDepth: 300, air: 0.01, sparkle: 0.8, tick: 0, grit: 0 },
  // Attention: a minor-second rub and a wobbling filter.
  WARNING: { notes: [A, ratio(1), ratio(7)], gain: 0.085, cutoff: 900, lfoRate: 1.1, lfoDepth: 320, air: 0.015, sparkle: 0, tick: 0, grit: 0.15 },
  // Failure: tritone, saturated rumble, noise.
  CRITICAL: { notes: [A, ratio(1), ratio(6), ratio(13)], gain: 0.1, cutoff: 1250, lfoRate: 2.3, lfoDepth: 450, air: 0.04, sparkle: 0, tick: 0, grit: 0.7 },
};

/** Pitch of the crystalline "voice" chime per state (two notes = an interval). */
export const CHIME: Record<SageState, number[]> = {
  READY: [1318.5],
  LISTENING: [1318.5],
  ANALYZING: [1174.7, 1568],
  EXECUTING: [1568],
  QUESTION: [1318.5, 1760],
  COMPLETE: [1568, 1975.5],
  WARNING: [1046.5, 1108.7],
  CRITICAL: [466.2, 440],
};

/** Pentatonic pool for "sparkle" plucks (A major pentatonic, upper registers). */
export const SPARKLE_NOTES = [880, 987.8, 1108.7, 1318.5, 1480, 1760, 1975.5, 2217.5];

/**
 * Atmosphere: a wide, chorused pad in the mid register that moves through a
 * slow chord progression — the "score" layer that fills 250–800 Hz.
 * Chords are semitone offsets from A2 (110 Hz).
 */
export interface PadProfile {
  chords: number[][];
  /** Seconds per chord. */
  cycle: number;
  gain: number;
  cutoff: number;
  /** Rhythmic amplitude pulse (Hz, 0 = none). */
  tremolo: number;
  /** Glide time between chords (s). */
  glide: number;
}

export const PAD: Record<SageState, PadProfile> = {
  READY: { chords: [[0, 7, 14, 19], [-2, 5, 12, 17]], cycle: 11, gain: 0.032, cutoff: 900, tremolo: 0, glide: 2.5 },
  LISTENING: { chords: [[0, 7, 14, 19], [3, 10, 15, 22]], cycle: 7, gain: 0.04, cutoff: 1400, tremolo: 0, glide: 1.6 },
  ANALYZING: {
    chords: [[0, 7, 12, 16, 23], [-4, 3, 8, 12, 19], [-2, 5, 10, 14, 21], [-7, 0, 7, 12, 16]],
    cycle: 4, gain: 0.05, cutoff: 2300, tremolo: 0, glide: 0.9,
  },
  EXECUTING: { chords: [[0, 7, 12, 19], [0, 5, 12, 17]], cycle: 2, gain: 0.042, cutoff: 1800, tremolo: 6, glide: 0.25 },
  QUESTION: { chords: [[12, 19, 26]], cycle: 30, gain: 0.03, cutoff: 2600, tremolo: 0, glide: 0.6 },
  COMPLETE: { chords: [[0, 7, 12, 16, 19, 24]], cycle: 30, gain: 0.058, cutoff: 3300, tremolo: 0, glide: 0.5 },
  WARNING: { chords: [[0, 1, 7, 13]], cycle: 30, gain: 0.04, cutoff: 1200, tremolo: 3, glide: 0.4 },
  CRITICAL: { chords: [[0, 6, 13, 18], [1, 7, 12, 19]], cycle: 1.5, gain: 0.045, cutoff: 1500, tremolo: 9, glide: 0.08 },
};

/**
 * "Supercomputer": the synthetic computation layer (after the show's sound
 * design idea of a supercomputer crunching). Lives mostly in 1.5–8 kHz.
 *  - grains:  data chatter, tiny high blips per second
 *  - quantize: grains locked to a clock (action) instead of random (thought)
 *  - whir:    band-passed noise, amplitude-modulated — the machine running
 *  - packets: modem-like bursts of alternating tones (seconds between bursts)
 *  - crush:   bit-crushed noise bursts per second (failure / stress)
 *  - hiss:    continuous high "data stream" hiss (5–10 kHz), slowly undulating
 */
export interface ComputeProfile {
  grains: number;
  quantize: number;
  whir: number;
  whirFreq: number;
  packets: number;
  crush: number;
  hiss: number;
}

export const COMPUTE: Record<SageState, ComputeProfile> = {
  READY: { grains: 0.4, quantize: 0, whir: 0.006, whirFreq: 1400, packets: 0, crush: 0, hiss: 0.005 },
  LISTENING: { grains: 7, quantize: 0, whir: 0.02, whirFreq: 1900, packets: 0, crush: 0, hiss: 0.02 },
  ANALYZING: { grains: 42, quantize: 0, whir: 0.05, whirFreq: 2600, packets: 2.6, crush: 0, hiss: 0.032 },
  EXECUTING: { grains: 24, quantize: 12, whir: 0.045, whirFreq: 2200, packets: 1.6, crush: 0.15, hiss: 0.04 },
  QUESTION: { grains: 0, quantize: 0, whir: 0.004, whirFreq: 1200, packets: 0, crush: 0, hiss: 0.0075 },
  COMPLETE: { grains: 3, quantize: 0, whir: 0.008, whirFreq: 3000, packets: 0, crush: 0, hiss: 0.03 },
  WARNING: { grains: 10, quantize: 0, whir: 0.03, whirFreq: 1600, packets: 0, crush: 0.5, hiss: 0.025 },
  CRITICAL: { grains: 30, quantize: 0, whir: 0.05, whirFreq: 900, packets: 0, crush: 2.5, hiss: 0.05 },
};

/** Frequencies for data chatter (harmonics of A, high registers) — machine, but in tune. */
export const GRAIN_NOTES = [1760, 2217.5, 2637, 2960, 3520, 4186, 4435, 5274];
