/**
 * The retry beat, timed after the anime's evolution sequence (S2E11 ~12:30):
 *
 *   glitch (0.25) → FAILED 失|敗 (1.15) → REPEATING ATTEMPT 再度|実行 (1.5) → attempt surge (0.75)
 *
 * From the third retry in a streak, the failure/retry phases happen inside a
 * growing grid montage whose cells mix "attempt" and "failure" frames.
 * Shared by the renderer (TransitionController) and the overlay (SageOverlay).
 */
export const RETRY = {
  glitch: 0.25,
  failed: 1.15,
  repeat: 1.5,
  attempt: 0.75,
  /** Retries closer than this (s) belong to the same streak. */
  streakGap: 8,
  /** Streak index from which the grid montage kicks in. */
  montageFrom: 2,
  /** Grid sizes (cells per side) as the montage escalates. */
  montageGrid: [2, 3, 4, 6, 8],
} as const;

export const RETRY_PHASES = {
  failedAt: RETRY.glitch,
  repeatAt: RETRY.glitch + RETRY.failed,
  attemptAt: RETRY.glitch + RETRY.failed + RETRY.repeat,
  end: RETRY.glitch + RETRY.failed + RETRY.repeat + RETRY.attempt,
} as const;
