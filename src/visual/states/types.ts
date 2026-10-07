import type { SageState } from "../../machine/events";
import type { Palette } from "../config/palettes";
import type { WaveLeg } from "../core/PaletteField";
import type { RateMap, VisualParams } from "../core/params";

/**
 * Declarative description of one state's look. Everything is data: the
 * engine eases toward `params` and recolors with a `wave`. Choreography lives
 * in TransitionController.
 */
export interface StateVisual {
  state: SageState;
  palette: Palette;
  params: Partial<VisualParams>;
  /** Per-parameter easing rates (1/s). Higher = snappier. */
  rates?: RateMap;
  defaultRate?: number;
  /** Palette wave legs (see PaletteField). */
  wave?: WaveLeg[];
  /** Delay before the palette wave starts (s). */
  waveDelay?: number;
}
