import migrations from '@/db/migrations';
import schema from '@/db/schema';

/**
 * Extracts the raw SQL from a migration that is expected to be a single
 * unsafeExecuteSql step. Throws (failing the test) rather than returning a
 * placeholder, so a shape change surfaces as an explicit error.
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
    throw new Error(`migration ${toVersion} step is '${step.type}', expected 'sql'`);
  }
  return step.sql;
}

/**
 * The newest migration, found by version rather than by position or by a
 * literal. Every assertion below is written against "the newest migration" on
 * purpose: pinning them to a number is what broke this suite once already,
 * when main claimed v31 and the series migration had to be renumbered.
 */
function newestMigration() {
  const migration = migrations.sortedMigrations.find(
    m => m.toVersion === migrations.maxVersion,
  );
  if (!migration) {
    throw new Error(`no migration to version ${migrations.maxVersion}`);
  }
  return migration;
}

describe('schema and migrations stay in lockstep', () => {
  it('the schema version matches the newest migration', () => {
    // WatermelonDB validates that migrations have no gaps or duplicates, but
    // it does NOT check them against the schema version. Bumping one without
    // the other strands devices mid-upgrade — which has already happened here
    // once (see the v30 entry's comment about devices stuck on 29).
    expect(migrations.maxVersion).toBe(schema.version);
  });

  it('every table the newest migration creates is in the schema, identically', () => {
    // A migration and the schema are two independent spellings of the same
    // shape: upgraders get the migration, fresh installs get the schema and
    // never run a migration at all. A divergence is invisible until a fresh
    // install and an upgraded one disagree about a column.
    for (const step of newestMigration().steps) {
      if (step.type !== 'create_table') continue;
      const inSchema = schema.tables[step.schema.name];
      expect(inSchema).toBeDefined();
      expect(inSchema.columns).toEqual(step.schema.columns);
    }
  });

  it('every column the newest migration adds is in the schema, identically', () => {
    for (const step of newestMigration().steps) {
      if (step.type !== 'add_columns') continue;
      const table = schema.tables[step.table];
      expect(table).toBeDefined();
      for (const col of step.columns) {
        expect(table.columns[col.name]).toEqual(col);
      }
    }
  });

  it('adds only optional columns', () => {
    // The migration cannot backfill a value. `addColumns` destructures only
    // { table, columns, unsafeSql } — a `defaultValue` passed to it is
    // silently dropped — so a non-optional column is filled by the library's
    // null-value function instead: '' for a string, 0 for a number, false for
    // a boolean. A non-optional enum would therefore be backfilled with '',
    // which its TypeScript union says cannot exist. Optional is the only
    // honest option, so this holds for anything added from here on.
    for (const step of newestMigration().steps) {
      if (step.type !== 'add_columns') continue;
      for (const col of step.columns) {
        expect({ column: col.name, isOptional: col.isOptional }).toEqual({
          column: col.name,
          isOptional: true,
        });
      }
    }
  });
});

describe('v31 — placeholder artwork cleanup', () => {
  it('nulls books.artwork', () => {
    expect(soleSqlStep(31)).toMatch(
      /UPDATE\s+books\s+SET\s+artwork\s*=\s*NULL/i,
    );
  });

  it('keeps only file:// values, as an allowlist', () => {
    expect(soleSqlStep(31)).toContain("NOT LIKE 'file://%'");
  });

  it('is not phrased as a denylist', () => {
    // A denylist ("not file:// and not http(s)://") looks equivalent but
    // preserves the http://10.0.2.2:8081/... Metro URL a debug build stores,
    // which is a placeholder too. Any mention of http here means someone
    // regressed the predicate.
    expect(soleSqlStep(31).toLowerCase()).not.toContain('http');
  });

  it('terminates its statement', () => {
    // The adapter concatenates every step's SQL into one string, so a missing
    // semicolon corrupts the whole batch rather than just this step.
    expect(soleSqlStep(31).trimEnd().endsWith(';')).toBe(true);
  });
});
