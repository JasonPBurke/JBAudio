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
import type {
  ExistingSeries,
  PlannedMember,
  ReconcilePlan,
} from '@/db/seriesReconcile';
import SuppressedSeries from '@/db/models/SuppressedSeries';
import {
  groupRemovedSeries,
  suppressionsMatching,
  type RemovedSeriesEntry,
} from '@/db/seriesSuppression';
import {
  normalizeSortName,
  SeriesNameConflictError,
} from '@/helpers/seriesName';
import { deleteArtworkFile } from '@/helpers/artworkFiles';

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
 * A13 — the suppression rows a user claiming `name` for themselves must
 * destroy. MUST be called from inside an open writer; it returns prepared
 * operations rather than performing them, so the clear rides the same batch as
 * the create or rename that caused it.
 *
 * Without this the veto is invisible AND total. `reconcileSeries` consults
 * `suppressed_series` in its FIRST pass, before it tries to match a proposal to
 * an existing series, so a leftover row does not merely stop the name being
 * re-created — it makes every scan skip the user's own series entirely, and it
 * silently stops gaining new books forever.
 */
async function prepareSuppressionClear(name: string): Promise<SuppressedSeries[]> {
  const rows = await database
    .get<SuppressedSeries>('suppressed_series')
    .query()
    .fetch();
  return suppressionsMatching(name, rows).map((row) =>
    row.prepareDestroyPermanently(),
  );
}

/**
 * The canonical numbers an editor save carries, index-aligned with its ordered
 * book keys. Null at an index means that book has no published number, which
 * is the norm rather than an edge case (§D3).
 *
 * The DECISION about what these should be is not made here — `resolveNumbers-
 * ForSave` in `seriesNumbering.ts` already applied E7's rule before the save
 * was called. Everything below copies.
 */
type CanonicalNumbers = (number | null)[];

/**
 * The provenance a number written from the editor carries. Always `'user'`
 * when a number is present: a person typed it into a box, which is the only
 * way to reach this code. Null when no number is set, because
 * `canonical_source` deliberately does not coalesce — claiming `'user'` for a
 * number nobody entered would make an unnumbered row look pinned.
 */
function sourceFor(n: number | null): 'user' | null {
  return n == null ? null : 'user';
}

/**
 * Create a new series with its ordered membership. `bookKeysInOrder` are
 * structural keys (first file paths). Returns the new series id.
 */
export async function createSeries(
  name: string,
  bookKeysInOrder: string[],
  canonicalNumbers: CanonicalNumbers = [],
): Promise<string> {
  await assertSeriesNameAvailable(name);
  let newId = '';
  await database.write(async () => {
    const now = new Date();
    // A13 — read before the create, so the batch below sees the rows as they
    // were when the user pressed Save.
    const clears = await prepareSuppressionClear(name);
    const series = await database.get<Series>('series').create((s) => {
      s.name = name.trim();
      s.sortName = normalizeSortName(name);
      s.createdAt = now;
      s.updatedAt = now;
    });
    newId = series.id;

    const rows = bookKeysInOrder.map((bookKey, position) => {
      const number = canonicalNumbers[position] ?? null;
      return database.get<SeriesBook>('series_books').prepareCreate((sb) => {
        (sb._raw as any).series_id = series.id;
        sb.bookKey = bookKey;
        sb.position = position;
        sb.canonicalNumber = number;
        sb.canonicalSource = sourceFor(number);
        sb.createdAt = now;
      });
    });
    const ops = [...rows, ...clears];
    if (ops.length > 0) await database.batch(ops);
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
  canonicalNumbers: CanonicalNumbers = [],
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

    // A13, same rule as the create path. A rename is the other way a user
    // claims a suppressed name for themselves — nothing stops them renaming a
    // series to one they deleted earlier — and the veto that would sit over it
    // is the same invisible one. (Reaching this line with the name unchanged
    // is harmless: clearing a suppression only ever un-blocks.)
    ops.push(...(await prepareSuppressionClear(name)));

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

    /*
     * ⚠ ONE `prepareUpdate` PER ROW, MERGED — never one for the position and a
     * second for the number.
     *
     * `Model.prepareUpdate` invariants on `!this._preparedState` and THROWS
     * "Cannot update a record with pending changes" on the second call before
     * the batch. The row that hits it is one that was both dragged AND
     * renumbered in the same session, which is the single most likely editor
     * session this feature has — and it is invisible to any test that performs
     * one action at a time.
     *
     * Which rows changed is looked up here; WHAT the numbers should be was
     * decided by `resolveNumbersForSave` before the save was called. Copying a
     * value is not a decision, so this stays out of the tested seam.
     */
    const numberByKey = new Map(
      bookKeysInOrder.map((key, index) => [key, canonicalNumbers[index] ?? null]),
    );
    const positionByKey = new Map(
      toReposition.map(({ bookKey, position }) => [bookKey, position]),
    );
    // `existingRows` is disjoint from `toCreate` by construction — the diff
    // only proposes a create for a key it did not find — so this loop cannot
    // collide with the prepareCreate pass below.
    for (const row of existingRows) {
      if (!numberByKey.has(row.bookKey)) continue; // handled by toDelete
      const nextNumber = numberByKey.get(row.bookKey) ?? null;
      const nextPosition = positionByKey.get(row.bookKey);
      const numberChanged = row.canonicalNumber !== nextNumber;
      if (nextPosition === undefined && !numberChanged) continue;
      ops.push(
        row.prepareUpdate((r) => {
          if (nextPosition !== undefined) r.position = nextPosition;
          if (numberChanged) {
            r.canonicalNumber = nextNumber;
            r.canonicalSource = sourceFor(nextNumber);
          }
        }),
      );
    }

    for (const { bookKey, position } of toCreate) {
      const number = numberByKey.get(bookKey) ?? null;
      ops.push(
        database.get<SeriesBook>('series_books').prepareCreate((sb) => {
          (sb._raw as any).series_id = id;
          sb.bookKey = bookKey;
          sb.position = position;
          sb.canonicalNumber = number;
          sb.canonicalSource = sourceFor(number);
          sb.createdAt = now;
        }),
      );
    }
    await database.batch(ops);
  });
}

