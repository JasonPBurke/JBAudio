import { Q } from '@nozbe/watermelondb';

import {
  addBookToSeries,
  SeriesNameConflictError,
  updateSeries,
} from '@/db/seriesQueries';
import { normalizeSortName } from '@/helpers/seriesName';
import {
  resolveCanonicalSource,
  resolveMembership,
  type SeriesMembership,
  type SeriesProvenance,
} from '@/db/seriesProvenance';

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
 * ── Why the database is faked rather than booted ──────────────────────────
 *
 * Same reason `seriesBackgroundsSetting.test.ts` gives: WatermelonDB's LokiJS
 * adapter leaves an interval alive that stops jest exiting, and the SQLite
 * adapter is native. The fake below implements only the surface `seriesQueries`
 * actually touches and THROWS on anything it does not understand, so it cannot
 * quietly answer a query wrongly.
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

/* ------------------------------------------------------ the fake database --- */

type Raw = Record<string, any>;
type PreparedState = 'create' | 'update' | 'destroyPermanently' | null;

/**
 * A `@text` column, which SANITIZES on the way in — WatermelonDB's decorator is
 * `'string' === typeof value ? value.trim() : null`. `@field` and `@date`
 * columns do not, which is why only some setters below go through this.
 */
function sanitizeText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

/**
 * The half of `Model` the query layer uses, with the invariants that half
 * actually carries. Every one of them is transcribed from the real thing
 * rather than invented — a fake that guards something WatermelonDB permits
 * would fail code that works on a device, which is the same failure as letting
 * something through, pointing the other way:
 *
 *  - `prepareUpdate` refuses a second call before the batch (`Model:104`). This
 *    is the one `updateSeries`' merged one-update-per-row rule exists to
 *    satisfy, and the row that hits it is one both dragged AND renumbered.
 *  - `prepareDestroyPermanently` refuses the same (`Model:199`) and flips
 *    `_status` to `'deleted'` (`Model:201`), which is a value the query layer
 *    reads: `assertSeriesNameAvailable` ignores rows already deleted.
 */
class FakeRecord {
  _raw: Raw;
  _table: string;
  _preparedState: PreparedState = null;

  constructor(table: string, raw: Raw) {
    this._table = table;
    this._raw = raw;
  }

  get id(): string {
    return this._raw.id;
  }

  prepareUpdate(updater: (record: any) => void): this {
    if (this._preparedState) {
      throw new Error('Cannot update a record with pending changes');
    }
    this._preparedState = 'update';
    updater(this);
    return this;
  }

  prepareDestroyPermanently(): this {
    if (this._preparedState) {
      throw new Error('Cannot destroy permanently record with pending changes');
    }
    this._raw._status = 'deleted';
    this._preparedState = 'destroyPermanently';
    return this;
  }
}

class FakeSeries extends FakeRecord {
  get name(): string {
    return this._raw.name;
  }
  set name(value: string) {
    this._raw.name = sanitizeText(value);
  }
  get sortName(): string {
    return this._raw.sort_name;
  }
  set sortName(value: string) {
    this._raw.sort_name = sanitizeText(value);
  }
  get nameSource(): string {
    return this._raw.name_source ?? 'user';
  }
  set nameSource(value: string) {
    this._raw.name_source = sanitizeText(value);
  }
  get updatedAt(): Date {
    return this._raw.updated_at;
  }
  set updatedAt(value: Date) {
    this._raw.updated_at = value;
  }
}

class FakeSeriesBook extends FakeRecord {
  get bookKey(): string {
    return this._raw.book_key;
  }
  set bookKey(value: string) {
    this._raw.book_key = sanitizeText(value);
  }
  get position(): number {
    return this._raw.position;
  }
  set position(value: number) {
    this._raw.position = value;
  }
  get canonicalNumber(): number | null {
    return this._raw.canonical_number ?? null;
  }
  set canonicalNumber(value: number | null) {
    this._raw.canonical_number = value;
  }
  get canonicalSourceRaw(): string | null {
    return this._raw.canonical_source ?? null;
  }
  get canonicalSource(): SeriesProvenance | null {
    return resolveCanonicalSource(this.canonicalSourceRaw);
  }
  set canonicalSource(value: SeriesProvenance | null) {
    this._raw.canonical_source = sanitizeText(value);
  }
  get membershipRaw(): string | null {
    return this._raw.membership ?? null;
  }
  get membership(): SeriesMembership {
    return resolveMembership(this.membershipRaw);
  }
  set membership(value: SeriesMembership) {
    this._raw.membership = sanitizeText(value);
  }
  get createdAt(): Date {
    return this._raw.created_at;
  }
  set createdAt(value: Date) {
    this._raw.created_at = value;
  }
}

