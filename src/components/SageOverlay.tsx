import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { dialogueFor, STATE_COPY } from "../app/stateCatalog";
import { uiCues, type CardTone } from "../app/uiCues";
import { ASSEMBLY, glitchOut, glyphRun, useAssembly } from "./Assembly";
import { DIAMOND, DiamondCard } from "./DiamondCard";
import { DiscCard } from "./DiscCard";
import { IrisOpen } from "./IrisOpen";
import { CORRUPT } from "../shared/critical";
import { RETRY_PHASES } from "../shared/retry";
import { SageActor } from "../hooks/sageActor";
import type { SageState } from "../machine/events";
import {
  selectAgentState,
  selectCompleteResolved,
  selectDanger,
  selectMessage,
  selectMilestone,
  selectRetries,
  selectSummary,
} from "../machine/selectors";

const ease = [0.16, 1, 0.3, 1] as const;

/** Cards are born by the diamond itself; they leave tearing away (glitch) or dissolving. */
const cardVariants = {
  enter: { opacity: 1 },
  show: { opacity: 1 },
  leave: (next: unknown) =>
    next ? glitchOut : { opacity: 0, scale: 0.96, filter: "blur(6px)", transition: { duration: 0.4 } },
};
const CARD_HOLD_MS = 1150;
/** Total on-screen time of a card with `n` glyphs. */
const cardMs = (n: number) =>
  Math.round((DIAMOND.contentLead + n * ASSEMBLY.glyphStep + ASSEMBLY.lockAfter) * 1000) + CARD_HOLD_MS;

interface Card {
  id: number;
  kanji: string;
  label: string;
  tone: SageState | "RETRY" | "FAILED" | "REPORT";
  /** REPORT only: result items, appended one by one. */
  items?: ReportItem[];
}

interface ReportItem {
  jp: string;
  en: string;
}

/** Report timing (s): 報|告 assemble, then one result item every `itemStep`. */
const REPORT = { itemsAt: 0.65, itemStep: 0.55, hold: 2.2 } as const;

