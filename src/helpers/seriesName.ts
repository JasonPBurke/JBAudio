/**
 * DB-free series-name utilities. Deliberately imports nothing from `@/db` so
 * validation stays unit-testable without pulling WatermelonDB into Jest;
 * `db/seriesQueries.ts` re-exports `seriesIdentityKey` for its own use.
 */

/**
 * The IDENTITY key for a series name — trimmed and case-folded. It answers ONE
 * question: **are these two names the same series?** Duplicate validation,
 * reconcile's name matching and the suppression table are all that question.
 * Persisted as `series.identity_key`.
 *
 * ⚠ **DO NOT FOLD A LEADING-ARTICLE STRIP IN HERE.** It looks like a sorting
 * tweak and is not one: it would make `The Dresden Files` and `Dresden Files`
 * the SAME series, so the second could never be created, reconcile would match
 * across them and the suppression table would conflate them. The tripwire is in
 * `__tests__/seriesName.test.ts`; the ruling is
 * `docs/adr/0002-series-identity-key-is-article-sensitive.md`.
 *
 * ⚠ **STATE OF PLAY — this value currently does a second job it should not.**
 * `assembleDerivedSeries` orders the browse list by this key, which is why
 * `The Dresden Files` files under T today. That is the conflation ADR 0002
 * names, and **ticket 32 removes it** by ordering on `compareSeriesNames`
 * instead. Until then, "identity key" describes what this value MEANS, not
 * every job it is doing — and the fix is to move the sort off it, never to
 * change what it returns.
 */
export const seriesIdentityKey = (name: string) => name.trim().toLowerCase();

/**
 * A15 — two names denote the same series iff their comparison keys agree.
 *
 * The one place that comparison is written down. Duplicate-name validation,
 * reconcile's name matching and the suppression table all answer the same
 * question, and a second spelling of it is how they would drift apart.
 */
export const isSameSeriesName = (a: string, b: string) =>
  seriesIdentityKey(a) === seriesIdentityKey(b);

/**
 * The one definition of the duplicate-name sentence. Both the Error's message
 * and the UI alert copy come from here so the two can never drift apart.
 */
export const duplicateNameIssue = (name: string) =>
  `A series named "${name}" already exists. Choose a different name.`;

/**
 * True when `name` collides with an existing series. Comparison is
 * case-insensitive and whitespace-trimmed (i.e. `seriesIdentityKey` equality),
 * matching the `identity_key` column persisted on create and update. A leading
 * article is NOT stripped — see `seriesIdentityKey`.
 *
 * `excludeId` omits one series from the check so renaming a series to its own
 * name is never reported as a conflict.
 */
export function isDuplicateSeriesName(
  name: string,
  series: { id: string; name: string }[],
  excludeId?: string,
): boolean {
  if (!seriesIdentityKey(name)) return false;
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