class FakeSuppressedSeries extends FakeRecord {
  get name(): string {
    return this._raw.name;
  }
}

const RECORD_CLASSES: Record<string, new (table: string, raw: Raw) => FakeRecord> =
  {
    series: FakeSeries,
    series_books: FakeSeriesBook,
    suppressed_series: FakeSuppressedSeries,
  };

/** Only `Q.where(column, value)`. Anything else is a query the fake never saw. */
function matchesClauses(raw: Raw, clauses: readonly any[]): boolean {
  return clauses.every((clause) => {
    if (clause?.type !== 'where' || clause?.comparison?.operator !== 'eq') {
      throw new Error(
        `fake database understands only Q.where(col, value): ${JSON.stringify(clause)}`,
      );
    }
    return raw[clause.left] === clause.comparison.right.value;
  });
}

class FakeDatabase {
  tables: Record<string, FakeRecord[]> = {
    series: [],
    series_books: [],
    suppressed_series: [],
  };
  /** Fires once, the moment a writer opens — where a competing writer lands. */
  private writerHook: (() => void) | null = null;
  private writerRunning = false;
  private nextId = 1;

  onNextWriter(hook: () => void): void {
    this.writerHook = hook;
  }

  rowsIn(table: string): FakeRecord[] {
    const rows = this.tables[table];
    if (!rows) throw new Error(`fake database has no table "${table}"`);
    return rows;
  }

  seed(table: string, raw: Raw): FakeRecord {
    const Class = RECORD_CLASSES[table] ?? FakeRecord;
    const record = new Class(table, { _status: 'created', ...raw });
    this.rowsIn(table).push(record);
    return record;
  }

  get(table: string) {
    const db = this;
    return {
      async find(id: string) {
        const found = db.rowsIn(table).find((row) => row.id === id);
        if (!found) throw new Error(`record ${id} not found in ${table}`);
        return found;
      },
      query(...clauses: any[]) {
        return {
          async fetch() {
            return db
              .rowsIn(table)
              .filter((row) => matchesClauses(row._raw, clauses));
          },
        };
      },
      prepareCreate(builder: (record: any) => void) {
        const Class = RECORD_CLASSES[table] ?? FakeRecord;
        const record = new Class(table, {
          id: `${table}-${db.nextId++}`,
          _status: 'created',
        });
        record._preparedState = 'create';
        builder(record);
        return record;
      },
    };
  }

  async write<T>(work: () => Promise<T>): Promise<T> {
    const hook = this.writerHook;
    this.writerHook = null;
    hook?.();
    this.writerRunning = true;
    try {
      return await work();
    } finally {
      this.writerRunning = false;
    }
  }

  /**
   * Both guards are the real `Database.batch`'s, not inventions: it calls
   * `_ensureInWriter` (`Database:83`) and throws on a record with no prepared
   * state (`Database:93-95`). Either one silently tolerated here would let a
   * write through jest that crashes on a device — which for a fake standing in
   * for the thing ticket 26 is about is the whole risk.
   */
  async batch(ops: FakeRecord[]): Promise<void> {
    if (!this.writerRunning) {
      throw new Error(
        'Database.batch() can only be called from inside of a Writer.',
      );
    }
    for (const op of ops) {
      if (!op._preparedState) {
        throw new Error(
          "Cannot batch a record that doesn't have a prepared create/update/delete",
        );
      }
      if (op._preparedState === 'create') this.rowsIn(op._table).push(op);
      if (op._preparedState === 'destroyPermanently') {
        const rows = this.rowsIn(op._table);
        const index = rows.indexOf(op);
        if (index >= 0) rows.splice(index, 1);
      }
      // An 'update' already applied its changes in place, as the real one does.
      op._preparedState = null;
    }
  }
}

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
    sort_name: normalizeSortName(name),
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
 * The fake reads WatermelonDB's clause objects directly, which is a dependency
 * on a shape the library owns. `matchesClauses` THROWS on anything it does not
 * recognise, so a renamed `type` or `operator` fails loudly — but a renamed
 * `left` or `right` would just filter everything out and turn every test below
 * green-for-the-wrong-reason. This is the assumption, stated against the real
 * `Q`, so an upgrade that moves it says so here rather than there.
 */
test('the fake reads the clause shape `Q.where` actually produces', () => {
  expect(Q.where('series_id', 's1')).toEqual({
    type: 'where',
    left: 'series_id',
    comparison: { operator: 'eq', right: { value: 's1' } },
  });
});

/* ------------------------------------------------------------ the ticket --- */

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
    sort_name: normalizeSortName('Nightwatch'),
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
