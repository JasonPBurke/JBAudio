import database from '@/db';
import schema from '@/db/schema';

// The real adapter reaches for native SQLite, which does not exist under jest.
// Nothing below touches the database — the assertion is about which model
// classes were handed to it — so a stub adapter is enough to let the module
// under test be imported at all.
jest.mock('@nozbe/watermelondb/adapters/sqlite', () => ({
  __esModule: true,
  default: class StubAdapter {
    // The Database constructor reads `adapter.schema` to build its collection
    // map, so the stub has to carry through what it was handed.
    constructor(options: object) {
      Object.assign(this, options);
    }
  },
}));

/**
 * A table can exist in the schema and still be unusable: WatermelonDB resolves
 * a collection through the modelClasses list it was constructed with, so a new
 * table whose model was never registered throws on first use — in this case
 * inside a scan or a delete, long after this ticket is closed and far from the
 * line that caused it.
 */
describe('every table in the schema has a registered model', () => {
  it('resolves a collection for each one', () => {
    for (const tableName of Object.keys(schema.tables)) {
      // Note the failure mode this is written around: an unregistered table
      // does NOT throw here, it returns null. The crash lands later, at the
      // first property access on the collection, which is why asserting
      // "does not throw" would pass for a table with no model at all.
      const collection = database.get(tableName);
      expect(collection).not.toBeNull();
      expect(collection.modelClass.table).toBe(tableName);
    }
  });
});
