import {
  COVER_BOX_SIZE,
  NUMBER_FIELD_BASE_WIDTH,
  identityRowIsStacked,
  numberFieldWidth,
  sortRowIsStacked,
} from '@/helpers/seriesEditorGeometry';

/*
 * DEVICE-FOUND, 2026-08-11, Pixel 7 Pro at font scale 2.0: `4.5` in the
 * canonical-number box was CLIPPED — the `4`'s upper-left diagonal terminated
 * at a flat edge instead of a point. The box was a fixed `width: 46` while its
 * contents scale with the OS font scale, so at 2x the text simply outgrew it.
 *
 * ⚠ This is invisible to colour and bounding-box measurement: a clipped glyph
 * has the same colours and nearly the same extent as an intact one. It was
 * caught by eye. Hence a test on the RULE rather than on a screenshot.
 */
test('the number box grows with the font scale', () => {
  expect(numberFieldWidth(1)).toBe(NUMBER_FIELD_BASE_WIDTH);
  expect(numberFieldWidth(2)).toBe(NUMBER_FIELD_BASE_WIDTH * 2);
});

test('the number box fits four characters at every supported scale', () => {
  // `12.5` is the realistic worst case, not a contrived one: a 41-book
  // Discworld with a novella at 12.5 is exactly the corpus this feature is
  // for, and §H10's own worked example runs `#1-4, 4.5, 5-8`.
  //
  // Rubik's digits advance at ~0.55em and `.` at ~0.28em, so `12.5` needs
  // ~1.93em. The box must hold that plus breathing room at both borders — the
  // device failure was a glyph touching the border, not overflowing it wildly.
  const EM_NEEDED = 1.93;
  const BASE_FONT = 16; // fontSize.sm, what the field renders at
  for (const scale of [1, 1.15, 1.3, 1.5, 1.8, 2]) {
    const needed = EM_NEEDED * BASE_FONT * scale;
    expect(numberFieldWidth(scale)).toBeGreaterThan(needed);
  }
});

test('the number box stops growing past 2x', () => {
  // Android offers font scales beyond 2.0 and the row still has to hold a
  // cover and a title. 2.0 is the bar this repo verifies against; past it the
  // box holds its width and the text may shrink-to-fit instead of eating the
  // whole row.
  expect(numberFieldWidth(3)).toBe(numberFieldWidth(2));
});

test('the sort row stacks once the font scale gets large', () => {
  // At 2.0 `Number 1-6` truncated to `Number..` beside `Sort by number`,
  // losing the count — which is the entire content of the label, since it is
  // what tells you what pressing it will do.
  expect(sortRowIsStacked(1)).toBe(false);
  expect(sortRowIsStacked(2)).toBe(true);
});

test('the cover column becomes a cover row at large font scales', () => {
  // The caption is the screen's smallest type and its width is fixed by the
  // 88dp cover above it, so at 2.0 `Using first book’s cover` wraps to four or
  // five lines and shoves the ordered list off a phone — the header does not
  // scroll. Past the threshold the caption gets the width instead.
  expect(identityRowIsStacked(1)).toBe(false);
  expect(identityRowIsStacked(2)).toBe(true);
});

test('both header reflows happen at the same font scale', () => {
  // ⚠ Not incidental. Two reflows in one header triggering at different scales
  // would produce a third layout that nobody designed and nobody has looked at
  // on a device. If one threshold moves, the other moves with it.
  for (const scale of [1, 1.15, 1.3, 1.5, 1.8, 2, 3]) {
    expect(identityRowIsStacked(scale)).toBe(sortRowIsStacked(scale));
  }
});

test('the cover box does not scale with the font scale', () => {
  // The difference from `numberFieldWidth`: that box holds TEXT, which grows.
  // This one holds an IMAGE, which does not. Growing it would take the room
  // from the caption — the thing next to it that actually is text.
  expect(typeof COVER_BOX_SIZE).toBe('number');
  expect(COVER_BOX_SIZE).toBe(88);
});
