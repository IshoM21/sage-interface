/**
 * Corrupted-data interlude played on entering CRITICAL, before the failure
 * frame (after the show, S2E11 ~12:50.9–12:52.0):
 *   darken (0.15) → lines are written (to 0.45) → smeared into bars (to 0.75)
 *   → thinned out (to 0.95) → camera whip into a vortex (to 1.1)
 */
export const CORRUPT = {
  duration: 1.1,
  whipAt: 0.95,
} as const;
