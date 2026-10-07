import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { uiCues, type CardTone } from "../app/uiCues";

/** Assembly timing (s): the frame opens, then each glyph is written, then it locks. */
export const ASSEMBLY = { frameLead: 0.14, glyphStep: 0.18, lockAfter: 0.12 } as const;

/** Look-alike characters shown for a frame or two before the right one (decode glitch). */
const DECOY = "口日目田由甲申亅了丁乙子十卜工土士王圧凹凸しじむまみすさきらりろ";

/**
 * Schedules an assembly: frame → glyph 1 … glyph n → lock, emitting a UI cue
 * at each step (audio is synced to these). Returns how many glyphs are written
 * and whether the word has locked.
 */
export function useAssembly(total: number, tone: CardTone, lead: number = ASSEMBLY.frameLead) {
  const [written, setWritten] = useState(0);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    uiCues.emit({ type: "cardFrame" });
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < total; i++) {
      timers.push(
        setTimeout(() => {
          setWritten(i + 1);
          uiCues.emit({ type: "glyph", index: i, total, tone });
        }, (lead + i * ASSEMBLY.glyphStep) * 1000),
      );
    }
    timers.push(
      setTimeout(() => {
        setLocked(true);
        uiCues.emit({ type: "cardLock", tone });
      }, (lead + total * ASSEMBLY.glyphStep + ASSEMBLY.lockAfter) * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [total, tone, lead]);
  return { written, locked };
}

/**
 * One glyph being written, as in the show: it first appears as a wrong,
 * RGB-split character for a frame or two, then resolves into the right one
 * while the colour fringes settle.
 */
export function Glyph({ ch, decode = true }: { ch: string; decode?: boolean }) {
  const [decoy, setDecoy] = useState<string | null>(() =>
    decode ? DECOY[Math.floor(Math.random() * DECOY.length)] : null,
  );
  useEffect(() => {
    if (!decoy) return;
    const t = setTimeout(() => setDecoy(null), 55);
    return () => clearTimeout(t);
  }, [decoy]);
  return (
    <motion.span
      className={`glyph ${decoy ? "glyph--decoy" : "glyph--settle"}`}
      initial={{ opacity: 0, filter: "blur(8px)", x: -6, scale: 1.18 }}
      animate={{ opacity: [0, 1, 0.5, 1], filter: "blur(0px)", x: 0, scale: 1 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      {decoy ?? ch}
    </motion.span>
  );
}

/** Glyphs of `chars` from `offset`: written ones resolve, pending ones keep the layout. */
export function glyphRun(chars: string[], written: number, offset = 0) {
  return chars.map((ch, i) =>
    i + offset < written ? <Glyph key={i} ch={ch} /> : <span key={i} className="glyph glyph--pending">{ch}</span>,
  );
}

/**
 * Exit glitch for text blocks: 1–2 frames of shifted slices with an RGB split,
 * then gone (~140 ms) — the way the show tears text away.
 */
export const glitchOut = {
  opacity: [1, 1, 0.85, 0],
  x: [0, -10, 7, 0],
  clipPath: ["inset(0% 0% 0% 0%)", "inset(18% 0% 34% 0%)", "inset(56% 0% 8% 0%)", "inset(0% 0% 100% 0%)"],
  textShadow: [
    "0 0 0 rgba(0,0,0,0)",
    "-6px 0 rgba(255,42,109,0.9), 6px 0 rgba(5,217,232,0.9)",
    "5px 0 rgba(255,42,109,0.9), -5px 0 rgba(5,217,232,0.9)",
    "0 0 0 rgba(0,0,0,0)",
  ],
  transition: { duration: 0.14, ease: "linear" as const },
};
