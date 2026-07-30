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

describe('schema and migrations stay in lockstep', () => {
  it('the schema version matches the newest migration', () => {
    // WatermelonDB validates that migrations have no gaps or duplicates, but
    // it does NOT check them against the schema version. Bumping one without
    // the other strands devices mid-upgrade — which has already happened here
    // once (see the v30 entry's comment about devices stuck on 29).
    expect(migrations.maxVersion).toBe(schema.version);
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
