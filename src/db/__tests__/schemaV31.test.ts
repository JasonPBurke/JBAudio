import schema from '@/db/schema';

test('schema is v31 with series + series_books tables', () => {
  expect(schema.version).toBe(31);

  const series = schema.tables['series'];
  const join = schema.tables['series_books'];
  expect(series).toBeDefined();
  expect(join).toBeDefined();

  expect(series.columns['name']).toBeDefined();
  expect(series.columns['sort_name']).toBeDefined();

  expect(join.columns['series_id'].isIndexed).toBe(true);
  expect(join.columns['book_key'].isIndexed).toBe(true);
  expect(join.columns['position']).toBeDefined();
});
