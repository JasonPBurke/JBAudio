/**
 * The orphan-prune decision for `series_books`, as a pure function.
 *
 * Extracted from seriesQueries + settingsQueries so it can be unit-tested
 * without importing the native SQLite adapter (`@/db`) — `seriesMembershipDiff`
 * is the precedent. It existed twice as an inline `filter` over model
 * instances, which is how the two sites drifted apart in the first place.
 *
 * THE RULE, AND WHY IT LOOKS BLUNT. A membership row is identified by its
 * structural key — the book's first file path — so a book that moves on disk
 * becomes a different book with a different key, and its old row is destroyed.
 * That loss is INTENDED for every kind of membership. See
 * `docs/adr/0001-series-membership-is-keyed-by-file-path.md`: a provenance-aware
 * prune (spare 'user' and 'excluded', prune only 'detected') was considered and
 * rejected. Nothing here may branch on `membership` / `origin` / `name_source`,
 * and the provenance resolvers in `seriesProvenance.ts` must not be called from
 * this module.
 */

/** Any row carrying a structural key. Provenance fields are accepted and ignored. */
export type PrunableMembership = { bookKey: string };

/** Any row that says which series it belongs to. */
export type SeriesMembershipRef = { seriesId: string };

/**
 * Given every membership row and the set of structural keys that still back a
 * live book, return the rows to destroy.
 *
 * Deliberately does NOT consult provenance — see the module comment. A `'user'`
 * row and an `'excluded'` tombstone whose file has moved are destroyed exactly
 * like a `'detected'` one.
 */
export function selectOrphanedMemberships<T extends PrunableMembership>(
  rows: readonly T[],
  liveKeys: ReadonlySet<string>,
): T[] {
  return rows.filter((row) => !liveKeys.has(row.bookKey));
}

/**
 * Given every series id and the membership rows that SURVIVE a prune, return
 * the ids of series left with nothing in them — the guarded auto-delete. A
 * hand-made series does not outlive its last member (ADR 0001, ruling 1).
 */
export function selectEmptySeriesIds<T extends SeriesMembershipRef>(
  seriesIds: readonly string[],
  survivingMemberships: readonly T[],
): string[] {
  const nonEmpty = new Set(survivingMemberships.map((m) => m.seriesId));
  return seriesIds.filter((id) => !nonEmpty.has(id));
}
