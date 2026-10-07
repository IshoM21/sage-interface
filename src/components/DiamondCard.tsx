import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { CardTone } from "../app/uiCues";
import { glyphRun, useAssembly } from "./Assembly";

/**
 * Diamond birth timing (s), after the show (S2E11 ~12:15.3): a thin square
 * spins in → turns 45° into a diamond and doubles → ignites → content.
 */
export const DIAMOND = { trace: 0.2, turn: 0.32, inner: 0.24, ignite: 0.38, contentLead: 0.42 } as const;

const ease = [0.16, 1, 0.3, 1] as const;

interface FrameProps {
  tone: CardTone;
  children?: ReactNode;
  className?: string;
}

/**
 * The diamond frame alone: traced double outline + dark fill + bloom. The
 * square is born tilted, spins into a diamond while its stroke is drawn, a
 * second (inner) outline is traced, then it ignites with an RGB-split flicker.
 */
export function DiamondFrame({ tone, children, className = "" }: FrameProps) {
  return (
    <div className={`diamond diamond--${tone} ${className}`}>
      <motion.svg
        className="diamond__svg"
        viewBox="-60 -60 120 120"
        initial={{ rotate: -30, scale: 0.55 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: DIAMOND.turn, ease }}
      >
        <g transform="rotate(45)">
          <motion.rect
            className="diamond__fill"
            x={-37}
            y={-37}
            width={74}
            height={74}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: DIAMOND.trace, duration: 0.15 }}
          />
          <motion.rect
            className="diamond__outer"
            x={-40}
            y={-40}
            width={80}
            height={80}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: DIAMOND.trace, ease: "easeInOut" }}
          />
          <motion.rect
            className="diamond__inner"
            x={-34}
            y={-34}
            width={68}
            height={68}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: DIAMOND.trace * 0.6, duration: DIAMOND.inner, ease: "easeInOut" }}
          />
        </g>
      </motion.svg>
      {/* Ignition: a brief RGB-split bloom flicker once the outline is complete. */}
      <motion.div
        className="diamond__ignite"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.35, 0.6] }}
        transition={{ delay: DIAMOND.ignite, duration: 0.3, times: [0, 0.25, 0.6, 1] }}
      />
      <div className="diamond__content">{children}</div>
    </div>
  );
}

/** A state card: label above, kanji assembled inside the diamond (stacked vertically). */
export function DiamondCard({ text, label, tone }: { text: string; label: string; tone: CardTone }) {
  const chars = [...text];
  const { written, locked } = useAssembly(chars.length, tone, DIAMOND.contentLead);
  return (
    <div className="dcard">
      <motion.div
        className="dcard__label"
        initial={{ opacity: 0, y: 6 }}
        animate={locked ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.25 }}
      >
        {label}
      </motion.div>
      <DiamondFrame tone={tone}>
        <span className={`dcard__kanji dcard__kanji--n${Math.min(chars.length, 3)}`}>{glyphRun(chars, written)}</span>
      </DiamondFrame>
    </div>
  );
}
