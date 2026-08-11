import { TinyColor, readability } from '@ctrl/tinycolor';

/**
 * K15 — THE DISABLED-BUTTON LABEL IS INVISIBLE, and it is a colour collision
 * rather than a rendering fault.
 *
 * The dark palette sets `textMuted` and `divider` to the SAME `#d8dee9`
 * (`src/constants/tokens.ts`). Every disabled control in this app painted its
 * fill with `divider` and its label with `textMuted`, so the text was drawn in
 * exactly its own background: measured, 1.00:1. Light theme pairs `#4B5563` on
 * `#9CA3AF` for 2.98:1 — legible enough that nobody filed it, and still under
 * AA, which is why this is NOT the dark-theme-only defect it was reported as.
 *
 * The fix is to stop using an opaque token as the fill. A disabled control is a
 * FAINT TINT OF THE DIVIDER OVER THE SCREEN'S OWN BACKGROUND, which moves the
 * fill away from the label in both themes at once instead of picking a special
 * colour per theme.
 *
 * ⚠ The mix is resolved to an OPAQUE hex here, not returned as an alpha colour.
 * An `rgba` fill would composite over whatever happens to sit behind the
 * control, so its real contrast would depend on the parent — and could not be
 * asserted in jest at all, which is the whole reason this seam exists.
 */

/** How much divider is mixed into the background, as a percentage. */
const DISABLED_TINT = 24;

export type DisabledControlColors = {
  /** Opaque background for the disabled control. */
  fill: string;
  /** Label colour, guaranteed to clear WCAG AA against `fill`. */
  label: string;
};

export function disabledControlColors(tokens: {
  background: string;
  divider: string;
  textMuted: string;
}): DisabledControlColors {
  return {
    fill: new TinyColor(tokens.background)
      .mix(tokens.divider, DISABLED_TINT)
      .toHexString(),
    label: tokens.textMuted,
  };
}

/** WCAG AA for normal text — the floor a disabled label must still clear. */
const AA = 4.5;

/**
 * A disabled BARE TEXT control's label — one with no fill of its own, so the
 * label colour is the only signal it has.
 *
 * DEVICE-FOUND (2026-08-11): using `textMuted` here measured 12.57:1 in dark
 * and 6.14:1 in light — legible, and MORE prominent than body text, so the
 * control read as active. `textMuted` is `#d8dee9` in the dark palette, which
 * is essentially white; "the muted one" is a trap in a bag where the muted
 * token was chosen for a dark ground.
 *
 * ⚠ THE TARGET IS NOT "less prominent than the ENABLED colour." The accent is
 * user-settable and may be derived from cover art, so it is a free variable —
 * an implementation aimed at it would drift with somebody's palette. Both
 * bounds are stated against fixed tokens instead:
 *
 *   floor   — clears AA against the surface, so K15 cannot come back;
 *   ceiling — sits below body text on that same surface, so it reads as off.
 *
 * Found by walking the blend toward the surface and stopping at the last step
 * that still clears the floor: the most recessive colour the floor allows.
 */
export function disabledTextColor(tokens: {
  background: string;
  textMuted: string;
}): string {
  const surface = tokens.background;
  let result = new TinyColor(tokens.textMuted).toHexString();
  // 5% steps: fine enough to land close to the floor, coarse enough that the
  // result is a stable, readable hex rather than one that shifts on a rounding
  // change somewhere else.
  for (let blend = 5; blend <= 95; blend += 5) {
    const candidate = new TinyColor(tokens.textMuted)
      .mix(surface, blend)
      .toHexString();
    if (readability(candidate, surface) < AA) break;
    result = candidate;
  }
  return result;
}