/* ---------------------------------------------------------- series artwork --- */

/**
 * Pin a cover onto a series — §D6. The URI names a file
 * `replaceSeriesArtwork` has already installed.
 *
 * No file work here, and none is owed. The pinned file's path is derived from
 * the series ID alone (`seriesArtworkFilename`), so a replacement lands on the
 * exact path the previous cover occupied and K6's `unlink`-before-`moveFile`
 * has already destroyed it. There is no second file to release.
 *
 * ⚠ IMMEDIATE-WRITE, AND THAT IS THE RULING (§D6). This is called from the
 * cover-art search while the editor sits behind it holding an unsaved draft,
 * and it does NOT join that draft: the file it points at replaced its
 * predecessor irreversibly before this ran, so a `Cancel` that "undid" the
 * column would leave the series pointing at nothing. The user is asked to
 * confirm before the replacement instead.
 */
export async function setSeriesArtwork(id: string, uri: string): Promise<void> {
  await database.write(async () => {
    const series = await database.get<Series>('series').find(id);
    await series.update((s) => {
      s.artwork = uri;
      s.updatedAt = new Date();
    });
  });
}

/**
 * Revert a series to its derived cover — §D7, §K8.
 *
 * **The file is deleted, not merely dereferenced.** A pinned cover is a file
 * only this series ever referenced, so nulling the column without unlinking
 * makes the revert a silent leak — the second orphan source K8 names, and the
 * one this ticket is able to close outright.
 *
 * ⚠ THE ORDER IS THE OPPOSITE OF K6's, DELIBERATELY. Replacement unlinks
 * first because the new bytes take the old file's path and there is no way to
 * install them otherwise. A revert has no such forcing, so it writes first: if
 * the unlink then fails, the series is correctly derived and one file leaks —
 * whereas unlinking first and failing the write would leave the series
 * pointing at a file that no longer exists, i.e. a broken cover on every
 * surface that draws it.
 */
export async function clearSeriesArtwork(id: string): Promise<void> {
  const series = await database.get<Series>('series').find(id);
  const previous = series.artwork;
  if (!previous) return;
  await database.write(async () => {
    await series.update((s) => {
      s.artwork = null;
      s.updatedAt = new Date();
    });
  });
  await deleteArtworkFile(previous);
}

