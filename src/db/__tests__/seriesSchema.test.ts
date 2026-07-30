import schema from '@/db/schema';

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
  expect(series.columns['sort_name']).toBeDefined();

  // Membership is keyed by a book's structural key (first file path), not
  // book.id, so both sides of the join are looked up and must be indexed.
  expect(join.columns['series_id'].isIndexed).toBe(true);
  expect(join.columns['book_key'].isIndexed).toBe(true);
  expect(join.columns['position']).toBeDefined();
});
