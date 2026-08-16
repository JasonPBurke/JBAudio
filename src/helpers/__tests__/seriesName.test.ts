import {
  compareSeriesNames,
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

/*
 * DISPLAY ORDER — the other half of ADR 0002's split, and the reason the
 * identity key above may never absorb an article strip.
 *
 * `compareSeriesNames` delegates to `compareBookTitles`, the app's ONE title
 * rule, so a series name files exactly the way a book title does. The tests
 * below are the properties that rule is here for, not a re-test of it.
 */
describe('compareSeriesNames', () => {
  const sorted = (names: string[]) => [...names].sort(compareSeriesNames);

  test('a leading article is ignored, so The Dresden Files files under D', () => {
    // Under D and after `Drenai`, because `dre-s` > `dre-n`. Worth pinning the
    // exact neighbour: the ticket and ADR first claimed "between Discworld and
    // Drenai", which is wrong, and only running this caught it.
    expect(sorted(['The Dresden Files', 'Drenai', 'Discworld'])).toEqual([
      'Discworld',
      'Drenai',
      'The Dresden Files',
    ]);
  });

  test('and it is genuinely under D, not merely somewhere after Discworld', () => {
    // The T-filing it replaces: without the strip, `The Dresden Files` sorts
    // after `Silo` and `Threshold`. This is the whole ticket in one assertion.
    expect(sorted(['Threshold', 'The Dresden Files', 'Silo'])).toEqual([
      'The Dresden Files',
      'Silo',
      'Threshold',
    ]);
  });

  test('all three articles, and only as a whole word', () => {
    // `Anathem` keeps its A- position: the strip needs a following space, so
    // the `An` inside it is not an article. This is the case a naive
    // `replace(/^(the|a|an)/)` gets wrong.
    expect(
      sorted(['The Silo', 'An Ember', 'A Song of Ice and Fire', 'Anathem']),
    ).toEqual(['Anathem', 'An Ember', 'The Silo', 'A Song of Ice and Fire']);
  });

  test('case is folded, so ordering does not depend on ICU collation', () => {
    // Hermes may or may not have full ICU. With it, case is a tertiary
    // difference and `apple` precedes `Banana` anyway; without it,
    // `localeCompare` can fall toward code-unit order and put `Zoo` first.
    // Folding first makes the answer the same either way.
    expect(sorted(['Zoo', 'apple', 'Banana'])).toEqual([
      'apple',
      'Banana',
      'Zoo',
    ]);
  });

  test('surrounding whitespace does not change where a name files', () => {
    expect(sorted(['  The Dresden Files  ', 'Drenai'])).toEqual([
      'Drenai',
      '  The Dresden Files  ',
    ]);
    // ...and it still files under D rather than under whitespace.
    expect(sorted(['  The Dresden Files  ', 'Echo', 'Discworld'])).toEqual([
      'Discworld',
      '  The Dresden Files  ',
      'Echo',
    ]);
  });

  test('numbers sort naturally, inherited from compareBookTitles', () => {
    expect(sorted(['Wave 10', 'Wave 2'])).toEqual(['Wave 2', 'Wave 10']);
  });

  /*
   * ⚠ The pair ADR 0002 exists for. These two are DIFFERENT series that sort
   * ADJACENTLY — the comparator ties them, identity keeps them apart. If a
   * future change makes the comparator distinguish them, that is fine; if it
   * makes `seriesIdentityKey` merge them, that is the bug.
   */
  test('a name and its article-prefixed twin tie, but are not the same series', () => {
    expect(compareSeriesNames('The Dresden Files', 'Dresden Files')).toBe(0);
    expect(seriesIdentityKey('The Dresden Files')).not.toBe(
      seriesIdentityKey('Dresden Files'),
    );
  });
});
