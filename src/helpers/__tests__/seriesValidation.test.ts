import {
  seriesAuthorStepIssues,
  seriesEditorIssues,
  seriesPickerBookIssues,
} from '@/helpers/seriesValidation';

const series = [
  { id: 's1', name: 'Dune Saga' },
  { id: 's2', name: 'Foundation' },
];

describe('picker panel steps', () => {
  test('no authors selected', () => {
    expect(seriesAuthorStepIssues([])).toEqual(['Select at least one author.']);
  });

  test('one author selected is valid', () => {
    expect(seriesAuthorStepIssues(['Frank Herbert'])).toEqual([]);
  });

  test('no books selected', () => {
    expect(seriesPickerBookIssues([])).toEqual(['Select at least one book.']);
  });

  test('one book selected is valid', () => {
    expect(seriesPickerBookIssues(['/a/1.m4b'])).toEqual([]);
  });
});

/*
 * §E1/E8 — one surface, one gate. The `create` and `edit` blocks below are the
 * SAME function called two ways, which is the property the ticket asks to be
 * asserted rather than assumed: the duplicate-name rule survived the merge of
 * the wizard's book step and the edit screen's Save into one call.
 */
describe('editor surface — create (no editingSeriesId)', () => {
  const base = { name: 'Wheel of Time', series, bookCount: 1 };

  test('valid create', () => {
    expect(seriesEditorIssues(base)).toEqual([]);
  });

  test('blank name', () => {
    expect(seriesEditorIssues({ ...base, name: '  ' })).toEqual([
      'Enter a series name.',
    ]);
  });

  test('no books', () => {
    expect(seriesEditorIssues({ ...base, bookCount: 0 })).toEqual([
      'Add at least one book.',
    ]);
  });

  test('duplicate name, case- and whitespace-insensitive', () => {
    expect(seriesEditorIssues({ ...base, name: '  dune saga ' })).toEqual([
      'A series named "  dune saga " already exists. Choose a different name.',
    ]);
  });

  test('multiple problems are all reported, name first', () => {
    expect(
      seriesEditorIssues({ ...base, name: 'Foundation', bookCount: 0 }),
    ).toEqual([
      'A series named "Foundation" already exists. Choose a different name.',
      'Add at least one book.',
    ]);
  });

  test('a blank name suppresses the duplicate sentence rather than stacking', () => {
    expect(seriesEditorIssues({ ...base, name: '' })).toEqual([
      'Enter a series name.',
    ]);
  });
});

/*
 * ⚠ CHARACTERIZATION — pinned 2026-08-16 (ticket 31), and it asserts CURRENT
 * behaviour, not a pending change.
 *
 * Two names that differ only by a leading article are two DIFFERENT series, so
 * both may exist side by side. Ticket 32 will make the browse list SORT as if
 * the article were absent; if it lands, these tests must still pass unchanged,
 * because ordering and identity are separate questions. If it never lands, they
 * are still correct.
 *
 * This is the executable form of that split. If it fails, someone has folded
 * the article strip into `seriesIdentityKey` and merged two real series.
 */
describe('a leading article distinguishes two series', () => {
  const withArticle = [{ id: 's1', name: 'The Dresden Files' }];

  test('creating the un-prefixed name alongside it is allowed', () => {
    expect(
      seriesEditorIssues({
        name: 'Dresden Files',
        series: withArticle,
        bookCount: 1,
      }),
    ).toEqual([]);
  });

  test('and the reverse — the prefixed name alongside the plain one', () => {
    expect(
      seriesEditorIssues({
        name: 'The Dresden Files',
        series: [{ id: 's1', name: 'Dresden Files' }],
        bookCount: 1,
      }),
    ).toEqual([]);
  });

  test('but the SAME name is still a duplicate, article and all', () => {
    expect(
      seriesEditorIssues({
        name: 'the dresden files',
        series: withArticle,
        bookCount: 1,
      }),
    ).toEqual([
      'A series named "the dresden files" already exists. Choose a different name.',
    ]);
  });
});

describe('editor surface — edit (editingSeriesId present)', () => {
  const base = { series, bookCount: 3, editingSeriesId: 's1' };

  test('valid rename', () => {
    expect(seriesEditorIssues({ ...base, name: 'Dune Chronicles' })).toEqual([]);
  });

  test('blank name', () => {
    expect(seriesEditorIssues({ ...base, name: '' })).toEqual([
      'Enter a series name.',
    ]);
  });

  test('renaming to its own name is valid', () => {
    expect(seriesEditorIssues({ ...base, name: 'Dune Saga' })).toEqual([]);
  });

  test('renaming onto another series is a duplicate', () => {
    expect(seriesEditorIssues({ ...base, name: 'Foundation' })).toEqual([
      'A series named "Foundation" already exists. Choose a different name.',
    ]);
  });

  /*
   * ⚠ RULED ON DEVICE, 2026-08-13, REVERSING THE EARLIER ASYMMETRY. An
   * emptying save used to be allowed, and `updateSeries([])` deleted the series
   * AND wrote A12's suppression row — an unconfirmed destroy with a lasting
   * side effect, performed by a button labelled `Save`. Every other destroy in
   * this app confirms, and the one that does — `Delete Series` — is one tap
   * below `+ Add books` on the very same screen.
   *
   * So the book requirement is now unconditional, and the message points at
   * the escape hatch rather than dead-ending on it.
   */
  test('emptying an existing series is refused, and names the way out', () => {
    expect(
      seriesEditorIssues({ ...base, name: 'Dune Saga', bookCount: 0 }),
    ).toEqual(['Add at least one book, or use Delete Series to remove it.']);
  });

  /* The create pass has no `Delete Series` to point at, so it must not. */
  test('the create pass keeps the plain sentence', () => {
    expect(
      seriesEditorIssues({ name: 'Wheel of Time', series, bookCount: 0 }),
    ).toEqual(['Add at least one book.']);
  });
});
