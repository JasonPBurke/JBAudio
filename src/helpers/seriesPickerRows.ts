/**
 * The picker's row list — spec §E3, §E13 and §E14.
 *
 * ── Why the two-column grid is paired HERE, not by `numColumns` ───────────
 *
 * FlashList would do it (`numColumns` + a `span: 2` override on every other
 * row type), and in a list that showed only authors that would be the right
 * call. This one list serves BOTH steps, so a column count set on the list is
 * a property of the LIST when §E14 makes it a property of the STEP — every
 * book, heading and empty row would have to opt back out. Pairing in the data
 * also leaves the list configuration ticket 13 measured (sticky head at index
 * 0, `initialScrollIndex`, MVCP off, ordered list as the header component)
 * provably untouched.
 *
 * This is the picker's whole data shape, kept pure so the thing §E13 actually
 * demands can happen: the candidate pool is a VIRTUALIZED list, and a
 * virtualized list needs a flat array of rows rather than a tree of mapped
 * JSX. The panel maps these one-to-one onto `FlashList` items.
 *
 * ── Row 0 is the panel head, always ───────────────────────────────────────
 *
 * The head (`Add books` + `X`) is DATA, not the list's header component,
 * because that is what lets it be `stickyHeaderIndices: [0]`. It has to pin:
 * `X` is the inverse of `+ Add books` (§E4) and the pool it sits above runs to
 * hundreds of rows, so an unpinned head means closing the panel starts with a
 * scroll back to the top. It is the same argument that put the step's commit
 * button in the editor's fixed footer rather than inline under the pool.
 *
 * Everything ABOVE the head — the ordered list you are building — is the
 * list's `ListHeaderComponent`, which is §E13's other half.
 *
 * ── What is deliberately NOT a parameter ──────────────────────────────────
 *
 * The staged selection. The pool is a pure function of the author FILTER, and
 * the staged book keys live in the draft store, so "selections are kept when
 * the author filter changes" is true by construction rather than by care: this
 * function has never been told which books are staged and cannot drop one.
 * Deselecting an author removes its books from the POOL and changes nothing
 * about what is staged, which is what makes building across ten authors one
 * pass instead of ten.
 */
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { compareBookTitles } from '@/helpers/miscellaneous';
import { Author, Book } from '@/types/Book';

/** Which step the panel is showing. `null` (in the editor) means it is closed. */
export type PickerStep = 'authors' | 'books';

export type PickerRow =
  | { type: 'head'; key: string }
  /**
   * §E14's two-column grid. One row carries BOTH cells, so the column count is
   * a property of the step rather than of the list — see the note above
   * `pickerRows`. `right` is `null` on a trailing odd author rather than
   * absent, so the renderer still lays out two slots and the lone cell keeps
   * its half width instead of stretching across the row.
   */
  | { type: 'authorPair'; key: string; left: string; right: string | null }
  | { type: 'heading'; key: string; name: string }
  | { type: 'book'; key: string; book: Book; bookKey: string }
  | { type: 'empty'; key: string; message: string };

/** The head's index — the one `stickyHeaderIndices` pins. */
export const PICKER_HEAD_INDEX = 0;

const EMPTY_LIBRARY = 'No books in the library.';
const EMPTY_POOL = 'Choose an author to see their books.';

export function pickerRows({
  step,
  authors,
  selected,
}: {
  step: PickerStep;
  authors: Author[];
  /** The author names currently ticked — the volume reducer, not a selection. */
  selected: string[];
}): PickerRow[] {
  const rows: PickerRow[] = [{ type: 'head', key: 'picker-head' }];

  if (step === 'authors') {
    // Two at a time — §E14. The store's order is preserved reading left, then
    // right, then down, which is how the grid is read.
    for (let i = 0; i < authors.length; i += 2) {
      const left = authors[i];
      const right = authors[i + 1];
      rows.push({
        type: 'authorPair',
        // The left name alone keys the row: author names are unique in the
        // store (the single-column version keyed on them too) and every pair
        // has a left.
        key: `pair-${left.name}`,
        left: left.name,
        right: right ? right.name : null,
      });
    }
    if (rows.length === 1) {
      rows.push({ type: 'empty', key: 'picker-empty', message: EMPTY_LIBRARY });
    }
    return rows;
  }

  const chosen = new Set(selected);
  const groups = authors
    .filter((a) => chosen.has(a.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  /*
   * Book keys are unique across the whole pool, not just within a group. A
   * duplicate would recycle into its twin AND toggle as one book, since the
   * structural key IS the identity the draft stages.
   */
  const seen = new Set<string>();

  for (const group of groups) {
    // Copied before sorting: `group.books` is the library store's own array.
    const sorted = [...group.books].sort((a, b) =>
      compareBookTitles(a.bookTitle, b.bookTitle),
    );

    const groupRows: PickerRow[] = [];
    for (const book of sorted) {
      const bookKey = bookStructuralKey(book);
      // Membership is keyed by the first file's path (ADR 0001), so a book
      // without one cannot be a member and must not be offered as a candidate.
      if (!bookKey || seen.has(bookKey)) continue;
      seen.add(bookKey);
      groupRows.push({ type: 'book', key: `book-${bookKey}`, book, bookKey });
    }

    if (groupRows.length === 0) continue;
    rows.push({
      type: 'heading',
      key: `heading-${group.name}`,
      name: group.name,
    });
    rows.push(...groupRows);
  }

  if (rows.length === 1) {
    rows.push({ type: 'empty', key: 'picker-empty', message: EMPTY_POOL });
  }
  return rows;
}

/** The step-appropriate instruction, shown in the editor's own header. */
export function pickerSubtitle(step: PickerStep): string {
  return step === 'authors'
    ? 'Whose books are in this series?'
    : 'Tap the books that belong in it.';
}
