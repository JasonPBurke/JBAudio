import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { appSchema, tableSchema } from '@nozbe/watermelondb';
import {
  encodeSchema,
  encodeMigrationSteps,
} from '@nozbe/watermelondb/adapters/sqlite/encodeSchema';
import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

import migrations from '@/db/migrations';
import schema from '@/db/schema';
import Series from '@/db/models/Series';
import SeriesBook from '@/db/models/SeriesBook';

// See schemaMigrationV31.behavior.test.ts for why this cast is needed.
const resolveModule = (
  require as unknown as { resolve: (id: string) => string }
).resolve;

/**
 * The upgrade path, executed rather than described.
 *
 * The shape assertions elsewhere prove the migration and the schema AGREE.
 * They cannot prove what an existing row ends up holding, which is the whole
 * question this migration turns on: a row that reads as 'detected' when it is
 * really the user's is eligible to be clobbered by a detection run.
 *
 * So this builds a real v32 database, puts a real series in it, runs the real
 * SQL the adapter would run, and reads the result back through the real model
 * getters.
 */
const newest = (() => {
  const migration = migrations.sortedMigrations.find(
    m => m.toVersion === migrations.maxVersion,
  );
  if (!migration) throw new Error('no newest migration');
  return migration;
})();

/** Tables the newest migration creates — absent from the database before it runs. */
const tablesCreatedByNewest = new Set(
  newest.steps.flatMap(step =>
    step.type === 'create_table' ? [step.schema.name] : [],
  ),
);

/** Columns the newest migration adds, as `table` -> column names. */
const columnsAddedByNewest = new Map<string, string[]>(
  newest.steps.flatMap(step =>
    step.type === 'add_columns'
      ? [[step.table, step.columns.map(c => c.name)] as [string, string[]]]
      : [],
  ),
);

/**
 * The schema as it stood BEFORE the newest migration: today's schema minus
 * everything that migration introduces. Derived rather than hardcoded, so this
 * keeps describing "the previous version" as the schema moves on.
 */
function previousSchema() {
  return appSchema({
    version: schema.version - 1,
    tables: Object.values(schema.tables)
      .filter(table => !tablesCreatedByNewest.has(table.name))
      .map(table => {
        const added = new Set(columnsAddedByNewest.get(table.name) ?? []);
        return tableSchema({
          name: table.name,
          columns: table.columnArray.filter(column => !added.has(column.name)),
        });
      }),
  });
}

/** Reads a raw SQLite row back through a model's decorated getters. */
function asModel<T>(ModelClass: { prototype: object }, raw: object): T {
  const record = Object.create(ModelClass.prototype) as T;
  (record as unknown as { _raw: object })._raw = raw;
  return record;
}

function selectOne(db: SqlJsDatabase, sql: string): Record<string, unknown> {
  const [result] = db.exec(sql);
  if (!result) throw new Error(`no rows for: ${sql}`);
  return Object.fromEntries(
    result.columns.map((column, i) => [column, result.values[0][i]]),
  );
}

