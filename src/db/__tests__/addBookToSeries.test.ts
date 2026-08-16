import {
  addBookToSeries,
  SeriesNameConflictError,
  updateSeries,
} from '@/db/seriesQueries';
import { seriesIdentityKey } from '@/helpers/seriesName';
import { type SeriesMembership } from '@/db/seriesProvenance';
import {
  FakeDatabase,
  FakeSeries,
  FakeSeriesBook,
} from './support/fakeDatabase';

/**
 * Ticket 26 — `Add to series…` must decide from the rows its own writer read.
 *
 * ── Why this test needs a database at all ─────────────────────────────────
 *
 * Every OTHER series test in this directory is a pure-function test, because
 * every other series decision lives in a pure function. This defect does not:
 * `planSeriesJoin` and `planEditorSave` are both correct in isolation and stay
 * correct here. What was wrong was the WIRING — `addBookToSeries` read the
 * rows, planned against them, and then handed the plan to `updateSeries`,
 * which opened `database.write` and read the same rows AGAIN. Everything the
 * plan asserted came from the first read, so a row that changed in between was
 * written back from a state that no longer existed.
 *
 * A fixture cannot reach that. The window IS the second read, so the test has
 * to be able to change the world between the two — which means a database, and
 * a hook that fires exactly where a competing writer would land.
 *
 * The harness itself — and why it is faked rather than booted, and why every
 * guard in it is transcribed from `node_modules` rather than invented — lives
 * in `./support/fakeDatabase`. Ticket 27 shares it.
 */

// `seriesQueries` reaches RNFS through `artworkFiles` (K8's unlink). Nothing
// under test here touches a file; this is only so the module can be required.
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/documents',
  unlink: jest.fn(async () => {}),
}));

jest.mock('@/db', () => ({
  __esModule: true,
  get default() {
    return mockDb;
  },
}));

let mockDb: FakeDatabase;

/* --------------------------------------------------------------- fixtures --- */

type SeededRow = {
  bookKey: string;
  position: number;
  canonicalNumber?: number | null;
  membership?: string;
};

function seedSeries(rows: SeededRow[], name = 'Discworld'): string {
  const series = mockDb.seed('series', {
    id: 'series-1',
    name,
    identity_key: seriesIdentityKey(name),
    origin: 'detected',
    name_source: 'detected',
    created_at: new Date(0),
    updated_at: new Date(0),
  });
  for (const row of rows) {
    mockDb.seed('series_books', {
      id: `row-${row.bookKey}`,
      series_id: series.id,
      book_key: row.bookKey,
      position: row.position,
      canonical_number: row.canonicalNumber ?? null,
      canonical_source: row.canonicalNumber == null ? null : 'detected',
      membership: row.membership ?? 'detected',
      created_at: new Date(0),
    });
  }
  return series.id;
}

/** Every stored row for the series, tombstones included, in position order. */
function storedRows(): {
  bookKey: string;
  position: number;
  canonicalNumber: number | null;
  membership: SeriesMembership;
}[] {
  return (mockDb.rowsIn('series_books') as FakeSeriesBook[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      bookKey: row.bookKey,
      position: row.position,
      canonicalNumber: row.canonicalNumber,
      membership: row.membership,
    }));
}

/** The numbers on the drawn list, in the order it is drawn. */
function visibleNumbers(): (number | null)[] {
  return visibleRows().map((row) => row.canonicalNumber);
}

/** What a surface would draw: tombstones are invisible, position sorts. */
function visibleRows(): ReturnType<typeof storedRows> {
  return storedRows().filter((row) => row.membership !== 'excluded');
}

function visibleOrder(): string[] {
  return visibleRows().map((row) => row.bookKey);
}

beforeEach(() => {
  mockDb = new FakeDatabase();
});

/*
 * ⚠ THE DEFECT (ticket 26). A scan's `pruneOrphanedSeriesBooks` destroys `c`'s
 * row in the window between the tap's read and the writer's read. The plan was
 * built against the first read, so `c` is still in `desiredKeysInOrder` — and
 * the writer's `computeMembershipDiff`, comparing that list against rows that
 * no longer contain `c`, emits it as a row to CREATE.
 *
 * The book is resurrected as `membership: 'user'`, which is the worst possible
 * value to be wrong about: regeneration only ever reclaims a `'detected'` row,
 * so no rescan will ever take it back out again.
 */
test('a row pruned while the tap was in flight is not resurrected', async () => {
  const seriesId = seedSeries([
    { bookKey: 'a', position: 0, canonicalNumber: 1 },
    { bookKey: 'b', position: 1, canonicalNumber: 2 },
    { bookKey: 'c', position: 2, canonicalNumber: 3 },
  ]);

  mockDb.onNextWriter(() => {
    // The scan found `c`'s file gone and pruned its membership row.
    const rows = mockDb.rowsIn('series_books');
    rows.splice(
      rows.findIndex((row) => (row as FakeSeriesBook).bookKey === 'c'),
      1,
    );
  });

  await addBookToSeries(seriesId, 'newcomer');

  expect(visibleOrder()).toEqual(['a', 'b', 'newcomer']);
  expect(storedRows().map((row) => row.bookKey)).not.toContain('c');
});

/*
 * ⚠ THE SAME DEFECT THROUGH THE OTHER DOOR. A stale desired list is not merely
 * out of date — `planEditorSave` reads it as an ASSERTION about the whole
 * series, so a key in it is a claim that the book belongs. `c` was tombstoned
 * in the window, but the stale list still named it, and `nextMembership` duly
 * flipped `'excluded'` back to `'user'`: a removal undone by a menu item that
 * never mentioned `c`.
 */