/**
 * Delete a series and all its membership rows. **The books are never touched**
 * — removing a grouping is not a destructive act, and nothing below reads or
 * writes the `books` table.
 *
 * A12 — deleting a DETECTED series also writes its name to `suppressed_series`,
 * or the next scan quietly recreates the grouping the user just rejected.
 * Deleting a hand-made one writes nothing, because nothing would recreate it;
 * `origin` resolves null (every pre-v33 row) to `'user'`, so an upgraded row
 * cannot accidentally earn a suppression it never needed.
 *
 * G7 — the name is de-duplicated here, in JS. This DB library has no unique
 * constraints, so a second delete of a re-detected series would otherwise
 * store the name twice and `Removed Series (2)` would sit over a list of one.
 *
 * KNOWN BOUNDARY, and it is not fixable from here: the suppression is keyed by
 * the series' CURRENT name. Delete a detected series the user has renamed and
 * detection can still re-propose it under its original machine name, because
 * `name_source = 'user'` records that the name changed but not what it was.
 * Recovering the old name would need a column to hold it; the user's repair is
 * to delete the re-created series, which suppresses that name too.
 *
 * K8 — a deleted series also RELEASES ITS PINNED FILE. Nothing else ever
 * referenced it, so without this the delete leaks a cover forever. Released
 * after the batch commits, for `clearSeriesArtwork`'s reason: the row is
 * already gone by then, so a failed unlink costs one orphan rather than a
 * dangling reference.
 */
export async function deleteSeries(id: string): Promise<void> {
  let pinnedArtwork: string | null = null;
  await database.write(async () => {
    const series = await database.get<Series>('series').find(id);
    pinnedArtwork = series.artwork;
    const rows = await database
      .get<SeriesBook>('series_books')
      .query(Q.where('series_id', id))
      .fetch();

    const ops: any[] = [
      ...rows.map((r) => r.prepareDestroyPermanently()),
      series.prepareDestroyPermanently(),
    ];

    if (series.origin === 'detected') {
      const name = series.name;
      const existing = await database
        .get<SuppressedSeries>('suppressed_series')
        .query()
        .fetch();
      if (suppressionsMatching(name, existing).length === 0) {
        ops.push(
          database
            .get<SuppressedSeries>('suppressed_series')
            .prepareCreate((row) => {
              row.name = name;
              row.createdAt = new Date();
            }),
        );
      }
    }

    await database.batch(ops);
  });

  await deleteArtworkFile(pinnedArtwork);
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
  // `artwork` is observed for the same reason as `name`: the detail sheet's
  // hero renders it (§C8), and pinning or reverting a cover touches no
  // membership row, so a plain list observer would not re-emit.
  const series$ = database
    .get<Series>('series')
    .query()
    .observeWithColumns(['name', 'sort_name', 'artwork']);
  // `canonical_number` is observed for the same reason as `position`: the
  // browse row renders it (as the collapsed range and the next-up badge), and
  // the editor writes it without touching membership, so a number-only edit
  // would otherwise not re-emit.
  const members$ = database
    .get<SeriesBook>('series_books')
    .query()
    .observeWithColumns([
      'series_id',
      'book_key',
      'position',
      'canonical_number',
    ]);
  return combineLatest([series$, members$]).pipe(
    map(([seriesModels, memberModels]) => ({
      series: seriesModels
        .filter((s) => s._raw._status !== 'deleted')
        .map((s) => ({
          id: s.id,
          name: s.name,
          sortName: s.sortName,
          artwork: s.artwork,
        })),
      memberships: memberModels
        .filter((m) => m._raw._status !== 'deleted')
        .map((m) => ({
          seriesId: (m._raw as any).series_id,
          bookKey: m.bookKey,
          position: m.position,
          canonicalNumber: m.canonicalNumber,
        })),
    })),
  );
}

/**
 * Every series and its membership rows, in the shape `reconcileSeries` reads.
 *
 * TWO QUERIES, JOINED IN MEMORY. A per-series membership fetch over ~28 series
 * is the shape `detectionQueries` was written to avoid, and this runs in the
 * same pass.
 *
 * The provenance columns are handed over RAW, not through the resolvers in
 * `seriesProvenance.ts`. That is not an oversight: `reconcileSeries` is a pure
 * module that must be testable against exactly what the database holds, and
 * what it holds on every device the moment v33 lands is `null` in all four
 * columns. It does its own coalescing (G5), and its tests pin the null case.
 */
