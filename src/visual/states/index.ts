import type { SageState } from "../../machine/events";
import { BASE_PARAMS, type VisualParams } from "../core/params";
import { analyzingVisual } from "./analyzingVisual";
import { completeVisual } from "./completeVisual";
import { criticalVisual } from "./criticalVisual";
import { executingVisual } from "./executingVisual";
import { listeningVisual } from "./listeningVisual";
import { questionVisual } from "./questionVisual";
import { readyVisual } from "./readyVisual";
import type { StateVisual } from "./types";
import { warningVisual } from "./warningVisual";

export type { StateVisual } from "./types";

export const STATE_VISUALS: Record<SageState, StateVisual> = {
  READY: readyVisual,
  LISTENING: listeningVisual,
  ANALYZING: analyzingVisual,
  EXECUTING: executingVisual,
  QUESTION: questionVisual,
  COMPLETE: completeVisual,
  WARNING: warningVisual,
  CRITICAL: criticalVisual,
};

/** Full parameter target for a state (BASE + state overrides). */
export function targetParams(state: SageState): VisualParams {
  return { ...BASE_PARAMS, ...STATE_VISUALS[state].params };
}
