/**
 * §F8 — `Add to series…`, as a pure function.
 *
 * A join is not a new write path. It is an editor `Save` in which exactly one
 * thing changed, so this translates "add this book to that series" into the
 * arguments `updateSeries` already takes and `planEditorSave` already decides
 * on. That reuse is the point:
 *
 *   - a removed book comes back as a restored TOMBSTONE (A11), not a duplicate
 *     row, because `planEditorSave` flips `'excluded'` → `'user'` on any key
 *     that reappears in the desired list;
 *   - nothing is ever destroyed, because the planner it feeds has no
 *     destructive verb at all;
 *   - and §F9 stays honoured by omission — there is no book-first remove here,
 *     because removal is series-scoped and so is the tombstone.
 *
 * ⚠ THE EXISTING NUMBERS MUST BE CARRIED. `planEditorSave` writes the numbers
 * it is handed over the ones on disk, so a join that passed blanks would wipe
 * every canonical number in the series. That is why this returns numbers at
 * all, rather than just an ordered key list.
 */

import { resolveMembership } from '@/db/seriesProvenance';
import type { EditorExistingRow } from '@/db/seriesEditorSave';

export type SeriesJoin = {
  /** The visible list in drag order, with the joining book appended. */
  desiredKeysInOrder: string[];
  /** Index-aligned with `desiredKeysInOrder`. */
  canonicalNumbers: (number | null)[];
  /**
   * The rows this door could see — every non-tombstoned row, which is all the
   * visibility a DB read has. `planEditorSave` needs it to tell a removal from
   * a row nobody could ever have removed, and returning the set computed HERE
   * is what stops `addBookToSeries` from deriving a second one that disagrees.
   *
   * A join never removes anything (§F9), and this is why it structurally
   * cannot: every visible key is also in `desiredKeysInOrder`.
   */
  visibleKeys: string[];
};

/**
 * What the series should look like once `bookKey` has joined it, or null when
 * the book is already a visible member and there is nothing to write.
 *
 * WHERE THE BOOK LANDS, and the split is the whole of it:
 *
 *   - a book that was never a member goes on the END. A join carries no
 *     opinion about the reading order — §D3 gives `position` sole sort
 *     authority and the editor is where an order is decided, so guessing a
 *     slot from a number would be "blank beats misleading" broken from the
 *     other side.
 *   - a RESTORED TOMBSTONE goes back where it was. This is the one case where
 *     placement information exists: the row remembers its position, the way it
 *     remembers its number.
 *
 * ⚠ DEVICE FINDING (2026-08-13). Appending unconditionally left a 1,2,3,5
 * series reading 1,2,3,5,4 after book 4 was removed and re-added — and the
 * editor's own re-add does NOT do that (ticket 16 verified the position
 * unchanged). The same user action through two doors must land in the same
 * place.
 */
export function planSeriesJoin(input: {
  existing: readonly EditorExistingRow[];
  bookKey: string;
}): SeriesJoin | null {
  const { existing, bookKey } = input;

  const visible = existing
    .filter((row) => resolveMembership(row.membership) !== 'excluded')
    .slice()
    .sort((a, b) => a.position - b.position);

  if (visible.some((row) => row.bookKey === bookKey)) return null;

  // A tombstone for this very book still holds the number it had when it was
  // removed. Reading it here is what stops the join from blanking it.
  const tombstoned = existing.find(
    (row) =>
      row.bookKey === bookKey &&
      resolveMembership(row.membership) === 'excluded',
  );

  // How many visible rows still sit in front of it. Read off live positions
  // rather than the stored index, so a tombstone whose neighbours were dragged
  // while it was away still lands somewhere sensible instead of at a stale
  // offset. `visible.length` for a book that was never here, i.e. the end.
  //
  // ⚠ THIS COUNT IS ONLY HONEST BECAUSE `planEditorSave` KEEPS TOMBSTONES IN
  // THE VISIBLE COORDINATE SPACE. Every save compacts the visible rows to
  // `0..n-1`; a tombstone that did not come down with them would claim
  // predecessors that had slid out from under it and the book would be
  // appended. Two removals were enough — see the tombstone-slot note there.
  const slot =
    tombstoned === undefined
      ? visible.length
      : visible.filter((row) => row.position < tombstoned.position).length;

  const visibleKeys = visible.map((row) => row.bookKey);
  const keys = [...visibleKeys];
  const numbers = visible.map((row) => row.canonicalNumber ?? null);
  keys.splice(slot, 0, bookKey);
  numbers.splice(slot, 0, tombstoned?.canonicalNumber ?? null);

  return { desiredKeysInOrder: keys, canonicalNumbers: numbers, visibleKeys };
}