describe('the newest migration, run against a real database of the previous version', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: file => resolveModule(`sql.js/dist/${file}`),
    });
  });

  beforeEach(() => {
    db = new SQL.Database();
    // A device sitting on the previous version, with a series the user made.
    db.run(encodeSchema(previousSchema()));
    db.run(
      `INSERT INTO series (id, _status, _changed, name, sort_name, created_at, updated_at)
       VALUES ('s1', 'synced', '', 'Discworld', 'discworld', 1754000000000, 1754000000000);`,
    );
    db.run(
      `INSERT INTO series_books (id, _status, _changed, series_id, book_key, position, created_at)
       VALUES ('sb1', 'synced', '', 's1', '/sd/Guards.m4b', 0, 1754000000000);`,
    );
    db.run(
      `INSERT INTO books (id, _status, _changed, title, book_duration, total_track_count, created_at, updated_at, book_progress_value, author_id)
       VALUES ('b1', 'synced', '', 'Guards! Guards!', 100, 1, 1754000000000, 1754000000000, 0, 'a1');`,
    );

    db.run(encodeMigrationSteps(newest.steps));
  });

  afterEach(() => {
    db.close();
  });

  it('leaves the pre-existing series row reading as user-owned', () => {
    // The load-bearing assertion of the whole ticket. Not "the column is
    // null" — that is a detail — but "the app concludes the user owns this",
    // which is what stops a rescan from overwriting a hand-made series.
    const series = asModel<Series>(Series, selectOne(db, 'SELECT * FROM series;'));
    expect(series.origin).toBe('user');
    expect(series.nameSource).toBe('user');
    expect(series.artwork).toBeNull();
  });

  it('leaves the pre-existing membership row reading as user-owned, with no number', () => {
    const row = asModel<SeriesBook>(
      SeriesBook,
      selectOne(db, 'SELECT * FROM series_books;'),
    );
    expect(row.membership).toBe('user');
    // Not 'user' — nobody set a number, and saying otherwise would invent one.
    expect(row.canonicalSource).toBeNull();
    expect(row.canonicalNumber).toBeNull();
  });

  it('leaves the pre-existing book with no captured tags', () => {
    // No backfill ships: these fill when the file is scanned as new.
    const book = selectOne(db, 'SELECT * FROM books;');
    expect(book.series).toBeNull();
    expect(book.part).toBeNull();
    expect(book.grouping).toBeNull();
    expect(book.file_format).toBeNull();
    // The book itself is untouched.
    expect(book.title).toBe('Guards! Guards!');
  });

  it('creates the new tables empty', () => {
    for (const table of tablesCreatedByNewest) {
      const [count] = db.exec(`SELECT COUNT(*) FROM ${table};`);
      expect(count.values[0][0]).toBe(0);
    }
  });

  it('creates exactly one new index, on book_tags.book_id', () => {
    // WatermelonDB also emits a _status index per table, which is not one of
    // ours — filter to indexes on the columns this migration introduced.
    const [indexes] = db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE '%__status';",
    );
    const names = indexes.values.map(row => String(row[0]));
    expect(names).toContain('book_tags_book_id');
    for (const [table, columns] of columnsAddedByNewest) {
      for (const column of columns) {
        expect(names).not.toContain(`${table}_${column}`);
      }
    }
  });

  it('runs clean against the empty series tables a real device has', () => {
    // A device coming from v31 gets the series tables created empty by v32 and
    // then immediately altered by v33 — zero rows, which is why no backfill
    // was needed in the first place. Same SQL, nothing in the tables.
    const fresh = new SQL.Database();
    fresh.run(encodeSchema(previousSchema()));
    expect(() => fresh.run(encodeMigrationSteps(newest.steps))).not.toThrow();
    const [count] = fresh.exec('SELECT COUNT(*) FROM series;');
    expect(count.values[0][0]).toBe(0);
    fresh.close();
  });
});

describe('why every added column is optional (a characterisation test)', () => {
  // This pins a DEPENDENCY's behaviour, deliberately. The entire nullability
  // decision rests on it, it is not documented anywhere in the library, and if
  // a WatermelonDB upgrade ever changed it we would want a red test rather
  // than a silent change in what existing rows hold.
  it('ignores defaultValue entirely, and backfills from the column type', () => {
    const step = addColumns({
      table: 'series',
      columns: [{ name: 'origin_nonoptional', type: 'string' }],
      // @ts-expect-error deliberately passing the field the API does not have.
      defaultValue: 'user',
    });

    const sql = encodeMigrationSteps([step]);

    // The value it would actually write is the empty string — which for an
    // enum column is a value its own TypeScript union says cannot exist.
    expect(sql).toContain(`update "series" set "origin_nonoptional" = ''`);
    expect(sql).not.toContain('user');
  });

  it('writes null for an optional column, which is what this migration relies on', () => {
    const sql = encodeMigrationSteps([
      addColumns({
        table: 'series',
        columns: [{ name: 'origin_optional', type: 'string', isOptional: true }],
      }),
    ]);

    expect(sql).toContain(`update "series" set "origin_optional" = null`);
  });
});
