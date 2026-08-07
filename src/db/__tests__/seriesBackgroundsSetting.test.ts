import { getSeriesBackgroundsEnabled } from '@/db/settingsQueries';

/**
 * `Series Backgrounds` is the settings table's FIRST default-ON boolean, and
 * the house getter idiom (`x === true`, falling back to `false`) hard-codes
 * default-OFF into both the null case and the no-record case. Shipping that
 * idiom here would turn the setting OFF for every existing tester, silently —
 * which is why the spec calls this "the highest-value single test in this
 * effort" (K1).
 *
 * The two paths that must both answer ON are not hypothetical:
 *
 *  - **null** — `ensureSettingsRecord` seeds only `book_folder`, `num_columns`
 *    and `timer_active`, so every optional setting is null on a FRESH install,
 *    not just after the v33 migration. Verified against a real WatermelonDB
 *    (LokiJS adapter, schema v33): a record created the way the seeder creates
 *    it reads `seriesBackgroundsEnabled === null`.
 *  - **no record** — the getter is reachable before `ensureSettingsRecord` has
 *    run, and every other getter in this module has a zero-row branch.
 *
 * The database is faked at the `@/db` boundary rather than booted for real:
 * WatermelonDB's LokiJS adapter leaves an interval alive that prevents jest
 * from exiting, which would hang the whole suite.
 */

/** Rows the faked `settings` collection will return; reassigned per test. */
let mockSettingsRows: { seriesBackgroundsEnabled: boolean | null }[] = [];

// `settingsQueries` imports RNFS at module scope for the folder-removal path.
// It ships untransformed ESM, so jest cannot parse it; nothing under test here
// touches the filesystem.
jest.mock('@dr.pogodin/react-native-fs', () => ({
  ExternalStorageDirectoryPath: '/storage/emulated/0',
}));

jest.mock('@/db', () => ({
  __esModule: true,
  default: {
    collections: {
      get: () => ({
        query: () => ({ fetch: async () => mockSettingsRows }),
      }),
    },
  },
}));

describe('getSeriesBackgroundsEnabled', () => {
  it('is ON when the column is null — the state of every fresh install', async () => {
    mockSettingsRows = [{ seriesBackgroundsEnabled: null }];

    await expect(getSeriesBackgroundsEnabled()).resolves.toBe(true);
  });

  it('is ON when there is no settings record at all', async () => {
    mockSettingsRows = [];

    await expect(getSeriesBackgroundsEnabled()).resolves.toBe(true);
  });

  // Without this, an unconditional `return true` would satisfy both defaults
  // above while making the switch impossible to turn off.
  it('is OFF only when the user has explicitly turned it off', async () => {
    mockSettingsRows = [{ seriesBackgroundsEnabled: false }];

    await expect(getSeriesBackgroundsEnabled()).resolves.toBe(false);
  });

  it('is ON when the user has explicitly turned it on', async () => {
    mockSettingsRows = [{ seriesBackgroundsEnabled: true }];

    await expect(getSeriesBackgroundsEnabled()).resolves.toBe(true);
  });
});
