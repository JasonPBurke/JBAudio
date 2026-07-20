/**
 * Playback-rate domain constants and pure helpers.
 *
 * Every rate write in the app must pass through quantizeRate() — repeated
 * ±0.05 stepping accumulates IEEE-754 drift (1.05 + 0.05*3 =
 * 1.2000000000000002), which would break exact-equality preset highlighting
 * and produce garbage display strings.
 */

export const RATE_MIN = 0.5;
export const RATE_MAX = 2.5;
export const RATE_STEP = 0.05;
export const RATE_PRESETS = [1.0, 1.25, 1.5, 1.75, 2.0] as const;

/** Clamp to [RATE_MIN, RATE_MAX] and snap to the 0.05 grid. */
export function quantizeRate(rate: number): number {
  const clamped = Math.min(RATE_MAX, Math.max(RATE_MIN, rate));
  return Math.round(clamped * 20) / 20;
}

/** Trimmed display string: 1 → '1x', 1.5 → '1.5x', 1.35 → '1.35x'. */
export function formatRate(rate: number): string {
  return `${quantizeRate(rate)
    .toFixed(2)
    .replace(/\.?0+$/, '')}x`;
}

export type SpeedTapAction =
  | { kind: 'set'; rate: number }
  | { kind: 'openSheet' };

/**
 * The gauge icon's short-press contract: an active custom speed
 * deactivates to 1x; at 1x the saved speed toggles back on; with no
 * saved speed (fresh install) the tap falls through to the options
 * sheet. Long-press opens the sheet unconditionally and bypasses this.
 */
export function resolveSpeedTap(
  rate: number,
  lastNonDefaultRate: number | null,
): SpeedTapAction {
  if (rate !== 1) return { kind: 'set', rate: 1 };
  if (lastNonDefaultRate !== null && lastNonDefaultRate !== 1) {
    return { kind: 'set', rate: lastNonDefaultRate };
  }
  return { kind: 'openSheet' };
}
