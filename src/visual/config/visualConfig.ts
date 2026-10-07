/**
 * World layout (Three.js units). The camera looks down -Z at the origin; the
 * "seal plane" sits at z = 0 and the camera is placed so that a disc of radius
 * FIELD.fitRadius always fits the shorter side of the window.
 */
export const FIELD = {
  fitRadius: 5.3,
  coreRadius: 0.35,
  /** Outermost radius used by palette waves. */
  waveMax: 11,
} as const;

export const CAMERA = {
  fov: 45,
  near: 0.1,
  far: 200,
} as const;

/** The 2D seal (drawn on the z = 0 plane, gently tilted as a whole). */
export const SEAL = {
  seedSquare: 0.95,
  rhombus: 2.55,
  circle: 2.95,
  innerCircle: 1.05,
  scriptInner: 3.2,
  scriptOuter: 3.85,
  moduleRadius: 4.2,
} as const;

/** Armillary bands: radius, band height, tilt axes (radians). */
export const ARMILLARY = [
  { r: 1.45, h: 0.32, tiltX: 1.15, tiltY: 0.35, speed: 0.55, sides: 128 },
  { r: 1.85, h: 0.22, tiltX: -0.75, tiltY: 0.95, speed: -0.4, sides: 128 },
  { r: 2.2, h: 0.14, tiltX: 0.35, tiltY: -1.2, speed: 0.3, sides: 128 },
  { r: 1.62, h: 0.06, tiltX: 1.4, tiltY: 0.15, speed: 0.15, sides: 8 }, // octagonal frame
] as const;

export const TUNNEL = {
  rMin: 2.6,
  rMax: 9,
  zFar: -70,
  zNear: 7,
} as const;

export const ENGINE = {
  /** Clamp dt so a stalled frame never explodes the simulation. */
  maxDt: 1 / 20,
  /** Adaptive quality: sustained average frame time (ms) that triggers a downgrade. */
  adaptiveDowngradeMs: 21,
  adaptiveWindowS: 3,
  /** Camera parallax amplitude (world units). */
  parallax: 0.35,
} as const;

export const MODULE_LABELS = ["READ", "WRITE", "EXEC", "BUILD", "TEST"] as const;

/** Module sigils sit on the lower arc of the seal, left → right. */
export const MODULE_ANGLES = MODULE_LABELS.map((_, i) => -Math.PI / 2 - ((i - 2) * Math.PI) / 5.2);
