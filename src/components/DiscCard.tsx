import { motion } from "motion/react";
import { useId } from "react";
import type { CardTone } from "../app/uiCues";
import { glyphRun, useAssembly } from "./Assembly";

/**
 * Disc birth timing (s), after the show (S1E1 ~9:30): a dark aperture shows a
 * thin crescent of light that waxes into a full white disc, then the kanji
 * are written on it in black.
 */
export const DISC = { wax: 0.42, contentLead: 0.4 } as const;

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Great Sage's answer emblem: a white disc (light) with dark serif kanji — the
 * inverse of the warning diamond. Used for answers and confirmations.
 */
export function DiscCard({ text, label, tone }: { text: string; label: string; tone: CardTone }) {
  const chars = [...text];
  const { written, locked } = useAssembly(chars.length, tone, DISC.contentLead);
  const mask = `disc-mask-${useId().replace(/:/g, "")}`;
  return (
    <div className={`disc disc--${tone}`}>
      <svg className="disc__svg" viewBox="-60 -60 120 120">
        <defs>
          <mask id={mask}>
            <rect x={-60} y={-60} width={120} height={120} fill="white" />
            {/* The shadow slides off: crescent → full moon. */}
            <motion.circle
              r={47}
              cy={0}
              fill="black"
              initial={{ cx: -14 }}
              animate={{ cx: -110 }}
              transition={{ duration: DISC.wax, ease }}
            />
          </mask>
        </defs>
        <motion.circle
          className="disc__halo"
          r={50}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 1, 0.55], scale: 1 }}
          transition={{ duration: DISC.wax + 0.2 }}
        />
        <circle className="disc__face" r={46} mask={`url(#${mask})`} />
        <motion.circle
          className="disc__rim"
          r={46}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: DISC.wax, ease: "easeInOut" }}
        />
      </svg>
      <div className="disc__content">
        <span className={`disc__kanji dcard__kanji--n${Math.min(chars.length, 3)}`}>{glyphRun(chars, written)}</span>
        <motion.span
          className="disc__label"
          initial={{ opacity: 0 }}
          animate={{ opacity: locked ? 1 : 0 }}
          transition={{ duration: 0.25 }}
        >
          {label}
        </motion.span>
      </div>
    </div>
  );
}
