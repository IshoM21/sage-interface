import { motion } from "motion/react";
import { useEffect, useId } from "react";
import { uiCues } from "../app/uiCues";

/** Aperture timing (s), after S1E1 ~9:46 / 10:14. */
export const IRIS = { duration: 0.62 } as const;

const BLADES = 8;

/**
 * An aperture opening over the scene (an eye opening onto the analysis):
 * dark blades rotate and retract from the centre, revealing the scene, with
 * a thin bright rim at the edge of the opening.
 */
export function IrisOpen({ onDone }: { onDone: () => void }) {
  const mask = `iris-${useId().replace(/:/g, "")}`;
  useEffect(() => {
    uiCues.emit({ type: "iris" });
    const t = setTimeout(onDone, IRIS.duration * 1000 + 60);
    return () => clearTimeout(t);
  }, [onDone]);
  // A regular polygon hole (the aperture), scaled from closed to beyond the screen.
  const hole = Array.from({ length: BLADES }, (_, i) => {
    const a = (i / BLADES) * Math.PI * 2;
    return `${Math.cos(a) * 50},${Math.sin(a) * 50}`;
  }).join(" ");
  return (
    <svg className="iris" viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <mask id={mask}>
          <rect x={-200} y={-200} width={400} height={400} fill="white" />
          <motion.polygon
            points={hole}
            fill="black"
            initial={{ scale: 0.02, rotate: 0 }}
            animate={{ scale: 3.2, rotate: 70 }}
            transition={{ duration: IRIS.duration, ease: [0.55, 0, 0.2, 1] }}
          />
        </mask>
      </defs>
      <rect x={-200} y={-200} width={400} height={400} fill="#020306" mask={`url(#${mask})`} />
      {/* Blade seams: thin lines from the opening outward, rotating with it. */}
      <motion.g
        initial={{ rotate: 0, opacity: 0.9 }}
        animate={{ rotate: 70, opacity: 0 }}
        transition={{ duration: IRIS.duration, ease: [0.55, 0, 0.2, 1] }}
      >
        {Array.from({ length: BLADES }, (_, i) => {
          const a = (i / BLADES) * Math.PI * 2 + 0.25;
          return <line key={i} x1={0} y1={0} x2={Math.cos(a) * 160} y2={Math.sin(a) * 160} stroke="#1c2a33" strokeWidth={0.6} />;
        })}
      </motion.g>
      <motion.polygon
        points={hole}
        fill="none"
        stroke="rgba(214,255,255,0.9)"
        strokeWidth={0.8}
        initial={{ scale: 0.02, rotate: 0, opacity: 1 }}
        animate={{ scale: 3.2, rotate: 70, opacity: 0 }}
        transition={{ duration: IRIS.duration, ease: [0.55, 0, 0.2, 1] }}
      />
    </svg>
  );
}