export async function loadExistingSeries(): Promise<ExistingSeries[]> {
  const [seriesModels, memberModels] = await Promise.all([
    database.get<Series>('series').query().fetch(),
    database.get<SeriesBook>('series_books').query().fetch(),
  ]);

  const booksBySeriesId = new Map<string, ExistingSeries['books']>();
  for (const member of memberModels) {
    const seriesId = (member._raw as any).series_id;
    if (!seriesId) continue;
    const list = booksBySeriesId.get(seriesId) ?? [];
    list.push({
      bookKey: member.bookKey,
      position: member.position,
      canonicalNumber: member.canonicalNumber,
      canonicalSource: member.canonicalSourceRaw,
      membership: member.membershipRaw,
    });
    booksBySeriesId.set(seriesId, list);
  }

  return seriesModels.map((series) => ({
    id: series.id,
    name: series.name,
    origin: series.originRaw,
    nameSource: series.nameSourceRaw,
    books: booksBySeriesId.get(series.id) ?? [],
  }));
}

/**
 * A13 — the names the user has deleted, which detection must consult before
 * creating anything. Read once per run into a list, never queried per
 * candidate: G6's reasoning for leaving this table unindexed depends on it.
 *
 * Duplicates are returned as they are stored. There is no unique constraint
 * anywhere in this DB library (G7), so two rows for one name are possible, and
 * `reconcileSeries` normalises the list into a set anyway.
 */
export async function loadSuppressedSeriesNames(): Promise<string[]> {
  const rows = await database
    .get<SuppressedSeries>('suppressed_series')
    .query()
    .fetch();
  return rows.map((row) => row.name);
}

/**
 * The `Removed Series` list: one entry per deleted series, each carrying the
 * row ids a restore has to destroy.
 *
 * A separate function from `loadSuppressedSeriesNames` on purpose. That one
 * feeds the detector, which only ever asks "is this name vetoed?" and wants
 * the raw list; this one feeds a person, who needs distinct names to read and
 * stable ids to act on.
 */
export async function loadRemovedSeries(): Promise<RemovedSeriesEntry[]> {
  const rows = await database
    .get<SuppressedSeries>('suppressed_series')
    .query()
    .fetch();
  return groupRemovedSeries(rows.map((row) => ({ id: row.id, name: row.name })));
}

/**
 * Restore removed series by destroying their suppression rows. The next scan
 * then recreates them, because nothing else was ever kept — a suppression is a
 * veto, not a copy of the series.
 *
 * Takes row ids rather than a name so that `RemovedSeriesEntry` can hand back
 * exactly the rows it counted; G7's duplicates make "delete the row for this
 * name" an ambiguous instruction and "delete these rows" an exact one.
 *
 * A14 — this is a CREATE, not a bulk destroy, which is why `Restore All` is
 * allowed to exist where "delete all detected series" is not. The rows it
 * removes are the app's own veto records, and removing them gives the user
 * their series back.
 */
export async function restoreRemovedSeries(rowIds: string[]): Promise<void> {
  if (rowIds.length === 0) return;
  const wanted = new Set(rowIds);
  // One fetch of the whole table, not a chunked `Q.oneOf` — G6's reasoning for
  // leaving it unindexed is that it holds a handful of rows.
  const rows = await database
    .get<SuppressedSeries>('suppressed_series')
    .query()
    .fetch();
  const targets = rows.filter((row) => wanted.has(row.id));
  if (targets.length === 0) return;
  await database.write(async () => {
    await database.batch(targets.map((row) => row.prepareDestroyPermanently()));
  });
}

/** Build one `series_books` row from a planned member. Copies, never decides. */
function prepareMemberRow(
  seriesId: string,
  member: PlannedMember,
  now: Date,
): SeriesBook {
  return database.get<SeriesBook>('series_books').prepareCreate((sb) => {
    (sb._raw as any).series_id = seriesId;
    sb.bookKey = member.bookKey;
    sb.position = member.position;
    sb.canonicalNumber = member.canonicalNumber;
    sb.canonicalSource = member.canonicalSource;
    sb.membership = member.membership;
    sb.createdAt = now;
  });
}

/** What one `applyPlan` call wrote. Counts, for the scan log. */
export type ApplyPlanResult = {
  seriesCreated: number;
  /** Membership rows written for those new series. */
  rowsCreated: number;
  /** Membership rows added to series that already existed. */
  rowsInserted: number;
  rowsRemoved: number;
};

