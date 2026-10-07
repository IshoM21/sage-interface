import type { SageState } from "../../machine/events";

/**
 * Per-state palette, split by *role* so every system colors itself
 * consistently and transitions can propagate role by role.
 */
export interface Palette {
  primary: number;
  secondary: number;
  accent: number;
  core: number;
  dim: number;
  /** Nebula, deep tone (blue). */
  field: number;
  /** Nebula, secondary tone (green/teal). */
  field2: number;
}

export const ROLES = ["primary", "secondary", "accent", "core", "dim", "field", "field2"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE = { primary: 0, secondary: 1, accent: 2, core: 3, dim: 4, field: 5, field2: 6 } as const;

export const BACKGROUND = { deep: 0x010205, mid: 0x02070d, high: 0x040c14 } as const;

export const PALETTES: Record<SageState, Palette> = {
  READY: { primary: 0x4ce4df, secondary: 0x58ddd8, accent: 0xcffaf8, core: 0xeaffff, dim: 0x1b5f5d, field: 0x061d36, field2: 0x05302b },
  LISTENING: { primary: 0x62eeff, secondary: 0x4ce4df, accent: 0xd8fbff, core: 0xf2ffff, dim: 0x1d6f7a, field: 0x082a4a, field2: 0x063c3e },
  ANALYZING: { primary: 0x69fff0, secondary: 0x7fb8ff, accent: 0xffffff, core: 0xffffff, dim: 0x1f7a72, field: 0x0b3360, field2: 0x0d5a3a },
  EXECUTING: { primary: 0x4ebeff, secondary: 0x69fff0, accent: 0xe6f6ff, core: 0xffffff, dim: 0x1a527a, field: 0x0a2f62, field2: 0x08445a },
  QUESTION: { primary: 0xf7f2d0, secondary: 0x8fd9d2, accent: 0xfffbe8, core: 0xfffdf2, dim: 0x4e5248, field: 0x121820, field2: 0x1b2216 },
  COMPLETE: { primary: 0xd6ffff, secondary: 0xffffff, accent: 0xffffff, core: 0xffffff, dim: 0x5e8a8a, field: 0x0a2456, field2: 0x0b3166 },
  WARNING: { primary: 0xffab3d, secondary: 0xffd37a, accent: 0xffe6b0, core: 0xfff0d6, dim: 0x6a4418, field: 0x2a1606, field2: 0x261d07 },
  CRITICAL: { primary: 0xff4050, secondary: 0xff7680, accent: 0xffffff, core: 0xffeef0, dim: 0x5a1a20, field: 0x2a0408, field2: 0x1c0412 },
};

/** Solemn: dangerous decisions — pale light, amber accents, an almost black field. */
export const SOLEMN: Palette = {
  primary: 0xe9dcbc, secondary: 0x98a8b6, accent: 0xffb84a, core: 0xfff1d6, dim: 0x3a3326, field: 0x07080c, field2: 0x0e0b07,
};

/** Ceremonial gold, used only by the milestone ("ultimate") sequence. */
export const GOLD: Palette = {
  primary: 0xffb23c, secondary: 0xffd27a, accent: 0xfff4d6, core: 0xffffff, dim: 0x6a3a10, field: 0x2c1204, field2: 0x3a1a06,
};
