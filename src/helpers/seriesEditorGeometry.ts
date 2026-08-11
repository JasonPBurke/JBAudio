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

/**
 * The series cover control's box — §D6. The prototype's device-A/B'd metric,
 * carried over unchanged.
 *
 * A CONSTANT, not a function of the font scale, and that is the difference
 * between this and `numberFieldWidth`. The number box holds TEXT, so text that
 * grows must be given room or it clips. This box holds an IMAGE, which does
 * not grow — scaling it with the font scale would make a cover balloon to a
 * third of the header on a user who asked for larger words, taking the room
 * from the caption that actually is text.
 */
export const COVER_BOX_SIZE = 88;

/**
 * Whether the editor's cover + name row stacks — §D6, §D7.
 *
 * At font scale 1.0 the cover sits beside the name field with its caption
 * beneath it, in an 88dp column: `Using first book’s cover` takes two lines
 * there and the whole block is about 114dp tall.
 *
 * That column is what breaks first as the scale rises. The caption is the
 * screen's smallest type (10px, so it can sit under a field without competing
 * with it) and its width is fixed by the cover it belongs to, so at 2.0 it
 * wraps to four or five lines and a header that also carries a title, a name
 * field, an instruction and a stacked sort row pushes the ordered list — the
 * thing the screen is FOR — off the bottom of a phone. The header does not
 * scroll.
 *
 * So past the threshold the column becomes a ROW: cover left, caption filling
 * the rest of the width beside it, name field full-width beneath. Same three
 * elements, reflowed, and the caption gets ~280dp instead of 88dp — which is
 * the difference between two lines and five. The cover keeps its size, so the
 * revert target does not shrink on the user who needs it biggest.
 *
 * The 1.5 threshold is `sortRowIsStacked`'s, deliberately: two reflows in one
 * header that trigger at different scales would produce a third layout that
 * nobody designed and nobody has looked at on a device.
 */
export function identityRowIsStacked(fontScale: number): boolean {
  return fontScale >= 1.5;
}
