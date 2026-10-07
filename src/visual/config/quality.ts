export type QualityLevel = "LOW" | "MEDIUM" | "HIGH" | "ULTRA";

export const QUALITY_LEVELS: readonly QualityLevel[] = ["LOW", "MEDIUM", "HIGH", "ULTRA"];

export interface QualitySettings {
  level: QualityLevel;
  /** Upper bound for the renderer pixel ratio (devicePixelRatio is clamped to it). */
  maxDpr: number;
  /** CPU-simulated energy motes. */
  motes: number;
  burst: number;
  /** GPU-only (shader-animated) elements. */
  stars: number;
  speedLines: number;
  panels: number;
  rain: number;
  /** UnrealBloom on/off and its internal resolution (fraction of the canvas). */
  bloom: boolean;
  bloomResolution: number;
  /** MSAA samples on the composer render target (0 = off). */
  msaa: number;
  /** fbm octaves in the nebula shader. */
  nebulaDetail: number;
  /** Prismatic lens flares. */
  flares: boolean;
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  LOW: {
    level: "LOW", maxDpr: 1, motes: 400, burst: 200, stars: 900, speedLines: 120, panels: 24, rain: 160,
    bloom: false, bloomResolution: 0.35, msaa: 0, nebulaDetail: 2, flares: false,
  },
  MEDIUM: {
    level: "MEDIUM", maxDpr: 1.5, motes: 900, burst: 400, stars: 1800, speedLines: 220, panels: 40, rain: 320,
    bloom: true, bloomResolution: 0.4, msaa: 0, nebulaDetail: 3, flares: true,
  },
  HIGH: {
    level: "HIGH", maxDpr: 2, motes: 1600, burst: 600, stars: 2800, speedLines: 320, panels: 64, rain: 500,
    bloom: true, bloomResolution: 0.5, msaa: 4, nebulaDetail: 4, flares: true,
  },
  ULTRA: {
    level: "ULTRA", maxDpr: 3, motes: 2600, burst: 900, stars: 4200, speedLines: 480, panels: 96, rain: 800,
    bloom: true, bloomResolution: 0.7, msaa: 4, nebulaDetail: 5, flares: true,
  },
};

export const DEFAULT_QUALITY: QualityLevel = "HIGH";
