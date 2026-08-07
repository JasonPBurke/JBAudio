/**
 * The single site where a Series provenance column's stored value becomes a
 * value the app can branch on.
 *
 * Why it exists: `addColumns` cannot backfill a chosen value (it destructures
 * only table/columns/unsafeSql — see the v33 block in migrations.ts), so every
 * row that predates v33 reads `null` in all four provenance columns. Something
 * has to decide what `null` means, and that decision must be made once. Spread
 * across call sites, one forgotten `?? 'user'` is enough to hand a hand-made
 * series to the regenerator.
 *
 * The direction is abstention bias:
 *
 *   - read as 'user' when it was really detected  -> the row is never
 *     auto-updated. Harmless.
 *   - read as 'detected' when it was really the user's -> the row is eligible
 *     for detection to overwrite. Destroys work the user did by hand.
 *
 * So anything that is not unambiguously 'detected' reads as 'user'. That
 * covers null (every pre-v33 row), and also the empty string a NON-optional
 * string column would have been backfilled with, should one of these columns
 * ever stop being optional.
 */

/** Who put this value here. Used by `series.origin` and `series.name_source`. */
export type SeriesProvenance = 'detected' | 'user';

/**
 * Why a `series_books` row exists. `'excluded'` is a known wart — it reads as
 * a contradiction beside the other two — and is kept because every
 * alternative is worse: a `_source` suffix would lie, `'removed'` collides
 * with the Removed Series list, and splitting it needs a second column.
 */
export type SeriesMembership = 'detected' | 'user' | 'excluded';

/**
 * Reads `series.origin` or `series.name_source`. Null (and anything
 * unrecognised) is user-owned.
 */
export function resolveProvenance(
  raw: string | null | undefined,
): SeriesProvenance {
  return raw === 'detected' ? 'detected' : 'user';
}

/** Reads `series_books.membership`. Null (and anything unrecognised) is user-owned. */
export function resolveMembership(
  raw: string | null | undefined,
): SeriesMembership {
  if (raw === 'detected') return 'detected';
  if (raw === 'excluded') return 'excluded';
  return 'user';
}

/**
 * Reads `series_books.canonical_source`. Deliberately does NOT coalesce: null
 * here means "no number is set", because `canonical_number` is itself
 * nullable. Claiming 'user' for a number nobody entered would be a lie, and
 * would make an unnumbered row look like one the user had pinned.
 */
export function resolveCanonicalSource(
  raw: string | null | undefined,
): SeriesProvenance | null {
  if (raw === 'detected') return 'detected';
  if (raw === 'user') return 'user';
  return null;
}
