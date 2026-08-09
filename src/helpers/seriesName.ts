/**
 * DB-free series-name utilities. Deliberately imports nothing from `@/db` so
 * validation stays unit-testable without pulling WatermelonDB into Jest;
 * `db/seriesQueries.ts` re-exports normalizeSortName for its own use.
 */

/** Comparison key for a series name: trimmed and case-folded. */
export const normalizeSortName = (name: string) => name.trim().toLowerCase();

/**
 * A15 — two names denote the same series iff their comparison keys agree.
 *
 * The one place that comparison is written down. Duplicate-name validation,
 * reconcile's name matching and the suppression table all answer the same
 * question, and a second spelling of it is how they would drift apart.
 */
export const isSameSeriesName = (a: string, b: string) =>
  normalizeSortName(a) === normalizeSortName(b);

/**
 * The one definition of the duplicate-name sentence. Both the Error's message
 * and the UI alert copy come from here so the two can never drift apart.
 */
export const duplicateNameIssue = (name: string) =>
  `A series named "${name}" already exists. Choose a different name.`;

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
  if (!normalizeSortName(name)) return false;
  return series.some(
    (s) => s.id !== excludeId && isSameSeriesName(s.name, name),
  );
}

/** Thrown by the query layer when a write would create a duplicate name. */
export class SeriesNameConflictError extends Error {
  readonly conflictingName: string;

  constructor(conflictingName: string) {
    super(duplicateNameIssue(conflictingName));
    this.name = 'SeriesNameConflictError';
    this.conflictingName = conflictingName;
  }
}
