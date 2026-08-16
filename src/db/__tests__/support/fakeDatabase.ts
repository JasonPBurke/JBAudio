/**
 * A fake WatermelonDB, standing in for `@/db` in the query layer's tests.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * Most decisions in `src/db/` live in pure functions and are tested as such.
 * A few defects do not live in a decision at all — they live in WHERE a read
 * happens relative to the writer that acts on it. WatermelonDB serializes
 * writers but NOT readers, so a fetch outside `database.write` can be overtaken
 * before the batch lands, and no pure-function fixture can reach that: the
 * window IS the second read.
 *
 * `onNextWriter` is the whole point. It fires once, the moment a writer opens,
 * which is exactly where a competing writer lands — either it commits before
 * ours opens or after ours commits, and the queue admits nothing in between.
 * Tickets 26 and 27 are both about that boundary.
 *
 * ── Why faked rather than booted ──────────────────────────────────────────
 *
 * `seriesBackgroundsSetting.test.ts` gives the reason: WatermelonDB's LokiJS
 * adapter leaves an interval alive that stops jest exiting, and the SQLite
 * adapter is native. So this implements only the surface `src/db/` actually
 * touches, and THROWS on anything it does not understand — a fake that answers
 * an unrecognised query by returning everything is worse than no fake.
 *
 * ⚠ EVERY GUARD BELOW IS TRANSCRIBED FROM `node_modules`, NEVER INVENTED. A
 * fake that forbids something WatermelonDB permits fails code that works on a
 * device; that is the same defect as letting something through, pointing the
 * other way. Line references are to `@nozbe/watermelondb` as pinned.
 *
 * ⚠ It lives under `__tests__/support/` and jest is told to ignore that
 * directory (`testPathIgnorePatterns`), because the default `testMatch` treats
 * every file under `__tests__` as a suite and this one holds no tests.
 */

import {
  resolveCanonicalSource,
  resolveMembership,
  type SeriesMembership,
  type SeriesProvenance,
} from '@/db/seriesProvenance';

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
export class FakeRecord {
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

export class FakeSeries extends FakeRecord {
  get name(): string {
    return this._raw.name;
  }
  set name(value: string) {
    this._raw.name = sanitizeText(value);
  }
  get identityKey(): string {
    return this._raw.identity_key;
  }
  set identityKey(value: string) {
    this._raw.identity_key = sanitizeText(value);
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
  get artwork(): string | null {
    return this._raw.artwork ?? null;
  }
  set artwork(value: string | null) {
    this._raw.artwork = sanitizeText(value);
  }
}

export class FakeSeriesBook extends FakeRecord {
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

export class FakeSuppressedSeries extends FakeRecord {
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

/**
 * Only `Q.where(column, value)`. Anything else is a query the fake never saw,
 * and throwing is the point: a fake that answers an unrecognised query by
 * returning everything would have answered `assertSeriesNameAvailable`'s
 * `identity_key` query wrongly and silently.
 *
 * ⚠ The clause SHAPE is WatermelonDB's, not ours, and a rename of `left` or
 * `right` would filter everything out instead of throwing — every window test
 * would go green asserting nothing. `fakeDatabase.test.ts` pins it against the
 * real `Q` for exactly that reason.
 */
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

export class FakeDatabase {
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
