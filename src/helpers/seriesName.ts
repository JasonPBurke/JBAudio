/**
 * DB-free series-name utilities. Deliberately imports nothing from `@/db` so
 * validation stays unit-testable without pulling WatermelonDB into Jest;
 * `db/seriesQueries.ts` re-exports `seriesIdentityKey` for its own use.
 * (`miscellaneous` is safe here — it has no imports at all.)
 *
 * TWO KEYS LIVE HERE AND THEY ANSWER DIFFERENT QUESTIONS. `seriesIdentityKey`
 * answers "are these the same series?"; `compareSeriesNames` answers "what
 * order do they appear in?". They are neighbours so the difference is visible,
 * and they must never be collapsed — see
 * `docs/adr/0002-series-identity-key-is-article-sensitive.md`.
 */

import { compareBookTitles } from '@/helpers/miscellaneous';

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
 * ⚠ **NOTHING ORDERS BY THIS ANY MORE, and it must stay that way.** Until
 * ticket 32 the browse list sorted on this key, which is why series used to
 * file under their article. Ordering now reads `compareSeriesNames` below.
 * `SeriesRow.identityKey` is still carried but has no reader — **if a future
 * change reaches for it to sort or tie-break, that is the conflation ADR 0002
 * exists to prevent.**
 */
export const seriesIdentityKey = (name: string) => name.trim().toLowerCase();

/**
 * DISPLAY ORDER for two series names. A leading `The`/`A`/`An` is ignored, so
 * `The Dresden Files` files under D — before `Silo` and `Threshold`, and after
 * `Drenai`, since `dre-s` > `dre-n`. (An earlier draft of this line, of the
 * tickets and of ADR 0002 all said "between `Discworld` and `Drenai`". It was
 * wrong three times over and no reader caught it; the test did, on first run.)
 *
 * Delegates to `compareBookTitles`, the app's ONE title-ordering rule, already
 * used for every book title across eight modules. A series-specific article
 * list is deliberately not written here: **if the list is ever worth extending
 * beyond `The`/`A`/`An`, it is extended app-wide so book titles get it too.**
 * Two article rules is the drift ADR 0001 warns about.
 *
 * ⚠ **The case-folding is load-bearing, not decoration.** This sort used to
 * compare `seriesIdentityKey`, which is already lowercased, so folding
 * preserves the behaviour that existed rather than adding one. Passing raw
 * names through would make the result depend on whether Hermes has full ICU:
 * with it, case is a tertiary difference and `apple` still precedes `Banana`;
 * without it, `localeCompare` can fall toward code-unit order and `Zoo` jumps
 * to the front.
 *
 * ⚠ **A name and its article-prefixed twin TIE here** (`The Dresden Files` vs
 * `Dresden Files`). That is correct — they are two different series that
 * belong next to each other on the shelf. `Array.prototype.sort` is stable, so
 * within a session their relative order is the input's and does not flicker
 * between renders. ⚠ It is NOT stable across restarts: the input arrives from
 * an unordered WatermelonDB query, so SQLite row order decides, and that can
 * change. Cosmetic, and **do not "fix" it with the identity key as a tiebreak**
 * — that restores the coupling ADR 0002 removed.
 */
export const compareSeriesNames = (a: string, b: string): number =>
  compareBookTitles(a.trim().toLowerCase(), b.trim().toLowerCase());

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
