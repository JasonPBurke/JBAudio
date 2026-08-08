import { Q } from '@nozbe/watermelondb';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import database from '@/db';
import Series from '@/db/models/Series';
import SeriesBook from '@/db/models/SeriesBook';
import { SeriesRow, MembershipRow } from '@/helpers/seriesAssembly';
import { computeMembershipDiff } from '@/db/seriesMembershipDiff';
import {
  selectOrphanedMemberships,
  selectEmptySeriesIds,
} from '@/db/seriesOrphanPrune';
import {
  normalizeSortName,
  SeriesNameConflictError,
} from '@/helpers/seriesName';

export { computeMembershipDiff } from '@/db/seriesMembershipDiff';
export { normalizeSortName, SeriesNameConflictError };

/**
 * Throw if `name` collides with an existing series' sort_name. `excludeId`
 * omits the series being renamed so saving an unchanged name still works.
 * Queries sort_name directly rather than reusing isDuplicateSeriesName so the
 * check runs against the database, not a possibly-stale store snapshot.
 */
async function assertSeriesNameAvailable(
  name: string,
  excludeId?: string,
): Promise<void> {
  const key = normalizeSortName(name);
  if (!key) return;
  const clashes = await database
    .get<Series>('series')
    .query(Q.where('sort_name', key))
    .fetch();
  const conflict = clashes.some(
    (s) => s.id !== excludeId && s._raw._status !== 'deleted',
  );
  if (conflict) throw new SeriesNameConflictError(name.trim());
}

/**
 * Create a new series with its ordered membership. `bookKeysInOrder` are
 * structural keys (first file paths). Returns the new series id.
 */
export async function createSeries(
  name: string,
  bookKeysInOrder: string[],
): Promise<string> {
  await assertSeriesNameAvailable(name);
  let newId = '';
  await database.write(async () => {
    const now = new Date();
    const series = await database.get<Series>('series').create((s) => {
      s.name = name.trim();
      s.sortName = normalizeSortName(name);
      s.createdAt = now;
      s.updatedAt = now;
    });
    newId = series.id;

    const rows = bookKeysInOrder.map((bookKey, position) =>
      database.get<SeriesBook>('series_books').prepareCreate((sb) => {
        (sb._raw as any).series_id = series.id;
        sb.bookKey = bookKey;
        sb.position = position;
        sb.createdAt = now;
      }),
    );
    if (rows.length > 0) await database.batch(rows);
  });
  return newId;
}

/**
 * Reconcile a series' name + ordered membership. If `bookKeysInOrder` is empty,
 * the series is deleted (explicit last-book removal → guarded auto-delete).
 */
export async function updateSeries(
  id: string,
  name: string,
  bookKeysInOrder: string[],
): Promise<void> {
  if (bookKeysInOrder.length === 0) {
    await deleteSeries(id);
    return;
  }
  await assertSeriesNameAvailable(name, id);
  await database.write(async () => {
    const series = await database.get<Series>('series').find(id);
    const existingRows = await database
      .get<SeriesBook>('series_books')
      .query(Q.where('series_id', id))
      .fetch();
    const existing = existingRows.map((r) => ({
      bookKey: r.bookKey,
      position: r.position,
    }));
    const { toCreate, toDelete, toReposition } = computeMembershipDiff(
      existing,
      bookKeysInOrder,
    );
    const now = new Date();
    const ops: any[] = [];

    ops.push(
      series.prepareUpdate((s) => {
        s.name = name.trim();
        s.sortName = normalizeSortName(name);
        s.updatedAt = now;
      }),
    );
    for (const key of toDelete) {
      const row = existingRows.find((r) => r.bookKey === key);
      if (row) ops.push(row.prepareDestroyPermanently());
    }
    for (const { bookKey, position } of toReposition) {
      const row = existingRows.find((r) => r.bookKey === bookKey);
      if (row) ops.push(row.prepareUpdate((r) => (r.position = position)));
    }
    for (const { bookKey, position } of toCreate) {
      ops.push(
        database.get<SeriesBook>('series_books').prepareCreate((sb) => {
          (sb._raw as any).series_id = id;
          sb.bookKey = bookKey;
          sb.position = position;
          sb.createdAt = now;
        }),
      );
    }
    await database.batch(ops);
  });
}

