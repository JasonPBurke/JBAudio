import { readability } from '@ctrl/tinycolor';

import { colorTokens } from '@/constants/tokens';
import {
  disabledControlColors,
  disabledTextColor,
} from '@/helpers/controlColors';

/** WCAG 2.0 AA for normal text, the bar §I measures every surface against. */
const AA = 4.5;

/*
 * K15 — the disabled-button label is invisible, confirmed on the editor's
 * `Save` and the create surface's `Next`.
 *
 * It is a COLOUR COLLISION, not a rendering fault: the dark palette sets
 * `textMuted` and `divider` to the same `#d8dee9`, and the footer painted the
 * fill with one and the label with the other, so the text was drawn in its own
 * background. Measured, that pairing is 1.00:1 in dark and 2.98:1 in light —
 * light never got reported because 2.98 is legible enough to look deliberate,
 * but it fails AA too, so this is not the dark-theme-only defect it was filed
 * as.
 *
 * The expected value here comes from WCAG via tinycolor's own `readability`,
 * never from re-running the helper's arithmetic — a test that recomputed the
 * mix the way the helper does would pass by construction and could never
 * disagree with it.
 */
test('the disabled control label clears AA in the dark theme (K15)', () => {
  const { fill, label } = disabledControlColors(colorTokens.dark);
  expect(readability(label, fill)).toBeGreaterThanOrEqual(AA);
});

test('the disabled control label clears AA in the light theme (K15)', () => {
  const { fill, label } = disabledControlColors(colorTokens.light);
  expect(readability(label, fill)).toBeGreaterThanOrEqual(AA);
});

/*
 * DEVICE-FOUND, 2026-08-11: a disabled BARE TEXT control (`Sort by number`)
 * measured 12.57:1 in dark and 6.14:1 in light — legible, and MORE prominent
 * than body text. It read as active. The filled `Save` escaped this because
 * its grey fill signals "off" on its own; a text button has only its label.
 *
 * ⚠ THE INVARIANT IS DELIBERATELY NOT "recedes relative to the ENABLED
 * colour". The accent is user-settable and can also be derived from cover art
 * (driver, 2026-08-11), so a test comparing against `primary` would pin a
 * relationship to a value the user controls, and would fail on somebody's
 * cover-derived palette rather than on a real regression. Both bounds below
 * are stated against FIXED tokens: the surface, and body text.
 */
const surfaceOf = (t: { background: string }) => t.background;

test.each([
  ['dark', colorTokens.dark],
  ['light', colorTokens.light],
] as const)(
  'the disabled text label is legible but recedes below body text (%s)',
  (_name, tokens) => {
    const label = disabledTextColor(tokens);
    const surface = surfaceOf(tokens);

    // Floor — K15: never invisible.
    expect(readability(label, surface)).toBeGreaterThanOrEqual(AA);
    // Ceiling: reads as "off" against the one thing that is always on screen.
    expect(readability(label, surface)).toBeLessThan(
      readability(tokens.text, surface),
    );
  },
);

test('the disabled text label is not simply textMuted', () => {
  // The regression this pins: `textMuted` is #d8dee9 in dark, which is
  // essentially white, so reaching for it as "the muted one" lands ABOVE body
  // text rather than below it. That is the bug this function exists for.
  expect(disabledTextColor(colorTokens.dark)).not.toBe(
    colorTokens.dark.textMuted,
  );
});

test('the disabled fill stays distinct from the enabled one', () => {
  // The label being legible is only half of it: a disabled control that
  // rendered in `primary` would be perfectly readable and completely wrong.
  // Both themes must keep the inactive fill clearly off the accent.
  const dark = disabledControlColors(colorTokens.dark);
  const light = disabledControlColors(colorTokens.light);
  expect(dark.fill).not.toBe(colorTokens.shared.primary);
  expect(light.fill).not.toBe(colorTokens.shared.primary);
});
