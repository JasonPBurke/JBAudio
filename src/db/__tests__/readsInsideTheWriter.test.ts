import {
  deleteEmptySeries,
  pruneOrphanedSeriesBooks,
  restoreRemovedSeries,
} from '@/db/seriesQueries';
import { normalizeSortName } from '@/helpers/seriesName';
import {
  FakeDatabase,
  FakeSeries,
  FakeSeriesBook,
  FakeSuppressedSeries,
} from './support/fakeDatabase';

/**
 * Ticket 27 — the file's three remaining bulk write paths must decide from
 * rows their own writer read.
 *
 * WatermelonDB serializes writers but NOT readers. A fetch outside
 * `database.write` can be overtaken by another writer before the batch lands,
 * so any decision derived from it is executed against a world that has moved.
 * `applyPlan` was fixed under review finding 11, `addBookToSeries` under ticket
 * 26; these are the last three.
 *
 * ⚠ THE TICKET'S OWN CRITERION 1 IS OUT OF DATE. It says to test "against the
 * pure seam — the writer itself is not reachable from jest", which was true
 * when it was written and stopped being true with ticket 26's fake `@/db`. It
 * matters, because the property under test here is NOT expressible at a pure
 * seam: `selectEmptySeriesIds` never sees a window, so no input to it can
 * distinguish a read taken before the window from one taken after. The defect
 * lives in the wiring, so the test has to.
 *
 * See `./support/fakeDatabase` for the harness and `onNextWriter`, which fires
 * where a competing writer actually lands.
 */

const mockUnlink = jest.fn(async (_path: string) => {});

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/documents',
  unlink: (path: string) => mockUnlink(path),
}));

jest.mock('@/db', () => ({
  __esModule: true,
  get default() {
    return mockDb;
  },
}));

let mockDb: FakeDatabase;

beforeEach(() => {
  mockDb = new FakeDatabase();
  mockUnlink.mockClear();
});

/* --------------------------------------------------------------- fixtures --- */

function seedSeries(id: string, name: string, artwork: string | null = null) {
  mockDb.seed('series', {
    id,
    name,
    sort_name: normalizeSortName(name),
    origin: 'detected',
    name_source: 'detected',
    artwork,
    created_at: new Date(0),
    updated_at: new Date(0),
  });
  return id;
}

function seedRow(seriesId: string, bookKey: string) {
  mockDb.seed('series_books', {
    id: `${seriesId}-${bookKey}`,
    series_id: seriesId,
    book_key: bookKey,
    position: 0,
    canonical_number: null,
    canonical_source: null,
    membership: 'detected',
    created_at: new Date(0),
  });
}

const seriesIds = (): string[] =>
  mockDb.rowsIn('series').map((row) => (row as FakeSeries).id);

const memberKeys = (): string[] =>
  mockDb.rowsIn('series_books').map((row) => (row as FakeSeriesBook).bookKey);

const suppressionIds = (): string[] =>
  mockDb.rowsIn('suppressed_series').map((row) => (row as FakeSuppressedSeries).id);

/* ------------------------------------------------------ deleteEmptySeries --- */

/*
 * ⚠ THE DEFECT, and it is the one site of the three with a real victim: a scan
 * empties S, this reads and marks it empty, the user's `Add to series…` tap
 * commits a row, and the reaper destroys S anyway — losing the pinned cover
 * irreversibly and leaving the new row pointing at a series that is gone.
 *
 * The route and the cost are written out at `deleteEmptySeries` itself. Kept
 * there rather than restated here: the argument cites `AddToSeriesPanel` and
 * §K8, and two copies of a citation are two things to keep in step.
 */
test('a series that gains a member in the window is not reaped', async () => {
  seedSeries('s-1', 'Discworld', 'file:///documents/artwork/series_s-1.webp');

  mockDb.onNextWriter(() => {
    // The user's `Add to series…` tap landed first.
    seedRow('s-1', '/books/mort/01.mp3');
  });

  await deleteEmptySeries();

  expect(seriesIds()).toEqual(['s-1']);
  expect(mockUnlink).not.toHaveBeenCalled();
});

/* The other half of the same rule: it must still reap, and still release the
 * cover, or the fix would be "never delete anything" wearing a disguise. */
test('a series that is still empty when the writer opens is reaped, cover and all', async () => {
  seedSeries('s-1', 'Discworld', 'file:///documents/artwork/series_s-1.webp');
  seedSeries('s-2', 'Bobiverse');
  seedRow('s-2', '/books/we-are-legion/01.mp3');

  await deleteEmptySeries();

  expect(seriesIds()).toEqual(['s-2']);
  expect(mockUnlink).toHaveBeenCalledWith('/documents/artwork/series_s-1.webp');
});

/* ----------------------------------------------- pruneOrphanedSeriesBooks --- */

/*
 * This site has NO victim: its only decision input is `book_key`, which is
 * never updated, so a stale read cannot make it destroy the wrong row. What the
 * stale read cost was rows it could not SEE — a join landing a row with an
 * already-dead key behind the prune's back, which then dangles until some
 * later, unrelated scan runs the prune again (its trigger is
 * `scanLibrary.ts:1014`, not every scan).
 *
 * ⚠ Whether widening what a BLOCKLIST can see is safe — and the concurrent-scan
 * assumption it rests on — is argued at `pruneOrphanedSeriesBooks` itself.
 */
test('a row created in the window for a book the scan orphaned is pruned in the same pass', async () => {
  seedSeries('s-1', 'Discworld');
  seedRow('s-1', '/books/mort/01.mp3');
  // ⚠ LOAD-BEARING FIXTURE. Without an orphan that predates the window, the
  // `orphans.length === 0` early return fires and NO WRITER EVER OPENS — so
  // the hook below never runs, no second row is created, and the assertion
  // passes against the unfixed code for the wrong reason. Caught exactly that
  // way: the first version of this test was green before the fix.
  seedRow('s-1', '/books/moved-earlier/01.mp3');

  mockDb.onNextWriter(() => {
    // The user tapped `Add to series…` for a book this scan had just removed.
    seedRow('s-1', '/books/gone/01.mp3');
  });

  await pruneOrphanedSeriesBooks(new Set(['/books/mort/01.mp3']));

  expect(memberKeys()).toEqual(['/books/mort/01.mp3']);
});

/* -------------------------------------------------- restoreRemovedSeries --- */

/*
 * ⚠ NO RED WAS AVAILABLE HERE, AND THAT IS RECORDED RATHER THAN PAPERED OVER.
 * Nothing a competing writer can do changes this site's answer, so the two
 * tests below are GUARDS on a behaviour-preserving change — they pass on both
 * sides of it. Why it moved anyway is argued at `restoreRemovedSeries`.
 */
test('exactly the chosen suppressions are destroyed', async () => {
  for (const id of ['sup-1', 'sup-2', 'sup-3']) {
    mockDb.seed('suppressed_series', { id, name: id, created_at: new Date(0) });
  }

  await restoreRemovedSeries(['sup-1', 'sup-3']);

  expect(suppressionIds()).toEqual(['sup-2']);
});

/*
 * ⚠ The ticket's note: "Opening a writer is not free... preserve that property
 * wherever the fetch moves inside." All three sites keep it, and all three keep
 * it the same way — an outer gate that needs no read. This one's is `rowIds`;
 * the prune's and the reaper's is their caller's `orphanedBooks.length > 0`.
 */
test('no ids opens no writer at all', async () => {
  let writerOpened = false;
  mockDb.onNextWriter(() => {
    writerOpened = true;
  });

  await restoreRemovedSeries([]);

  expect(writerOpened).toBe(false);
});
