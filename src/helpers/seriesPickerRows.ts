/**
 * The picker's row list — spec §E3 and §E13.
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
  | { type: 'author'; key: string; name: string }
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
    for (const author of authors) {
      rows.push({
        type: 'author',
        key: `author-${author.name}`,
        name: author.name,
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
