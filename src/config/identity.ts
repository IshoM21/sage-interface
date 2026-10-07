/**
 * Identity of the interface — the single place to rebrand it.
 *
 * Change these values and the boot sequence, the brand label and the identity
 * diamond all follow. Keep `kanji` to 1–3 characters (stacked vertically in
 * the diamond, like a seal).
 */
export const IDENTITY = {
  /** Identity kanji shown inside the diamond. 叡 (ei): profound wisdom, lucidity. */
  kanji: "叡",
  /** Reading and meaning (documentation / tooltips). */
  reading: "ei",
  meaning: "Profound wisdom, lucidity",
  /** Latin name typed letter by letter (with a couple of "wrong" keystrokes). */
  name: "SAGE INTERFACE",
  /** Short brand shown in the corner. */
  brand: "SAGE",
  /** Small vertical label beside the kanji (katakana reading of the name). */
  verticalLabel: "セージ",
  /** Label above the diamond. */
  label: "Identity",
} as const;
