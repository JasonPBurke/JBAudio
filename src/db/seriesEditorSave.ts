/**
 * §D9.1 — what an editor `Save` writes, as a pure function. Extracted from the
 * query layer for the reason `seriesMembershipDiff` and `seriesReconcile` both
 * were: so it can be unit tested without importing the native SQLite adapter.
 * Imports nothing from `@/db` at runtime beyond two other pure modules, and
 * nothing from React Native.
 *
 * `seriesQueries.updateSeries` is the IO half and MUST NOT make decisions — if
 * a conditional answering "should this row change?" appears there, it belongs
 * here.
 *
 * ⚠ IT HAS NO DESTRUCTIVE VERB — not for a row, and not for the series. That
 * is the whole shape of the fix, and it is deliberate in both halves:
 * a removed book becomes a tombstone, and an emptied list is refused by the
 * editor's own validation (`seriesEditorIssues`) rather than becoming a silent
 * delete-and-suppress. Deleting a series is `Delete Series`, which confirms
 * first. If an empty list ever reaches here anyway, what comes out is K16's
 * all-excluded state: every row tombstoned, the series still standing.
 *
 * ── The defect this exists to fix ─────────────────────────────────────────
 *
 * The editor's save path REWROTE join rows: a removed book was destroyed
 * outright, so the next scan re-derived it and put it straight back. A11 makes
 * removal a tombstone — `membership = 'excluded'`, a hidden row that blocks
 * re-derivation — and `reconcileSeries` already reads those tombstones (it
 * counts them as continuity evidence and never removes them). This module is
 * what finally WRITES one.
 *
 * ── Ownership is per aspect ───────────────────────────────────────────────
 *
 * Renaming must not cost automatic membership, and reordering must not disown
 * the name. So a rename claims `name_source` and touches nothing else, a drag
 * touches `position` and nothing else, and neither ever touches `origin`: a
 * detected series the user has edited is still detection's to add books to.
 *
 * ⚠ THE MEMBERSHIP DIFF IS NOT EXTENDED, deliberately. It answers "which keys
 * arrived, left or moved" and it still answers exactly that. Provenance is
 * layered on top here, where the rest of the ownership rules already live.
 */

import { computeMembershipDiff } from '@/db/seriesMembershipDiff';
import { canonicalSourceFor, resolveMembership } from '@/db/seriesProvenance';

/** A `series_books` row as the editor's save path reads it. */
export type EditorExistingRow = {
  bookKey: string;
  position: number;
  canonicalNumber?: number | null;
  /** 'detected' | 'user' | 'excluded'; null reads as 'user'. */
  membership?: string | null;
};

/** A row to create. `applyEditorSave` copies these fields verbatim. */
export type EditorRowInsert = {
  bookKey: string;
  position: number;
  canonicalNumber: number | null;
  canonicalSource: 'user' | null;
  /** A book a person put here by hand. Regeneration never takes it back. */
  membership: 'user';
};

/**
 * A row to change. ONLY the fields that must change are present, and there is
 * at most ONE of these per row — see the `prepareUpdate` note in
 * `seriesQueries.updateSeries`.
 */
export type EditorRowUpdate = {
  bookKey: string;
  position?: number;
  canonicalNumber?: number | null;
  canonicalSource?: 'user' | null;
  membership?: 'user' | 'excluded';
};

export type EditorSavePlan = {
  /**
   * `'user'` when the name changed, undefined to leave the column alone.
   * A10b honours it a fortiori: reconcile has no rename verb at all.
   */
  nameSource?: 'user';
  insertRows: EditorRowInsert[];
  updateRows: EditorRowUpdate[];
};

/**
 * A11 — what a row's `membership` must become, or undefined to leave it. Read
 * off the desired list DIRECTLY rather than off the membership diff: the diff
 * answers "which keys arrived, left or moved", and a re-added book whose
 * position happens to be unchanged moves nowhere at all.
 *
 * ⚠ YOU MAY ONLY REMOVE WHAT YOU COULD SEE. `existing - desired` is NOT the
 * set of books the user removed — it also holds every DANGLING row, whose
 * `bookKey` did not resolve against the live library, so `assembleDerivedSeries`
 * skipped it and the editor could never have drawn it. Tombstoning one is
 * permanent silent data loss: `seriesReconcile` counts tombstones as settled,
 * so no rescan puts the book back once its file returns. `visible` is what
 * separates the two, and a row outside it is left ENTIRELY alone.
 */
