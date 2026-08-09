/**
 * G7 — the de-duplication rule for `suppressed_series`, as a pure function.
 *
 * Extracted from seriesQueries for the same reason `seriesOrphanPrune` and
 * `seriesMembershipDiff` were: so it can be unit-tested without importing the
 * native SQLite adapter. Imports nothing from `@/db`.
 *
 * WHY THIS EXISTS AT ALL. There is no unique-constraint support anywhere in
 * this DB library — `isIndexed` emits a plain index and nothing more — so the
 * table can genuinely hold two rows for one name, and nothing in SQLite will
 * stop it. The de-duplication has to happen in JS, and it has to happen on
 * BOTH sides of the table:
 *
 *  - on WRITE, or a double-delete of one series stores its name twice;
 *  - on READ, or `Removed Series (2)` sits over a list of one;
 *  - and on RESTORE, which must therefore delete EVERY row for a name.
 *    Clearing one of two leaves the veto standing, which is the worst of the
 *    three failures because it is silent: the series simply never comes back.
 *
 * All three are the same question — "which rows are this series?" — so they
 * are one function here, and `suppressionsClearedByCreating` in
 * `seriesReconcile` asks it of a bare name list through the same comparison.
 */

import { isSameSeriesName, normalizeSortName } from '@/helpers/seriesName';

/** A `suppressed_series` row, in the shape the UI and the query layer share. */
export type SuppressedRow = { id: string; name: string };

/**
 * One line of the `Removed Series` list: a distinct series identity, and every
 * row that has to be destroyed to restore it.
 */
export type RemovedSeriesEntry = { name: string; rowIds: string[] };

/**
 * Every row that is the series `name` — the rows a restore must destroy, and
 * the rows whose existence means a fresh suppression row is NOT needed.
 *
 * Returns all of them, never the first: see the module comment. Deliberately
 * generic so the caller can pass WatermelonDB models and get models back.
 */
export function suppressionsMatching<T extends { name: string }>(
  name: string,
  rows: readonly T[],
): T[] {
  return rows.filter((row) => isSameSeriesName(row.name, name));
}

/**
 * The `Removed Series` list, and the number beside its label on the detection
 * card. One entry per distinct series identity (A15), alphabetical.
 *
 * The displayed name is the first STORED spelling, never the comparison key —
 * the key is lower-cased, and showing a user `discworld` after they deleted
 * `Discworld` reads as a bug. Which spelling wins when two rows disagree is
 * arbitrary by construction (they are the same series), so first-seen is
 * simply the cheapest deterministic answer.
 */
export function groupRemovedSeries(
  rows: readonly SuppressedRow[],
): RemovedSeriesEntry[] {
  const byKey = new Map<string, RemovedSeriesEntry>();
  for (const row of rows) {
    const key = normalizeSortName(row.name);
    const entry = byKey.get(key);
    if (entry) {
      entry.rowIds.push(row.id);
    } else {
      byKey.set(key, { name: row.name.trim(), rowIds: [row.id] });
    }
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);
}
