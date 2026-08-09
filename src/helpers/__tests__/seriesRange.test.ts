import { collapseNumberRange, RANGE_RUN_CAP } from '@/helpers/seriesRange';

test('nothing numbered collapses to an empty string', () => {
  expect(collapseNumberRange([])).toBe('');
  expect(collapseNumberRange([null, null])).toBe('');
});

test('a lone number is spelled out', () => {
  expect(collapseNumberRange([7])).toBe('7');
});

test('consecutive integers collapse to one run', () => {
  expect(collapseNumberRange([1, 2, 3, 4])).toBe('1-4');
});

test('a two-long run still collapses', () => {
  // Ticket 03 recorded the Dresden gap case as `1, 3-4, 8`, not `1, 3, 4, 8`.
  expect(collapseNumberRange([1, 3, 4, 8])).toBe('1, 3-4, 8');
});

test('decimals never join a run', () => {
  // A range would claim the user owns a volume they may not.
  expect(collapseNumberRange([4, 4.5, 5])).toBe('4, 4.5, 5');
});

test('unsorted input with duplicates and nulls is normalised', () => {
  expect(collapseNumberRange([3, null, 1, 2, 3])).toBe('1-3');
});

test('exactly three runs render whole, with no ellipsis', () => {
  // H10's measured worst case: `#1-4, 4.5, 5-8` at 411dp / font scale 2.0.
  expect(collapseNumberRange([1, 2, 3, 4, 4.5, 5, 6, 7, 8])).toBe(
    '1-4, 4.5, 5-8',
  );
});

test('a fourth run is cut at the run boundary and ellipsised', () => {
  expect(collapseNumberRange([1, 3, 5, 7])).toBe('1, 3, 5…');
});

test('an alternating long series stays bounded', () => {
  // Previously unbounded: 41 alternating volumes emitted ~70 characters.
  const alternating = Array.from({ length: 21 }, (_, i) => i * 2 + 1);
  expect(collapseNumberRange(alternating)).toBe('1, 3, 5…');
});

test('the cap is three runs', () => {
  expect(RANGE_RUN_CAP).toBe(3);
});
