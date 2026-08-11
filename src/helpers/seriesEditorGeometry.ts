/**
 * Geometry rules for the series editor's ordered list, as pure functions of
 * the OS font scale.
 *
 * They live here rather than as literals in the screen for the reason §H4's
 * cluster rule does: a geometry decision that only exists inside a StyleSheet
 * cannot be asserted, and both of these were DEVICE-FOUND at font scale 2.0
 * after passing every test that existed at the time.
 */

/** The box's width at font scale 1.0 — the device-A/B'd prototype metric. */
export const NUMBER_FIELD_BASE_WIDTH = 46;

/**
 * Past this the box stops growing. Android offers scales beyond 2.0, and the
 * row still has to hold a cover and a title; 2.0 is the bar this repo verifies
 * against, so it is where the box stops taking width from the title.
 */
const MAX_GROWTH = 2;

/**
 * DEVICE-FOUND (Pixel 7 Pro, font scale 2.0, 2026-08-11): `4.5` was CLIPPED in
 * the number box — the `4`'s upper-left diagonal cut off flat. The box was a
 * fixed 46dp while its contents scale with the font scale, so at 2x the text
 * outgrew the box it had to live in.
 *
 * Scaling the BOX rather than capping the TEXT is deliberate. Capping the text
 * would keep the geometry and shrink the number, which is an accessibility
 * regression on the exact control a user at 2x is trying to read — they raised
 * the font scale to make text bigger, so the number is the last thing that
 * should stay small. The title absorbs the loss instead, and it is already
 * truncating at 2x.
 */
export function numberFieldWidth(fontScale: number): number {
  const growth = Math.min(Math.max(fontScale, 1), MAX_GROWTH);
  return NUMBER_FIELD_BASE_WIDTH * growth;
}

/**
 * DEVICE-FOUND at the same time: at font scale 2.0 `Number 1-6` truncated to
 * `Number..` beside `Sort by number`. The count IS the label's content — it is
 * what tells you what pressing the button will do — so truncating it leaves a
 * control that explains nothing, on the one surface a user meets before they
 * understand the feature.
 *
 * Stacking, rather than shortening the label, keeps both controls whole. This
 * does NOT weaken ticket 15's "pinned right" decision: that decision forbids
 * the button moving when the NOTE's CONTENT changes, which the always-rendered
 * `flex: 1` slot still guarantees at every scale. Reflowing on font scale is a
 * different axis, and the button stays right-aligned on its own line.
 */
export function sortRowIsStacked(fontScale: number): boolean {
  return fontScale >= 1.5;
}
