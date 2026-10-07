import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { uiCues } from "../app/uiCues";
import { IDENTITY } from "../config/identity";
import { glyphRun, useAssembly } from "./Assembly";
import { DIAMOND, DiamondFrame } from "./DiamondCard";

/** Identity sequence timing (s), after the show's identity diamond (S2E11 ~12:17.5). */
export const IDENTITY_TIMING = { typeStart: 0.85, keyStep: 0.055, hold: 0.9, dissolve: 0.4 } as const;

/** Typing frames for `word`, with two "wrong key → corrected" moments (e.g. SAH → SAG). */
function typingFrames(word: string): { text: string; wrong: boolean }[] {
  const frames: { text: string; wrong: boolean }[] = [];
  const letters = [...word];
  const n = letters.length;
  const typos = new Set([Math.max(2, Math.floor(n * 0.3)), Math.max(3, Math.floor(n * 0.75))]);
  const alphabet = "ABCDEFGHIKLMNOPRSTUVWXYZ";
  for (let i = 1; i <= n; i++) {
    if (typos.has(i) && letters[i - 1] !== " ") {
      const wrong = alphabet[(alphabet.indexOf(letters[i - 1]) + 3 + alphabet.length) % alphabet.length] ?? "X";
      frames.push({ text: letters.slice(0, i - 1).join("") + wrong, wrong: true });
    }
    frames.push({ text: letters.slice(0, i).join(""), wrong: false });
  }
  return frames;
}

/** Total duration (s) of the identity sequence. */
export function identityDuration(): number {
  const keys = typingFrames(IDENTITY.name).length;
  return IDENTITY_TIMING.typeStart + keys * IDENTITY_TIMING.keyStep + IDENTITY_TIMING.hold + IDENTITY_TIMING.dissolve;
}

/**
 * Identity: the diamond is born, the identity kanji is assembled inside with
 * a vertical reading label, the latin name is typed (with corrected typos),
 * then everything dissolves into light. Driven by config/identity.ts.
 */
export function IdentityIntro({ onDone }: { onDone: () => void }) {
  const kanji = [...IDENTITY.kanji];
  const { written, locked } = useAssembly(kanji.length, "calm", DIAMOND.contentLead);
  const frames = useMemo(() => typingFrames(IDENTITY.name), []);
  const [typed, setTyped] = useState({ text: "", wrong: false });
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    frames.forEach((f, i) =>
      timers.push(
        setTimeout(() => {
          setTyped(f);
          uiCues.emit({ type: "key", wrong: f.wrong });
        }, (IDENTITY_TIMING.typeStart + i * IDENTITY_TIMING.keyStep) * 1000),
      ),
    );
    const typedEnd = IDENTITY_TIMING.typeStart + frames.length * IDENTITY_TIMING.keyStep;
    timers.push(setTimeout(() => setLeaving(true), (typedEnd + IDENTITY_TIMING.hold) * 1000));
    timers.push(setTimeout(() => done.current(), (typedEnd + IDENTITY_TIMING.hold + IDENTITY_TIMING.dissolve) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [frames]);

  return (
    <motion.div
      className="identity"
      initial={{ opacity: 1 }}
      animate={leaving ? { opacity: 0, scale: 1.08, filter: "blur(10px) brightness(2.2)" } : { opacity: 1 }}
      transition={{ duration: IDENTITY_TIMING.dissolve, ease: "easeIn" }}
    >
      <DiamondFrame tone="calm" className="identity__diamond">
        <span className={`identity__kanji dcard__kanji--n${Math.min(kanji.length, 3)}`}>{glyphRun(kanji, written)}</span>
        <motion.span
          className="identity__vertical"
          initial={{ opacity: 0 }}
          animate={{ opacity: locked ? 0.9 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {IDENTITY.verticalLabel}
        </motion.span>
      </DiamondFrame>
      <div className={`identity__name ${typed.wrong ? "identity__name--wrong" : ""}`}>
        {typed.text}
        <span className="identity__caret" />
      </div>
    </motion.div>
  );
}
