import schema from '@/db/schema';
import type { ColumnSchema, TableSchema } from '@nozbe/watermelondb';

// Deliberately asserts no literal schema version. This file used to pin
// `schema.version === 31`, which broke the moment main claimed v31 for the
// artwork cleanup and the series migration had to be renumbered to 32. The
// literal added nothing: coherence between the schema version and the newest
// migration is guarded generically in schemaMigrations.test.ts. What matters
// here is that the series tables landed and are shaped as seriesQueries expects.
test('series + series_books tables exist with the expected shape', () => {
  const series = schema.tables['series'];
  const join = schema.tables['series_books'];
  expect(series).toBeDefined();
  expect(join).toBeDefined();

  expect(series.columns['name']).toBeDefined();
  expect(series.columns['identity_key']).toBeDefined();

  // Membership is keyed by a book's structural key (first file path), not
  // book.id, so both sides of the join are looked up and must be indexed.
  expect(join.columns['series_id'].isIndexed).toBe(true);
  expect(join.columns['book_key'].isIndexed).toBe(true);
  expect(join.columns['position']).toBeDefined();
});

/**
 * The v33 additions — the whole Series data model, landed as one block of
 * optional columns that nothing reads yet.
 *
 * Still no literal version number anywhere below, for the reason above. These
 * assert SHAPE: that each column exists, carries the declared type, and is
 * optional. Optionality is the load-bearing property, not a style choice —
 * `addColumns` silently drops `defaultValue`, so a NON-optional column is
 * backfilled by the library's null-value function (string -> '', number -> 0,
 * boolean -> false). A non-optional enum would therefore hold '', a value its
 * TypeScript union says cannot exist.
 */
function column(table: TableSchema, name: string): ColumnSchema {
  const found = table.columns[name];
  if (!found) {
    throw new Error(`${table.name} has no column '${name}'`);
  }
  return found;
}

function expectOptional(
  table: TableSchema,
  name: string,
  type: ColumnSchema['type'],
): void {
  const col = column(table, name);
  expect(col.type).toBe(type);
  expect(col.isOptional).toBe(true);
  // §G6: no new indexes on the Series columns. The one index this migration
  // adds is book_tags.book_id, a foreign key on a table that grows with the
  // library — asserted separately below.
  expect(col.isIndexed).toBeFalsy();
}

describe('v33 — Series provenance columns', () => {
  it('series carries origin, name_source and its own artwork', () => {
    const series = schema.tables['series'];
    expectOptional(series, 'origin', 'string');
    expectOptional(series, 'name_source', 'string');
    // No *_source companion: artwork is either pinned or derived, and a
    // derived cover is not a stored value that could have a provenance.
    expectOptional(series, 'artwork', 'string');
  });

  it('series_books carries the canonical number, its source and membership', () => {
    const join = schema.tables['series_books'];
    // A number on first appearance — the string form never shipped in a
    // schema, so this costs no type-change migration.
    expectOptional(join, 'canonical_number', 'number');
    expectOptional(join, 'canonical_source', 'string');
    expectOptional(join, 'membership', 'string');
  });

  it('leaves position as the sole sort authority', () => {
    // canonical_number is displayed; it never reorders anything. Position is
    // non-optional and predates v33, so it must not have been touched.
    expect(schema.tables['series_books'].columns['position'].isOptional).toBeFalsy();
  });
});

describe('v33 — the suppression table', () => {
  it('exists with a name and a timestamp', () => {
    const table = schema.tables['suppressed_series'];
    expect(table).toBeDefined();
    expect(table.columns['name'].type).toBe('string');
    expect(table.columns['created_at'].type).toBe('number');
  });

  it('does not index the name', () => {
    // Read once into a Set per detection run (a batch over ~28 candidates),
    // never queried row-by-row. And an index would not enforce uniqueness
    // anyway — the DB library has no unique-constraint support at all, which
    // is why the de-duplication has to happen in JS on write.
    expect(schema.tables['suppressed_series'].columns['name'].isIndexed).toBeFalsy();
  });
});

describe('v33 — the three Series settings', () => {
  const settings = () => schema.tables['settings'];

  it('adds one boolean column per preference', () => {
    // Settings in this app ARE schema: one column on a single-row table.
    // There is no existing column any of these could ride.
    expectOptional(settings(), 'series_backgrounds_enabled', 'boolean');
    expectOptional(settings(), 'series_detection_enabled', 'boolean');
    expectOptional(settings(), 'series_folder_grouping_enabled', 'boolean');
  });

  it('stores no default in the schema, for any of them', () => {
    // Two of these are default-ON and one is default-OFF, and the schema
    // cannot express that difference — every one is null until written. The
    // default lives in the getter, which is why the two default-ON ones need
    // the inverted `!== false` idiom rather than the house `=== true`.
    expect(settings().columns['series_backgrounds_enabled'].isOptional).toBe(true);
    expect(settings().columns['series_detection_enabled'].isOptional).toBe(true);
    expect(settings().columns['series_folder_grouping_enabled'].isOptional).toBe(true);
  });
});

describe('v33 — tag capture', () => {
  it('books gains the four queryable tag columns', () => {
    const books = schema.tables['books'];
    // The detector's two highest-trust signals were never persisted by
    // anything: extractMetadataFromResult is a funnel that drops them.
    expectOptional(books, 'series', 'string');
    expectOptional(books, 'part', 'number');
    expectOptional(books, 'grouping', 'string');
    expectOptional(books, 'file_format', 'string');
  });

  it('keeps the raw tag blob on its own table, not on books', () => {
    // Load-bearing: WatermelonDB reads a model's FULL raw record into memory
    // and the library store observes seventeen books columns across the whole
    // library, so a ~2 KB JSON string on books would ride every library
    // query. On its own table it is read only when something asks for it.
    const tags = schema.tables['book_tags'];
    expect(tags).toBeDefined();
    expect(tags.columns['raw_json'].type).toBe('string');
    expect(tags.columns['captured_at'].type).toBe('number');
    expect(schema.tables['books'].columns['raw_json']).toBeUndefined();
  });

  it('indexes book_tags.book_id — the one index this model adds', () => {
    // A foreign key on a table that grows with the library, which is the
    // exact shape the existing indexed columns have.
    expect(schema.tables['book_tags'].columns['book_id'].isIndexed).toBe(true);
  });
});
