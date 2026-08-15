import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

import migrations from '@/db/migrations';

// The global `require` here is typed by expo's Metro-flavored
// NodeJS.Require (node_modules/expo/types/metro-require.d.ts), which models
// `require(path)` and `require.context` but not Node's `require.resolve` —
// there's no metro-time equivalent. This test runs under plain Jest/Node
// though, where `require.resolve` exists at runtime; the cast below only
// widens the type locally so `initSqlJs` can locate its `.wasm` asset.
const resolveModule = (
  require as unknown as { resolve: (id: string) => string }
).resolve;

/**
 * Behavioural companion to schemaMigrations.test.ts's spelling-based checks.
 * Those assert the SQL *string* shape (e.g. contains "NOT LIKE 'file://%'")
 * but a string like "... OR 1=1" would still satisfy every one of them and
 * would null out every row. This file pulls the actual SQL the v31 migration
 * ships and executes it against a real in-memory SQLite table, so a predicate
 * regression is caught by running the statement, not by pattern-matching it.
 */
function soleSqlStep(toVersion: number): string {
  const migration = migrations.sortedMigrations.find(
    m => m.toVersion === toVersion,
  );
  if (!migration) {
    throw new Error(`no migration to version ${toVersion}`);
  }
  if (migration.steps.length !== 1) {
    throw new Error(
      `migration ${toVersion} has ${migration.steps.length} steps, expected 1`,
    );
  }
  const [step] = migration.steps;
  if (step.type !== 'sql') {
    throw new Error(
      `migration ${toVersion} step is '${step.type}', expected 'sql'`,
    );
  }
  return step.sql;
}

// Real scan-extracted cover (scanLibrary.ts:649).
const SCAN_COVER =
  'file:///data/user/0/com.jbaudio/files/artwork/Pratchett_TheCarpetPeople_1a2b3c4d.webp';
// Manually-picked cover with cache-buster (replaceArtwork.ts, `replaceArtwork`).
const PICKED_COVER_WITH_CACHE_BUSTER =
  'file:///data/user/0/com.jbaudio/files/artwork/Pratchett_TheCarpetPeople_1a2b3c4d.webp?t=1753000000000';
// Schemeless resource id, release-build placeholder.
const RELEASE_PLACEHOLDER = 'src_assets_images_unknown_track';
// Metro URL, debug-build placeholder.
const DEBUG_PLACEHOLDER =
  'http://10.0.2.2:8081/assets/src/assets/images/unknown_track.png';

describe('v31 migration SQL — executed against a real table', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: file => resolveModule(`sql.js/dist/${file}`),
    });
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run('CREATE TABLE books (id INTEGER PRIMARY KEY, artwork TEXT);');
    db.run(
      `INSERT INTO books (id, artwork) VALUES
        (1, ?),
        (2, ?),
        (3, ?),
        (4, ?),
        (5, ''),
        (6, NULL);`,
      [
        SCAN_COVER,
        PICKED_COVER_WITH_CACHE_BUSTER,
        RELEASE_PLACEHOLDER,
        DEBUG_PLACEHOLDER,
      ],
    );
  });

  afterEach(() => {
    db.close();
  });

  it('nulls everything except the two file:// values, and leaves NULL as NULL', () => {
    db.run(soleSqlStep(31));

    const surviving = db.exec(
      'SELECT artwork FROM books WHERE artwork IS NOT NULL ORDER BY id;',
    );
    const survivingValues =
      surviving.length === 0 ? [] : surviving[0].values.map(row => row[0]);
    expect(survivingValues).toEqual([
      SCAN_COVER,
      PICKED_COVER_WITH_CACHE_BUSTER,
    ]);

    const nullCountResult = db.exec(
      'SELECT COUNT(*) FROM books WHERE artwork IS NULL;',
    );
    const nullCount = nullCountResult[0].values[0][0];
    // Rows 3, 4, 5 get nulled by the migration; row 6 was already NULL.
    expect(nullCount).toBe(4);
  });
});
