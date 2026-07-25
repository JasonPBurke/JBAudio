import {
  normalizeSortName,
  isDuplicateSeriesName,
  SeriesNameConflictError,
} from '@/helpers/seriesName';

const series = [
  { id: 's1', name: 'Dune Saga' },
  { id: 's2', name: 'Foundation' },
];

test('normalizeSortName trims and lowercases', () => {
  expect(normalizeSortName('  Dune Saga ')).toBe('dune saga');
});

test('exact name is a duplicate', () => {
  expect(isDuplicateSeriesName('Dune Saga', series)).toBe(true);
});

test('case difference is a duplicate', () => {
  expect(isDuplicateSeriesName('dune saga', series)).toBe(true);
});

test('surrounding whitespace is a duplicate', () => {
  expect(isDuplicateSeriesName('  Dune Saga  ', series)).toBe(true);
});

test('unused name is not a duplicate', () => {
  expect(isDuplicateSeriesName('Wheel of Time', series)).toBe(false);
});

test('blank name is never a duplicate', () => {
  expect(isDuplicateSeriesName('   ', series)).toBe(false);
});

test('renaming a series to its own name is not a duplicate', () => {
  expect(isDuplicateSeriesName('Dune Saga', series, 's1')).toBe(false);
});

test('renaming a series to another series name IS a duplicate', () => {
  expect(isDuplicateSeriesName('Foundation', series, 's1')).toBe(true);
});

test('empty series list is never a duplicate', () => {
  expect(isDuplicateSeriesName('Anything', [])).toBe(false);
});

test('SeriesNameConflictError carries the conflicting name', () => {
  const err = new SeriesNameConflictError('Dune Saga');
  expect(err.conflictingName).toBe('Dune Saga');
  expect(err instanceof Error).toBe(true);
});