test('a row tombstoned while the tap was in flight is not un-tombstoned', async () => {
  const seriesId = seedSeries([
    { bookKey: 'a', position: 0, canonicalNumber: 1 },
    { bookKey: 'b', position: 1, canonicalNumber: 2 },
    { bookKey: 'c', position: 2, canonicalNumber: 3 },
  ]);

  mockDb.onNextWriter(() => {
    // An editor `Save` landed first and removed `c`, which is a tombstone.
    const row = mockDb
      .rowsIn('series_books')
      .find((r) => (r as FakeSeriesBook).bookKey === 'c') as FakeSeriesBook;
    row.membership = 'excluded';
  });

  await addBookToSeries(seriesId, 'newcomer');

  expect(visibleOrder()).toEqual(['a', 'b', 'newcomer']);
  expect(storedRows().find((row) => row.bookKey === 'c')?.membership).toBe(
    'excluded',
  );
});

/* ------------------------------------------- what must survive the change --- */

/*
 * Tickets 17 and 23, through the REAL write path rather than the planners.
 *
 * The two doors must land a re-added book in the same place, and the tombstone
 * is where the placement information lives — it remembers its slot the way it
 * remembers its number. Both were device-found defects, and moving the plan
 * inside the writer is exactly the kind of change that would quietly undo them.
 */
test('a re-joined book goes back to its slot with the number its tombstone kept', async () => {
  const seriesId = seedSeries([
    { bookKey: 'a', position: 0, canonicalNumber: 1 },
    { bookKey: 'b', position: 1, canonicalNumber: 2 },
    { bookKey: 'gone', position: 2, canonicalNumber: 3, membership: 'excluded' },
    { bookKey: 'd', position: 3, canonicalNumber: 4 },
  ]);

  await addBookToSeries(seriesId, 'gone');

  expect(visibleOrder()).toEqual(['a', 'b', 'gone', 'd']);
  // Its own number is restored, and — the ticket-17 trap — nobody else's is
  // blanked on the way past.
  expect(visibleNumbers()).toEqual([1, 2, 3, 4]);
  expect(storedRows().find((row) => row.bookKey === 'gone')?.membership).toBe(
    'user',
  );
});

/*
 * The decider's null. `planSeriesJoin` returns null when the book is already a
 * visible member, and the writer must then commit NOTHING — not a row, and not
 * the series' `updated_at`. Before ticket 26 that was decided before any writer
 * opened; now the writer opens first, so the no-op has to be real rather than
 * incidental.
 */
test('joining a book that is already a member writes nothing at all', async () => {
  const seriesId = seedSeries([
    { bookKey: 'a', position: 0, canonicalNumber: 1 },
    { bookKey: 'b', position: 1, canonicalNumber: 2 },
  ]);
  const before = storedRows();

  await addBookToSeries(seriesId, 'a');

  expect(storedRows()).toEqual(before);
  expect((mockDb.rowsIn('series')[0] as FakeSeries).updatedAt).toEqual(
    new Date(0),
  );
});

/* ------------------------------------------------------- the other door --- */

/*
 * `updateSeries` did not change behaviour, but its BODY moved into
 * `writeSeriesSave` — so the two things that live outside the plan and are easy
 * to drop in a move (A13's suppression clear, and the name assertion that runs
 * before the writer opens) need driving at least once. The join door reaches
 * neither: it passes the stored name straight back.
 */
test('an editor save writes the list and clears A13 suppression on the name it claims', async () => {
  const seriesId = seedSeries([
    { bookKey: 'a', position: 0, canonicalNumber: 1 },
    { bookKey: 'b', position: 1, canonicalNumber: 2 },
  ]);
  mockDb.seed('suppressed_series', {
    id: 'sup-1',
    name: 'Nightwatch',
    created_at: new Date(0),
  });

  await updateSeries(seriesId, 'Nightwatch', ['b', 'a'], [2, 1], ['a', 'b']);

  const series = mockDb.rowsIn('series')[0] as FakeSeries;
  expect(series.name).toBe('Nightwatch');
  // A rename claims the name, which is what makes the clear necessary.
  expect(series.nameSource).toBe('user');
  expect(mockDb.rowsIn('suppressed_series')).toEqual([]);
  expect(visibleOrder()).toEqual(['b', 'a']);
  expect(visibleNumbers()).toEqual([2, 1]);
});

/*
 * The name check runs BEFORE the writer, and must still: it is the one read
 * `updateSeries` legitimately does outside one, because it is asking about
 * OTHER series rather than about the rows it is going to write.
 */
test('an editor save refuses a name another series already holds, writing nothing', async () => {
  const seriesId = seedSeries([{ bookKey: 'a', position: 0, canonicalNumber: 1 }]);
  mockDb.seed('series', {
    id: 'series-2',
    name: 'Nightwatch',
    identity_key: seriesIdentityKey('Nightwatch'),
    origin: 'user',
    name_source: 'user',
    created_at: new Date(0),
    updated_at: new Date(0),
  });
  const before = storedRows();

  await expect(
    updateSeries(seriesId, 'Nightwatch', ['a'], [1], ['a']),
  ).rejects.toBeInstanceOf(SeriesNameConflictError);

  expect(storedRows()).toEqual(before);
  expect((mockDb.rowsIn('series')[0] as FakeSeries).name).toBe('Discworld');
});
