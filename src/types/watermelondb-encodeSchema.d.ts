/**
 * WatermelonDB ships this module as JavaScript with no type declarations — it
 * is the SQLite adapter's internal SQL generator, not public API.
 *
 * It is declared here because it is the only way to see what a migration
 * ACTUALLY does to a database without a device: it turns migration steps into
 * the exact SQL the adapter runs. The v33 behaviour test uses it to apply the
 * real migration to a real (in-memory) SQLite database.
 *
 * Being internal, it could move or change in a WatermelonDB upgrade. That is
 * an acceptable risk for a test-only dependency, and a rename would surface as
 * a compile error here rather than as a silently weakened test.
 */
declare module '@nozbe/watermelondb/adapters/sqlite/encodeSchema' {
  import type { AppSchema } from '@nozbe/watermelondb';
  import type { MigrationStep } from '@nozbe/watermelondb/Schema/migrations';

  /** DDL for a whole schema: create table + index statements. */
  export function encodeSchema(schema: AppSchema): string;

  /**
   * SQL for a list of migration steps. Note what it emits for an added
   * column: `alter table` followed by an `update ... set <col> = <nullValue>`,
   * where the value comes from the column's TYPE and optionality — never from
   * a `defaultValue`, which the API does not accept and cannot honour.
   */
  export function encodeMigrationSteps(steps: MigrationStep[]): string;
}
