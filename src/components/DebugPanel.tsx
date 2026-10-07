import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { SageActor } from "../hooks/sageActor";
import { selectAgentState } from "../machine/selectors";
import { QUALITY_LEVELS, type QualityLevel } from "../visual/config/quality";
import type { EngineMetrics } from "../visual/core/Metrics";
import type { VisualEngine } from "../visual/VisualEngine";

interface Props {
  engine: VisualEngine | null;
  quality: QualityLevel;
  onQuality: (q: QualityLevel) => void;
  adaptive: boolean;
  onAdaptive: (v: boolean) => void;
}

/**
 * Metrics overlay. Polls the engine at 4 Hz — the only React re-render driven
 * by the renderer, and it's bounded and cheap.
 */
export function DebugPanel({ engine, quality, onQuality, adaptive, onAdaptive }: Props) {
  const state = SageActor.useSelector(selectAgentState);
  const [m, setM] = useState<EngineMetrics | null>(null);

  useEffect(() => {
    if (!engine) return;
    const id = setInterval(() => setM(engine.getMetrics()), 250);
    return () => clearInterval(id);
  }, [engine]);

  const fpsClass = !m ? "" : m.fps >= 57 ? "ok" : m.fps >= 45 ? "warn" : "bad";
  return (
    <motion.aside
      className="panel debug"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <header className="panel__head">
        DEBUG <span className="muted">D</span>
      </header>
      <dl className="metrics">
        <dt>FPS</dt>
        <dd className={fpsClass}>{m ? m.fps.toFixed(0) : "—"}</dd>
        <dt>FRAME</dt>
        <dd>{m ? `${m.frameMs.toFixed(2)} ms` : "—"}</dd>
        <dt>CPU</dt>
        <dd>{m ? `${m.cpuMs.toFixed(2)} ms` : "—"}</dd>
        <dt>PARTICLES / INST.</dt>
        <dd>{m ? m.particles.toLocaleString() : "—"}</dd>
        <dt>DRAW CALLS</dt>
        <dd>{m ? m.drawCalls : "—"}</dd>
        <dt>TRIANGLES</dt>
        <dd>{m ? m.triangles.toLocaleString() : "—"}</dd>
        <dt>STATE</dt>
        <dd>{state}</dd>
        <dt>RESOLUTION</dt>
        <dd>{m ? `${m.width}×${m.height}` : "—"}</dd>
        <dt>DPR</dt>
        <dd>{m ? `${m.resolution.toFixed(2)} / ${m.devicePixelRatio.toFixed(2)}` : "—"}</dd>
        <dt>RENDERER</dt>
        <dd>{m?.renderer ?? "—"}</dd>
      </dl>
      <header className="panel__head">QUALITY</header>
      <div className="controls__row">
        {QUALITY_LEVELS.map((q) => (
          <button key={q} className={`chip chip--small ${q === quality ? "chip--on" : ""}`} onClick={() => onQuality(q)}>
            {q}
          </button>
        ))}
      </div>
      <label className="toggle">
        <input type="checkbox" checked={adaptive} onChange={(e) => onAdaptive(e.target.checked)} />
        ADAPTIVE QUALITY
      </label>
    </motion.aside>
  );
}
