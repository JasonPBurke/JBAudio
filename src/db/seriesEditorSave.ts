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
import { resolveMembership } from '@/db/seriesProvenance';

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
 * The provenance a number written from the editor carries — always `'user'`
 * when a number is present, because a person typed it into a box. Null when no
 * number is set: `canonical_source` deliberately does not coalesce, so claiming
 * `'user'` for a number nobody entered would make an unnumbered row look
 * pinned.
 */
function sourceFor(n: number | null): 'user' | null {
  return n == null ? null : 'user';
}

/**
 * A11 — what a row's `membership` must become, or undefined to leave it. Read
 * off the desired list DIRECTLY rather than off the membership diff: the diff
 * answers "which keys arrived, left or moved", and a re-added book whose
 * position happens to be unchanged moves nowhere at all.
 */
function nextMembership(
  row: EditorExistingRow,
  desired: ReadonlySet<string>,
): 'user' | 'excluded' | undefined {
  const current = resolveMembership(row.membership);
  if (!desired.has(row.bookKey)) {
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
  storedName: string;
  desiredName: string;
}): EditorSavePlan {
  const { existing, desiredKeysInOrder, canonicalNumbers } = input;

  const desired = new Set(desiredKeysInOrder);
  const diff = computeMembershipDiff(existing, desiredKeysInOrder);
  const positionByKey = new Map(
    diff.toReposition.map(({ bookKey, position }) => [bookKey, position]),
  );
  const numberByKey = new Map(
    desiredKeysInOrder.map((key, index) => [key, canonicalNumbers[index] ?? null]),
  );

  const updateRows: EditorRowUpdate[] = [];
  for (const row of existing) {
    const update: EditorRowUpdate = { bookKey: row.bookKey };
    let changed = false;

    const membership = nextMembership(row, desired);
    if (membership) {
      update.membership = membership;
      changed = true;
    }

    const position = positionByKey.get(row.bookKey);
    if (position !== undefined) {
      update.position = position;
      changed = true;
    }

    // A tombstone keeps the number it had. It is a memory of a book, not a
    // place in the order, and nothing displays it.
    if (desired.has(row.bookKey)) {
      const number = numberByKey.get(row.bookKey) ?? null;
      if ((row.canonicalNumber ?? null) !== number) {
        update.canonicalNumber = number;
        update.canonicalSource = sourceFor(number);
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
      canonicalSource: sourceFor(number),
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
