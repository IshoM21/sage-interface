import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { dialogueFor, STATE_COPY } from "../app/stateCatalog";
import { SageActor } from "../hooks/sageActor";
import type { SageState } from "../machine/events";
import {
  selectAgentState,
  selectCompleteResolved,
  selectMessage,
  selectRetries,
  selectSummary,
} from "../machine/selectors";

const ease = [0.16, 1, 0.3, 1] as const;

const cardVariants = {
  enter: { opacity: 0, scale: 1.35, filter: "blur(10px)" },
  show: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.32, ease } },
  leave: (next: unknown) => ({
    opacity: 0,
    scale: 0.94,
    filter: "blur(6px)",
    transition: { duration: next ? 0.12 : 0.45 },
  }),
};
const CARD_MS = 1700;
/** How long the "Repeating attempt" frame and voice line stay readable. */
const RETRY_MS = 3000;

interface Card {
  id: number;
  kanji: string;
  label: string;
  tone: SageState | "RETRY";
}

/** Full-frame failure compositions: giant kanji flank the centre, a wordmark bleeds off the edges. */
const FRAMES: Partial<Record<Card["tone"], { left: string; right: string; center: string; word: string }>> = {
  CRITICAL: { left: "失", right: "敗", center: "Failed", word: "FAILURE" },
  RETRY: { left: "再度", right: "実行", center: "Repeating attempt", word: "RETRY" },
};

/**
 * Text layer of the interface:
 *  - a kanji state card that slams in on every transition and dissolves,
 *  - the voice: one formal dialogue line at the top,
 *  - a quiet persistent status at the bottom,
 *  - the QUESTION decision prompt.
 */
export function SageOverlay() {
  const state = SageActor.useSelector(selectAgentState);
  const message = SageActor.useSelector(selectMessage);
  const summary = SageActor.useSelector(selectSummary);
  const resolved = SageActor.useSelector(selectCompleteResolved);
  const retries = SageActor.useSelector(selectRetries);
  const [card, setCard] = useState<Card | null>(null);
  const [retryLine, setRetryLine] = useState(false);
  const seq = useRef(0);
  const lastCardState = useRef(state);
  const lastRetries = useRef(retries);

  // Card on state change (COMPLETE waits for the convergence to resolve).
  useEffect(() => {
    // Only on real transitions (not on mount, not on StrictMode re-runs).
    if (state === lastCardState.current && !(state === "COMPLETE" && resolved)) return;
    if (state === "COMPLETE" && !resolved) return;
    lastCardState.current = state;
    const c = STATE_COPY[state];
    const id = ++seq.current;
    setCard({ id, kanji: c.kanji, label: c.card, tone: state });
    const t = setTimeout(() => setCard((cur) => (cur?.id === id ? null : cur)), CARD_MS);
    return () => clearTimeout(t);
  }, [state, resolved]);

  // Retry beat.
  useEffect(() => {
    if (retries <= lastRetries.current) return;
    lastRetries.current = retries;
    const id = ++seq.current;
    setCard({ id, kanji: "再度実行", label: "Repeating attempt", tone: "RETRY" });
    setRetryLine(true);
    const t = setTimeout(() => {
      setCard((cur) => (cur?.id === id ? null : cur));
      setRetryLine(false);
    }, RETRY_MS);
    return () => clearTimeout(t);
  }, [retries]);

  const line = retryLine ? "Failed. Repeating attempt." : dialogueFor(state, { message, summary });
  const copy = STATE_COPY[state];

  return (
    <>
      <div className="dialogue" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.p
            key={line}
            className="dialogue__line"
            initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
            animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.55, ease }}
          >
            {line}
          </motion.p>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {card && FRAMES[card.tone] && <FailureFrame key={`f${card.id}`} tone={card.tone} />}
      </AnimatePresence>

      {/* `custom` = the incoming card: the outgoing one leaves fast when replaced. */}
      <AnimatePresence custom={card}>
        {card && !FRAMES[card.tone] && (
          <motion.div
            custom={card}
            variants={cardVariants}
            key={card.id}
            className={`card card--${card.tone.toLowerCase()}`}
            initial="enter"
            animate="show"
            exit="leave"
          >
            <span className={`card__kanji ${card.kanji.length > 2 ? "card__kanji--long" : ""}`}>{card.kanji}</span>
            <span className="card__label">{card.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="status">
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            className="status__inner"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.45, ease }}
          >
            <span className="status__kanji">{copy.kanji}</span>
            <span className="status__title">{copy.title}</span>
            <span className="status__caption">{copy.caption}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>{state === "QUESTION" && <QuestionPrompt key="q" message={message} />}</AnimatePresence>
    </>
  );
}

function FailureFrame({ tone }: { tone: Card["tone"] }) {
  const f = FRAMES[tone]!;
  const slam = { duration: 0.18, ease };
  return (
    <motion.div
      className={`fframe fframe--${tone.toLowerCase()}`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)", transition: { duration: 0.35 } }}
    >
      <motion.div
        className="fframe__word fframe__word--top"
        initial={{ x: "-12%", opacity: 0 }}
        animate={{ x: "0%", opacity: 1 }}
        transition={{ duration: 0.5, ease }}
      >
        {f.word.repeat(3)}
      </motion.div>
      <motion.div
        className="fframe__word fframe__word--bottom"
        initial={{ x: "12%", opacity: 0 }}
        animate={{ x: "0%", opacity: 1 }}
        transition={{ duration: 0.5, ease }}
      >
        {f.word.repeat(3)}
      </motion.div>
      <motion.span
        className="fframe__kanji fframe__kanji--left"
        initial={{ scale: 1.6, opacity: 0, filter: "blur(14px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={slam}
      >
        {f.left}
      </motion.span>
      <motion.span
        className="fframe__center"
        initial={{ opacity: 0, letterSpacing: "0.5em" }}
        animate={{ opacity: 1, letterSpacing: "0.04em" }}
        transition={{ duration: 0.4, ease, delay: 0.08 }}
      >
        {f.center}
      </motion.span>
      <motion.span
        className="fframe__kanji fframe__kanji--right"
        initial={{ scale: 1.6, opacity: 0, filter: "blur(14px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ ...slam, delay: 0.06 }}
      >
        {f.right}
      </motion.span>
    </motion.div>
  );
}

function QuestionPrompt({ message }: { message: string }) {
  const actor = SageActor.useActorRef();
  return (
    <motion.div
      className="question"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.25 } }}
      transition={{ duration: 0.55, ease, delay: CARD_MS / 1000 - 0.3 }}
    >
      {message && <div className="question__msg">{message}</div>}
      <div className="question__actions">
        <button className="btn btn--accept" onClick={() => actor.send({ type: "ui.accept" })}>
          ACCEPT <kbd>↵</kbd>
        </button>
        <button className="btn btn--reject" onClick={() => actor.send({ type: "ui.reject" })}>
          REJECT <kbd>esc</kbd>
        </button>
      </div>
    </motion.div>
  );
}
