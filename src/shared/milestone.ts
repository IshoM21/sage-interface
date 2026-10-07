/**
 * White immersion that opens the milestone (after the show, S2E11 ~11:25.3–11:27.7):
 * light rises until it covers everything, holds pure white, then falls away
 * revealing the gold ceremony that started behind it.
 */
export const WHITEOUT = { rise: 1.0, hold: 0.8, fall: 0.5 } as const;

/** Seconds from the milestone event to the gold ceremony starting (behind the white). */
export const MILESTONE_LEAD = WHITEOUT.rise + WHITEOUT.hold;
