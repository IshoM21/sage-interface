import { useEffect, useRef, useState, type RefObject } from "react";
import type { Actor } from "xstate";
import type { sageMachine } from "../machine/sageMachine";
import { selectAgentState } from "../machine/selectors";
import type { QualityLevel } from "../visual/config/quality";
import { VisualEngine } from "../visual/VisualEngine";

/**
 * Mounts the Three.js engine into `hostRef` and bridges the state machine to it
 * through a plain actor subscription — not React state — so machine updates
 * reach the renderer without re-rendering any component.
 */
export function useVisualEngine(
  hostRef: RefObject<HTMLDivElement | null>,
  actor: Actor<typeof sageMachine>,
  initialQuality: QualityLevel,
  onQualityChange: (q: QualityLevel) => void,
) {
  const [engine, setEngine] = useState<VisualEngine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qualityCb = useRef(onQualityChange);
  useEffect(() => {
    qualityCb.current = onQualityChange;
  }, [onQualityChange]);
  const initial = useRef(initialQuality);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let instance: VisualEngine | null = null;
    let unsubscribe: (() => void) | null = null;

    VisualEngine.create(host, { quality: initial.current, onQualityChange: (q) => qualityCb.current(q) }).then((e) => {
      if (disposed) {
        e.destroy();
        return;
      }
      instance = e;
      let lastMilestone: unknown = null;
      const apply = () => {
        const snap = actor.getSnapshot();
        e.setState(selectAgentState(snap));
        e.setSignals({
          activeModule: snap.context.activeModule,
          completedModules: snap.context.completedModules,
          retries: snap.context.retries,
          danger: snap.matches({ agent: "question" }) && snap.context.danger,
        });
        const m = snap.matches({ overlay: "milestone" }) ? snap.context.milestone : null;
        if (m && m !== lastMilestone) e.playMilestone();
        lastMilestone = m;
      };
      apply();
      unsubscribe = actor.subscribe(apply).unsubscribe;
      setEngine(e);
    }).catch((err: unknown) => {
      console.error("[sage] visual engine failed to start", err);
      if (!disposed) setError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      disposed = true;
      unsubscribe?.();
      instance?.destroy();
      setEngine(null);
    };
  }, [hostRef, actor]);

  return { engine, error };
}
