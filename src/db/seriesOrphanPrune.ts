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

/** A chapter as a prune site sees it: a file path, and nothing else. */
export type LiveChapter = { url: string };

/** A book together with its already-fetched chapters. */
export type BookWithChapters<B, C extends LiveChapter> = {
  book: B;
  chapters: readonly C[];
};

/**
 * THE ONE DEFINITION OF A LIVE KEY, shared by both prune sites: every url of
 * every chapter that survives the deletion.
 *
 * WHY A SUPERSET AND NOT "one canonical key per book". The canonical structural
 * key is the startMs-FIRST chapter url — `bookStructuralKey` reads
 * `chapters[0].url` only AFTER the library store has stably sorted by
 * `startMs ?? 0` (`src/store/library.tsx:61`, `src/db/detectionQueries.ts:70`).
 * A raw relation fetch is in no guaranteed order, so `chapters[0]` off a fetch
 * is NOT that key. Since `selectOrphanedMemberships` is a BLOCKLIST, a key
 * missing from this set is an order to DESTROY, not a harmless miss — so the
 * set must be one that cannot omit a survivor's canonical key, whatever order
 * the rows arrive in.
 *
 * A superset is safe: file paths are unique per book, and a removed book has
 * ALL of its chapters deleted, so none of its urls can leak in here and shield
 * its row from the prune. The extra non-canonical urls match no `bookKey` and
 * change nothing.
 *
 * Ticket 22 exists because the two sites disagreed on exactly this — the scan
 * fed every surviving chapter url, folder-removal fed one `chapters[0].url` per
 * book. Extracting the DECISION did not stop the INPUTS from drifting; this is
 * the missing half. Both sites must build their live set through here.
 */
export function collectLiveKeys(
  survivingChapters: readonly LiveChapter[],
): Set<string> {
  const liveKeys = new Set<string>();
  for (const chapter of survivingChapters) liveKeys.add(chapter.url);
  return liveKeys;
}

/**
 * Split the library by a folder being removed: the books that go, and the live
 * keys every other book contributes — the folder-removal site's input to
 * `selectOrphanedMemberships`. The two halves are named rather than positional
 * because they are not symmetric: one is books, the other is keys DERIVED from
 * the books on the other side (via `collectLiveKeys`, never by the caller —
 * that is the drift this seam exists to prevent).
 *
 * THE FOLDER BOUNDARY IS PART OF THE RULE. A bare `startsWith` on the folder
 * path also matches a SIBLING root whose name merely begins with it — removing
 * `…/Books` would delete every book under `…/Books Backup`, prune their rows and
 * reap their series. That is this ticket's headline failure reached by another
 * road, so the prefix is normalised to end at a path separator.
 *
 * A book counts as inside the removed folder when EVERY one of its chapters is,
 * which is order-independent (see `collectLiveKeys`) and conservative about the
 * thing that cannot be recovered: DB state. A book that somehow straddles the
 * boundary keeps its rows — and its progress, and its series membership —
 * instead of being destroyed on the strength of whichever chapter the adapter
 * happened to return first. It is correspondingly PERMISSIVE about deletion:
 * such a book stays in the library with some files under a root that is no
 * longer configured. The next scan settles that, since it no longer enumerates
 * the removed root. A book with no chapters is neither removed nor a
 * contributor.
 */
export function partitionBooksByRemovedFolder<B, C extends LiveChapter>(
  entries: readonly BookWithChapters<B, C>[],
  removedFolderPath: string,
): { removedBooks: BookWithChapters<B, C>[]; liveKeys: Set<string> } {
  const prefix = `${removedFolderPath.replace(/\/+$/, '')}/`;
  const removedBooks: BookWithChapters<B, C>[] = [];
  const survivingChapters: C[] = [];
  for (const entry of entries) {
    if (entry.chapters.length === 0) continue;
    if (entry.chapters.every((c) => c.url.startsWith(prefix))) {
      removedBooks.push(entry);
    } else {
      survivingChapters.push(...entry.chapters);
    }
  }
  return { removedBooks, liveKeys: collectLiveKeys(survivingChapters) };
}

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
