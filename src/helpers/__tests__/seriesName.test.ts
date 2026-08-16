import {
  seriesIdentityKey,
  isDuplicateSeriesName,
  SeriesNameConflictError,
  duplicateNameIssue,
} from '@/helpers/seriesName';

const series = [
  { id: 's1', name: 'Dune Saga' },
  { id: 's2', name: 'Foundation' },
];

test('seriesIdentityKey trims and lowercases', () => {
  expect(seriesIdentityKey('  Dune Saga ')).toBe('dune saga');
});

/*
 * ⚠ THE IDENTITY KEY IS ARTICLE-SENSITIVE, AND THAT IS LOAD-BEARING.
 *
 * This key answers "are these the same series?". Wanting `The Dresden Files`
 * to file under D is a DISPLAY-ORDER wish, and folding the article strip in
 * here to grant it would merge two distinct series into one — breaking
 * duplicate validation, reconcile matching and suppression at a stroke.
 *
 * The test below is the tripwire. If it ever fails, someone has re-coupled
 * identity to ordering — see
 * `docs/adr/0002-series-identity-key-is-article-sensitive.md`.
 */
test('a leading article is part of the identity key, not stripped from it', () => {
  expect(seriesIdentityKey('The Dresden Files')).not.toBe(
    seriesIdentityKey('Dresden Files'),
  );
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

test('duplicateNameIssue builds the exact sentence', () => {
  expect(duplicateNameIssue('Dune Saga')).toBe(
    'A series named "Dune Saga" already exists. Choose a different name.',
  );
});

test('SeriesNameConflictError carries the conflicting name', () => {
  const err = new SeriesNameConflictError('Dune Saga');
  expect(err.conflictingName).toBe('Dune Saga');
  expect(err instanceof Error).toBe(true);
  expect(err.name).toBe('SeriesNameConflictError');
});

test('SeriesNameConflictError message reuses duplicateNameIssue', () => {
  expect(new SeriesNameConflictError('Dune Saga').message).toBe(
    duplicateNameIssue('Dune Saga'),
  );
});
