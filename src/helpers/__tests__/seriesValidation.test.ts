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