/** Delete a series and all its membership rows (books untouched). */
export async function deleteSeries(id: string): Promise<void> {
  await database.write(async () => {
    const series = await database.get<Series>('series').find(id);
    const rows = await database
      .get<SeriesBook>('series_books')
      .query(Q.where('series_id', id))
      .fetch();
    await database.batch([
      ...rows.map((r) => r.prepareDestroyPermanently()),
      series.prepareDestroyPermanently(),
    ]);
  });
}

/**
 * Observe series + membership rows as plain data. Combined with the live
 * library book map (in seriesStore) to produce DerivedSeries.
 */
export function observeSeriesData(): Observable<{
  series: SeriesRow[];
  memberships: MembershipRow[];
}> {
  // observeWithColumns (not plain observe): a plain list observer only emits on
  // membership changes (add/delete), so a reorder (position-only) or rename
  // (name-only) would NOT re-emit and the UI would stay stale until restart.
  const series$ = database
    .get<Series>('series')
    .query()
    .observeWithColumns(['name', 'sort_name']);
  const members$ = database
    .get<SeriesBook>('series_books')
    .query()
    .observeWithColumns(['series_id', 'book_key', 'position']);
  return combineLatest([series$, members$]).pipe(
    map(([seriesModels, memberModels]) => ({
      series: seriesModels
        .filter((s) => s._raw._status !== 'deleted')
        .map((s) => ({ id: s.id, name: s.name, sortName: s.sortName })),
      memberships: memberModels
        .filter((m) => m._raw._status !== 'deleted')
        .map((m) => ({
          seriesId: (m._raw as any).series_id,
          bookKey: m.bookKey,
          position: m.position,
        })),
    })),
  );
}

/**
 * Delete membership rows whose structural key is no longer backed by a live
 * book. Called from the scan-cleanup flow so the join table doesn't accumulate
 * dangling references.
 *
 * PROVENANCE IS DELIBERATELY IGNORED, and the destruction is permanent — no
 * soft delete, no tombstone, no undo. A `membership: 'user'` row a person built
 * by hand, and an `'excluded'` tombstone meaning "this book is not in this
 * series", are destroyed exactly like a `'detected'` row. That is the ruling,
 * not an oversight: `book_key` is the book's first file path, so a moved or
 * renamed book is a different book, and a file move ENDS its series membership.
 * `deleteEmptySeries` then removes any series left with no members, so a
 * hand-made series does not outlive its last member.
 *
 * A provenance-aware prune (keep 'user' and 'excluded', prune only 'detected')
 * was considered and REJECTED — it leaves empty playlists rendered in the
 * browse list and lets a ghost series block its own name. Do not re-raise; see
 * `docs/adr/0001-series-membership-is-keyed-by-file-path.md`.
 *
 * THIS IS NOT THE ONLY PRUNE SITE. `removeLibraryFolder` in settingsQueries
 * must inline its own copy (it runs inside one write batch and cannot call into
 * here without nesting a writer). Neither site owns the rule: both delegate to
 * `seriesOrphanPrune`, which is authoritative. Change it there, not here.
 */
export async function pruneOrphanedSeriesBooks(
  liveKeys: Set<string>,
): Promise<void> {
  const all = await database.get<SeriesBook>('series_books').query().fetch();
  const orphans = selectOrphanedMemberships(all, liveKeys);
  if (orphans.length === 0) return;
  await database.write(async () => {
    await database.batch(orphans.map((m) => m.prepareDestroyPermanently()));
  });
}

/**
 * Delete any series that currently has zero membership rows. Called after a
 * prune on a stable (post-scan / explicit) state — the guarded auto-delete.
 */
export async function deleteEmptySeries(): Promise<void> {
  const seriesModels = await database.get<Series>('series').query().fetch();
  const memberModels = await database
    .get<SeriesBook>('series_books')
    .query()
    .fetch();
  const emptyIds = new Set(
    selectEmptySeriesIds(
      seriesModels.map((s) => s.id),
      memberModels.map((m) => ({ seriesId: (m._raw as any).series_id })),
    ),
  );
  const empties = seriesModels.filter((s) => emptyIds.has(s.id));
  if (empties.length === 0) return;
  await database.write(async () => {
    await database.batch(empties.map((s) => s.prepareDestroyPermanently()));
  });
}