function nextMembership(
  row: EditorExistingRow,
  desired: ReadonlySet<string>,
  visible: ReadonlySet<string>,
): 'user' | 'excluded' | undefined {
  const current = resolveMembership(row.membership);
  if (!desired.has(row.bookKey)) {
    if (!visible.has(row.bookKey)) return undefined;
    return current === 'excluded' ? undefined : 'excluded';
  }
  // Restored by hand, so it is the user's row now. What it was before the
  // tombstone is not recoverable — and 'user' is the safe direction anyway,
  // because regeneration only ever takes a 'detected' row back.
  return current === 'excluded' ? 'user' : undefined;
}

export function planEditorSave(input: {
  existing: EditorExistingRow[];
  /** The VISIBLE list, in drag order. Tombstones are not in it by definition. */
  desiredKeysInOrder: string[];
  /** Index-aligned with `desiredKeysInOrder` (§D3 — null is the norm). */
  canonicalNumbers: (number | null)[];
  /**
   * THE VISIBLE UNIVERSE — every key the caller's surface was actually able to
   * render, whether or not it survived into `desiredKeysInOrder`. It is what
   * lets this tell *"the user removed this"* from *"the user could never see
   * this"*; see `nextMembership`.
   *
   * ⚠ It cannot be derived here, and it must not be derived in `updateSeries`
   * either: resolving a `bookKey` needs the library book map, which the DB
   * layer has no access to. The editor supplies it from the SAME list it seeds
   * its drag order from, so the two cannot disagree.
   */
  visibleKeys: readonly string[];
  storedName: string;
  desiredName: string;
}): EditorSavePlan {
  const { existing, desiredKeysInOrder, canonicalNumbers } = input;

  const desired = new Set(desiredKeysInOrder);
  const visible = new Set(input.visibleKeys);
  const diff = computeMembershipDiff(existing, desiredKeysInOrder);
  const positionByKey = new Map(
    diff.toReposition.map(({ bookKey, position }) => [bookKey, position]),
  );
  const numberByKey = new Map(
    desiredKeysInOrder.map((key, index) => [key, canonicalNumbers[index] ?? null]),
  );

  /*
   * ⚠ THE COORDINATE SPACE TOMBSTONES LIVE IN, and it is the same one as the
   * visible list. A tombstone's `position` means "the index into the CURRENT
   * visible list where I belong" — that is what `planSeriesJoin` reads to put a
   * restored book back — and since the visible rows are compacted to `0..n-1`
   * on every save, a tombstone left at a stale index silently decays into
   * nonsense. Two removals is all it takes: the second compaction slides a row
   * out from under the first tombstone, which then claims one predecessor too
   * many and the restored book is APPENDED.
   *
   * These are the pre-save positions of the rows that are still visible
   * afterwards, so a tombstone's new slot is just how many of them are in front
   * of it. Both existing tombstones and rows being tombstoned now are placed by
   * the same rule, because they mean the same thing.
   *
   * ⚠ WHY NOT THE OTHER DESIGN. Repositioning tombstones INLINE with visible
   * rows in one shared space keeps a single coordinate system, but it breaks
   * the `0..n-1` contiguity of the visible rows — and that contiguity is what
   * `seedInsertPositions` leans on (it appends at `max(position) + 1` and
   * bisects between anchors) and what §E7's `1..n` auto-numbering assumes. Two
   * spaces kept in step is the cheaper invariant.
   *
   * KNOWN AND ACCEPTED: a book INSERTED by this same save has no pre-save
   * position, so it cannot count as a predecessor. That leaves a restored book
   * one place out in a list the user is looking at and can drag.
   */
  const survivingPositions = existing
    .filter((row) => desired.has(row.bookKey))
    .map((row) => row.position);
  const slotOf = (position: number) =>
    survivingPositions.filter((p) => p < position).length;

  /*
   * Every row that will NOT be in the visible list afterwards, in the order
   * they sit now: the tombstones, and the dangling rows `visibleKeys` protects.
   * Their MEMBERSHIP is treated very differently — see `nextMembership` — but
   * their position means the same thing for both, so it is maintained the same
   * way. Leaving a dangling row's position stale is not "untouched", it is its
   * place in the reading order silently lost.
   */
  const absent = existing
    .filter((row) => !desired.has(row.bookKey))
    .slice()
    .sort((a, b) => a.position - b.position);

  /*
   * ⚠ AN ABSENT ROW SITS STRICTLY BETWEEN ITS NEIGHBOURS, NEVER ON TOP OF ONE.
   *
   * The slot alone is not enough, because it is the index OF a visible row and
   * so ties with it. Two things go wrong on that tie:
   *
   *   - two books removed in the SAME save claim one index — `a,b,c,d` losing
   *     `b` and `c` leaves `a,d` and both belong between them — so one integer
   *     cannot hold both, and a restore appends past `d` (the 1,2,3,5,4 defect,
   *     through a third door);
   *   - a DANGLING row re-enters the visible list with NO SAVE AT ALL, the
   *     moment its file resolves again. `assembleDerivedSeries` sorts purely by
   *     position, so a tie there is decided by the DB's row-emission order and
   *     can flip between runs.
   *
   * So each absent row takes a fraction inside the OPEN interval
   * `(slot - 1, slot)`, ordered among the rows sharing its slot by where they
   * already sat. Every value in that interval counts exactly the same visible
   * predecessors, so `planSeriesJoin`'s slot is untouched, while the sort order
   * becomes total. This is the same fractional-position trick
   * `seedInsertPositions` already uses to insert without moving anything.
   *
   * It converges: an absent row that is already at its fraction is written
   * again by nobody. The one-time cost is the first save after this shipped,
   * which normalises the integer tombstones already on disk.
   */
  const absentPositions = new Map<string, number>();
  const bySlot = new Map<number, EditorExistingRow[]>();
  for (const row of absent) {
    const slot = slotOf(row.position);
    const sharing = bySlot.get(slot);
    if (sharing) sharing.push(row);
    else bySlot.set(slot, [row]);
  }
  for (const [slot, sharing] of bySlot) {
    sharing.forEach((row, index) => {
      absentPositions.set(
        row.bookKey,
        slot - (sharing.length - index) / (sharing.length + 1),
      );
    });
  }

  const updateRows: EditorRowUpdate[] = [];
  for (const row of existing) {
    const update: EditorRowUpdate = { bookKey: row.bookKey };
    let changed = false;

    const membership = nextMembership(row, desired, visible);
    if (membership) {
      update.membership = membership;
      changed = true;
    }

    const position = positionByKey.get(row.bookKey);
    if (position !== undefined) {
      update.position = position;
      changed = true;
    }

    // The other half of the same rule, and the two branches cannot both fire:
    // `positionByKey` only ever holds desired keys, and an absent row is by
    // definition not one of them.
    const absentPosition = absentPositions.get(row.bookKey);
    if (absentPosition !== undefined && absentPosition !== row.position) {
      update.position = absentPosition;
      changed = true;
    }

    // A tombstone keeps the number it had. It is a memory of a book, not a
    // place in the order, and nothing displays it.
    if (desired.has(row.bookKey)) {
      const number = numberByKey.get(row.bookKey) ?? null;
      if ((row.canonicalNumber ?? null) !== number) {
        update.canonicalNumber = number;
        update.canonicalSource = canonicalSourceFor(number);
        changed = true;
      }
    }

    if (changed) updateRows.push(update);
  }

  const insertRows = diff.toCreate.map(({ bookKey, position }) => {
    const number = numberByKey.get(bookKey) ?? null;
    return {
      bookKey,
      position,
      canonicalNumber: number,
      canonicalSource: canonicalSourceFor(number),
      membership: 'user' as const,
    };
  });

  // Compared on the trimmed strings the columns actually hold, so re-saving a
  // series without touching the field cannot claim its name. A case-only edit
  // IS a rename: the user retyped it, and the display name is theirs.
  const renamed = input.desiredName.trim() !== input.storedName.trim();

  return {
    ...(renamed ? { nameSource: 'user' as const } : {}),
    insertRows,
    updateRows,
  };
}
