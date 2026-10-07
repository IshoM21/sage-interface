/**
 * Cues emitted by the DOM layer (React overlays) at the moment something is
 * shown — e.g. each kanji of a card being "assembled". The audio engine
 * listens to these the same way it listens to the renderer's VisualCues.
 */
export type UiCue =
  | { type: "cardFrame" }
  | { type: "glyph"; index: number; total: number; tone: CardTone }
  | { type: "cardLock"; tone: CardTone }
  /** A single keystroke of a latin word being typed (identity name). */
  | { type: "key"; wrong: boolean }
  /** An aperture opening over the scene (entering analysis). */
  | { type: "iris" };

export type CardTone = "calm" | "warning" | "failure" | "retry" | "gold";

type Listener = (c: UiCue) => void;
const listeners = new Set<Listener>();

export const uiCues = {
  emit(c: UiCue): void {
    for (const l of listeners) l(c);
  },
  on(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
