/**
 * DB-free series-name utilities. Deliberately imports nothing from `@/db` so
 * validation stays unit-testable without pulling WatermelonDB into Jest;
 * `db/seriesQueries.ts` re-exports normalizeSortName for its own use.
 */

/** Comparison key for a series name: trimmed and case-folded. */
export const normalizeSortName = (name: string) => name.trim().toLowerCase();

/**
 * True when `name` collides with an existing series. Comparison is
 * case-insensitive and whitespace-trimmed (i.e. sortName equality), matching
 * the `sort_name` column persisted on create and update.
 *
 * `excludeId` omits one series from the check so renaming a series to its own
 * name is never reported as a conflict.
 */
export function isDuplicateSeriesName(
  name: string,
  series: { id: string; name: string }[],
  excludeId?: string,
): boolean {
  const key = normalizeSortName(name);
  if (!key) return false;
  return series.some(
    (s) => s.id !== excludeId && normalizeSortName(s.name) === key,
  );
}

/** Thrown by the query layer when a write would create a duplicate name. */
export class SeriesNameConflictError extends Error {
  readonly conflictingName: string;

  constructor(conflictingName: string) {
    super(`A series named "${conflictingName}" already exists.`);
    this.name = 'SeriesNameConflictError';
    this.conflictingName = conflictingName;
  }
}