/**
 * Write a reconcile plan. **IO ONLY, AND DELIBERATELY UNTESTED** — that is the
 * entire point of putting two pure seams in front of it.
 *
 * IT MUST NOT MAKE DECISIONS. No provenance is read here, no name is compared,
 * no row is skipped on a rule: every verb in the plan is executed exactly as
 * written. If a conditional that answers *"should this row change?"* ever
 * appears below, it belongs in `reconcileSeries`, where jest can see it. The
 * branches that are here answer *"is there anything to do"* and *"which model
 * is this key pair"*, which is batching and lookup.
 *
 * Two things it does NOT do, both on purpose:
 *
 *  - **No `assertSeriesNameAvailable`.** A create only reaches here for a name
 *    that matched no existing series under `normalizeSortName` — reconcile's
 *    first pass claims or skips every name that did — so the check could only
 *    ever throw on a name detection is entitled to use, aborting the whole run.
 *    A15's disambiguation is what keeps detected names apart.
 *  - **No empty-series reaper.** It already ran earlier in the scan, and it
 *    cannot be needed here: rows are only ever removed from a series a
 *    proposal MATCHED, and a proposal carries at least two books (A5), so
 *    something is always inserted or already present. A plan cannot empty a
 *    series. A14 stands regardless — bulk actions create; they never destroy.
 *
 * Everything lands in ONE batch inside ONE writer, so a crash mid-scan cannot
 * leave a series row without its members.
 */
export async function applyPlan(plan: ReconcilePlan): Promise<ApplyPlanResult> {
  const result: ApplyPlanResult = {
    seriesCreated: plan.createSeries.length,
    rowsCreated: plan.createSeries.reduce((n, s) => n + s.books.length, 0),
    rowsInserted: plan.insertRows.length,
    rowsRemoved: 0,
  };

  // One fetch of the whole join table rather than a chunked `Q.oneOf` over
  // series ids — it is a few hundred rows, the prune above already reads it
  // this way, and it sidesteps SQLITE_MAX_VARIABLE_NUMBER entirely.
  let removals: SeriesBook[] = [];
  if (plan.removeRows.length > 0) {
    const targets = new Set(
      plan.removeRows.map((r) => `${r.seriesId} ${r.bookKey}`),
    );
    const all = await database.get<SeriesBook>('series_books').query().fetch();
    removals = all.filter((row) =>
      targets.has(`${(row._raw as any).series_id} ${row.bookKey}`),
    );
    result.rowsRemoved = removals.length;
  }

  if (
    result.seriesCreated === 0 &&
    result.rowsInserted === 0 &&
    result.rowsRemoved === 0
  ) {
    // The idempotent case, and the common one: a rescan of an unchanged
    // library plans nothing, so it opens no writer at all.
    return result;
  }

  await database.write(async () => {
    const now = new Date();
    const ops: any[] = [];

    for (const planned of plan.createSeries) {
      // prepareCreate assigns the id up front, which is what lets a series and
      // its members share one batch instead of one write per series.
      const series = database.get<Series>('series').prepareCreate((s) => {
        s.name = planned.name;
        s.sortName = normalizeSortName(planned.name);
        s.origin = planned.origin;
        s.nameSource = planned.nameSource;
        s.createdAt = now;
        s.updatedAt = now;
      });
      ops.push(series);
      for (const member of planned.books) {
        ops.push(prepareMemberRow(series.id, member, now));
      }
    }

    for (const row of plan.insertRows) {
      ops.push(prepareMemberRow(row.seriesId, row, now));
    }

    for (const row of removals) {
      ops.push(row.prepareDestroyPermanently());
    }

    await database.batch(ops);
  });

  return result;
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
 *
 * K8 applies here too, and this is the reason the release lives with the row
 * deletion rather than in the editor: **the editor is not the only thing that
 * destroys a series.** A series whose every book was moved on disk is reaped
 * right here, by a scan, with nobody watching — and it takes its pinned cover
 * off the books with it.
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
  const pinned = empties.map((s) => s.artwork);
  await database.write(async () => {
    await database.batch(empties.map((s) => s.prepareDestroyPermanently()));
  });
  await Promise.all(pinned.map((uri) => deleteArtworkFile(uri)));
}