/** Builds the 報告 items from the finished task (S1E4 ~9:22 style). */
function reportItems(r: { summary: string; tools: number; retries: number }): ReportItem[] {
  const items: ReportItem[] = [
    { jp: "解析完了", en: r.summary && r.summary !== "ANALYSIS COMPLETE" ? capitalize(r.summary) : "Analysis complete" },
  ];
  if (r.tools > 0) items.push({ jp: `実行${r.tools}件`, en: `${r.tools} tool${r.tools === 1 ? "" : "s"} run` });
  if (r.retries > 0) items.push({ jp: `再試行${r.retries}件`, en: `${r.retries} ${r.retries === 1 ? "retry" : "retries"}` });
  items.push({ jp: "異常なし", en: "No anomalies" });
  return items;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Full-frame failure compositions: giant kanji flank the centre, a wordmark bleeds off the edges. */
const FRAMES: Partial<Record<Card["tone"], { left: string; right: string; center: string; word: string }>> = {
  CRITICAL: { left: "失", right: "敗", center: "Failed", word: "FAILURE" },
  FAILED: { left: "失", right: "敗", center: "Failed", word: "FAILURE" },
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
  const danger = SageActor.useSelector(selectDanger);
  const actorRef = SageActor.useActorRef();
  // The milestone has its own voice line; the regular one steps aside meanwhile.
  const inMilestone = SageActor.useSelector(selectMilestone) !== null;
  const [card, setCard] = useState<Card | null>(null);
  const [retryLine, setRetryLine] = useState<string | null>(null);
  const retryUntil = useRef(0);
  const retryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);
  const lastCardState = useRef(state);
  const lastRetries = useRef(retries);
  // Entering analysis: an aperture opens over the scene.
  const [iris, setIris] = useState(0);
  const lastIrisState = useRef(state);
  useEffect(() => {
    if (state === lastIrisState.current) return;
    lastIrisState.current = state;
    if (state !== "ANALYZING") return;
    const t = setTimeout(() => setIris((n) => n + 1), 0);
    return () => clearTimeout(t);
  }, [state]);
  const endIris = useCallback(() => setIris(0), []);

  // Card on state change (COMPLETE waits for the convergence to resolve).
  useEffect(() => {
    // Only on real transitions (not on mount, not on StrictMode re-runs).
    if (state === lastCardState.current && !(state === "COMPLETE" && resolved)) return;
    if (state === "COMPLETE" && !resolved) return;
    lastCardState.current = state;
    // A new state supersedes any retry cycle still playing in the overlay.
    retryTimers.current.forEach(clearTimeout);
    retryTimers.current = [];
    retryUntil.current = 0;
    const clearRetry = setTimeout(() => setRetryLine(null), 0);
    // Dangerous decisions speak with Great Sage's own warning mark: 告.
    const c = danger ? { kanji: "告", card: "Warning" } : STATE_COPY[state];
    const id = ++seq.current;
    // Completion: a 報告 report of the task instead of a single card.
    if (state === "COMPLETE") {
      const ctx = actorRef.getSnapshot().context;
      const items = reportItems({ summary: ctx.summary, tools: ctx.toolsRun, retries: ctx.taskRetries });
      const showR = setTimeout(() => setCard({ id, kanji: "報告", label: "Report", tone: "REPORT", items }), 0);
      const hideR = setTimeout(
        () => setCard((cur) => (cur?.id === id ? null : cur)),
        (REPORT.itemsAt + items.length * REPORT.itemStep + REPORT.hold) * 1000,
      );
      return () => {
        clearTimeout(clearRetry);
        clearTimeout(showR);
        clearTimeout(hideR);
      };
    }
    // CRITICAL: the failure frame lands after the corrupted-data interlude.
    const delay = state === "CRITICAL" ? CORRUPT.duration * 1000 : 0;
    // During the interlude the previous card is cleared right away.
    const clear = setTimeout(() => delay && setCard(null), 0);
    const show = setTimeout(() => setCard({ id, kanji: c.kanji, label: c.card, tone: danger ? "WARNING" : state }), delay);
    // A dangerous decision keeps its 告 mark in the centre until it is answered.
    const hide = danger
      ? undefined
      : setTimeout(() => setCard((cur) => (cur?.id === id ? null : cur)), delay + cardMs([...c.kanji].length));
    return () => {
      clearTimeout(clearRetry);
      clearTimeout(clear);
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [state, resolved, danger, actorRef]);

  // Retry beat: FAILED → REPEATING ATTEMPT → attempt (timed with the renderer, shared/retry.ts).
  // Retries arriving while a cycle plays only escalate the visual montage.
  useEffect(() => {
    if (retries <= lastRetries.current) return;
    lastRetries.current = retries;
    const now = performance.now();
    if (now < retryUntil.current) return;
    retryUntil.current = now + RETRY_PHASES.end * 1000;
    retryTimers.current.forEach(clearTimeout);
    const at = (s: number, fn: () => void) => retryTimers.current.push(setTimeout(fn, s * 1000));
    at(RETRY_PHASES.failedAt, () => {
      setCard({ id: ++seq.current, kanji: "失敗", label: "Failed", tone: "FAILED" });
      setRetryLine("Failed.");
    });
    at(RETRY_PHASES.repeatAt, () => {
      setCard({ id: ++seq.current, kanji: "再度実行", label: "Repeating attempt", tone: "RETRY" });
      setRetryLine("Failed. Repeating attempt.");
    });
    at(RETRY_PHASES.attemptAt, () => setCard(null));
    at(RETRY_PHASES.end, () => setRetryLine(null));
  }, [retries]);
  useEffect(() => () => retryTimers.current.forEach(clearTimeout), []);

  const line =
    retryLine ?? (danger ? "Warning. A dangerous operation requires your approval." : dialogueFor(state, { message, summary }));
  const copy = STATE_COPY[state];

  return (
    <>
      {iris > 0 && <IrisOpen key={iris} onDone={endIris} />}
      <div className="dialogue" aria-live="polite">
        <AnimatePresence mode="wait">
          {!inMilestone && <motion.p
            key={line}
            className="dialogue__line"
            initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
            animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }}
            exit={glitchOut}
            transition={{ duration: 0.55, ease }}
          >
            {line}
          </motion.p>}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {card && FRAMES[card.tone] && <FailureFrame key={`f${card.id}`} tone={card.tone} />}
        {card?.tone === "REPORT" && card.items && <ReportFrame key={`r${card.id}`} items={card.items} />}
      </AnimatePresence>

      {/* `custom` = the incoming card: the outgoing one leaves fast when replaced. */}
      <AnimatePresence custom={card}>
        {card && !FRAMES[card.tone] && card.tone !== "REPORT" && (
          <motion.div
            custom={card}
            variants={cardVariants}
            key={card.id}
            className={`card-slot card--${card.tone.toLowerCase()}`}
            initial="enter"
            animate="show"
            exit="leave"
          >
            {/* Answers speak in the white disc; warnings in the diamond (告). */}
            {toneOf(card.tone) === "calm" ? (
              <DiscCard text={card.kanji} label={card.label} tone="calm" />
            ) : (
              <DiamondCard text={card.kanji} label={card.label} tone={toneOf(card.tone)} />
            )}
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

const toneOf = (t: Card["tone"]): CardTone =>
  t === "CRITICAL" || t === "FAILED" ? "failure" : t === "RETRY" ? "retry" : t === "WARNING" ? "warning" : "calm";

/**
 * 報告 — the report (S1E4 ~9:22): giant 報 and 告 flank the centre, where the
 * results line grows item by item («A、B、C»), each one "printed" with the
 * assembly sound, an English line underneath.
 */
function ReportFrame({ items }: { items: ReportItem[] }) {
  const { written } = useAssembly(2, "calm", 0.08);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = items.map((_, i) =>
      setTimeout(() => {
        setShown(i + 1);
        uiCues.emit({ type: "glyph", index: i, total: items.length, tone: "calm" });
        if (i === items.length - 1) setTimeout(() => uiCues.emit({ type: "cardLock", tone: "calm" }), 180);
      }, (REPORT.itemsAt + i * REPORT.itemStep) * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [items]);
  return (
    <motion.div className="fframe fframe--report" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={glitchOut}>
      <span className="fframe__kanji fframe__kanji--left">{glyphRun(["報"], written)}</span>
      <div className="report">
        <div className="report__jp">
          {items.slice(0, shown).map((it, i) => (
            <motion.span key={i} className="report__item" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              {i > 0 ? "、" : ""}
              {it.jp}
            </motion.span>
          ))}
        </div>
        <div className="report__en">{items.slice(0, shown).map((it) => it.en).join(" · ")}</div>
      </div>
      <span className="fframe__kanji fframe__kanji--right">{glyphRun(["告"], written, 1)}</span>
    </motion.div>
  );
}

function FailureFrame({ tone }: { tone: Card["tone"] }) {
  const f = FRAMES[tone]!;
  const left = [...f.left];
  const right = [...f.right];
  const { written, locked } = useAssembly(left.length + right.length, toneOf(tone), 0.08);
  const shown = (chars: string[], offset: number) => glyphRun(chars, written, offset);
  return (
    <motion.div
      className={`fframe fframe--${tone.toLowerCase()}`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={glitchOut}
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
      <span className="fframe__kanji fframe__kanji--left">{shown(left, 0)}</span>
      <motion.span
        className="fframe__center"
        initial={{ opacity: 0, letterSpacing: "0.5em" }}
        animate={locked ? { opacity: 1, letterSpacing: "0.04em" } : { opacity: 0, letterSpacing: "0.5em" }}
        transition={{ duration: 0.3, ease }}
      >
        {f.center}
      </motion.span>
      <span className="fframe__kanji fframe__kanji--right">{shown(right, left.length)}</span>
    </motion.div>
  );
}

/**
 * Great Sage's own question form (S1E1 ~15:47): the question in large serif,
 * and a ▸YES / NO choice with a framed cursor. ←/→ (or ↑/↓, Tab) move the
 * cursor, Enter confirms, Esc answers NO. Mouse works too.
 */
function QuestionPrompt({ message }: { message: string }) {
  const actor = SageActor.useActorRef();
  const [choice, setChoice] = useState<"yes" | "no">("yes");
  const choiceRef = useRef(choice);
  useEffect(() => {
    choiceRef.current = choice;
  }, [choice]);
  const answer = useCallback(
    (c: "yes" | "no") => {
      uiCues.emit({ type: "cardLock", tone: "calm" });
      actor.send({ type: c === "yes" ? "ui.accept" : "ui.reject" });
    },
    [actor],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"].includes(e.key)) {
        e.preventDefault();
        setChoice((c) => (c === "yes" ? "no" : "yes"));
        uiCues.emit({ type: "key", wrong: false });
      } else if (e.key === "Enter") {
        e.preventDefault();
        answer(choiceRef.current);
      } else if (e.key === "Escape") {
        e.preventDefault();
        answer("no");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  return (
    <motion.div
      className="question"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={glitchOut}
      transition={{ duration: 0.55, ease, delay: cardMs(1) / 1000 - 0.3 }}
    >
      <div className="question__kicker">Question</div>
      {message && <div className="question__text">{message}</div>}
      <div className="question__choices" role="radiogroup">
        {(["yes", "no"] as const).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={choice === c}
            className={`choice ${choice === c ? "choice--on" : ""}`}
            onMouseEnter={() => setChoice(c)}
            onClick={() => answer(c)}
          >
            <span className="choice__cursor">{choice === c ? "▸" : ""}</span>
            {c.toUpperCase()}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
