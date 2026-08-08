import {
  getSeriesDetectionEnabled,
  getSeriesFolderGroupingEnabled,
} from '@/db/settingsQueries';

/**
 * The two `Series Detection` columns have OPPOSITE defaults, and the pair is
 * tested in one file precisely so that "just copy the one above" produces a
 * red suite rather than a wrong default.
 *
 *  - `Enable Series Detection` is **ON** by default (A9). The house idiom
 *    (`x === true`, falling back to `false`) hard-codes default-OFF into both
 *    the null case and the no-record case; every existing tester's row is null,
 *    because `addColumns` cannot backfill a value. Shipping the idiom here does
 *    not merely mis-render a switch — it turns the feature off for everyone,
 *    silently, and nothing in the scan log would say why the Series shelf
 *    stayed empty.
 *  - `Also group by folder name` is **OFF** by default (A3). It keeps the house
 *    idiom, so the two getters must differ.
 *
 * The null and no-record paths are both real: `ensureSettingsRecord` seeds only
 * `book_folder`, `num_columns` and `timer_active`, so every optional setting is
 * null on a FRESH install as well as after the v33 migration (measured against
 * a real WatermelonDB during ticket 08), and the getters are reachable before
 * the seeder has run.
 *
 * The database is faked at the `@/db` boundary rather than booted: WatermelonDB's
 * LokiJS adapter leaves something alive that stops jest exiting.
 */

type MockSettingsRow = {
  seriesDetectionEnabled: boolean | null;
  seriesFolderGroupingEnabled: boolean | null;
};

/** Rows the faked `settings` collection will return; reassigned per test. */
let mockSettingsRows: MockSettingsRow[] = [];

const row = (
  overrides: Partial<MockSettingsRow> = {},
): MockSettingsRow => ({
  seriesDetectionEnabled: null,
  seriesFolderGroupingEnabled: null,
  ...overrides,
});

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

describe('getSeriesDetectionEnabled — default ON', () => {
  it('is ON when the column is null — the state of every existing tester', async () => {
    mockSettingsRows = [row({ seriesDetectionEnabled: null })];

    await expect(getSeriesDetectionEnabled()).resolves.toBe(true);
  });

  it('is ON when there is no settings record at all', async () => {
    mockSettingsRows = [];

    await expect(getSeriesDetectionEnabled()).resolves.toBe(true);
  });

  // Without this, an unconditional `return true` would satisfy both defaults
  // above while making the setting impossible to turn off.
  it('is OFF only when the user has explicitly turned it off', async () => {
    mockSettingsRows = [row({ seriesDetectionEnabled: false })];

    await expect(getSeriesDetectionEnabled()).resolves.toBe(false);
  });

  it('is ON when the user has explicitly turned it on', async () => {
    mockSettingsRows = [row({ seriesDetectionEnabled: true })];

    await expect(getSeriesDetectionEnabled()).resolves.toBe(true);
  });
});

describe('getSeriesFolderGroupingEnabled — default OFF', () => {
  it('is OFF when the column is null', async () => {
    mockSettingsRows = [row({ seriesFolderGroupingEnabled: null })];

    await expect(getSeriesFolderGroupingEnabled()).resolves.toBe(false);
  });

  it('is OFF when there is no settings record at all', async () => {
    mockSettingsRows = [];

    await expect(getSeriesFolderGroupingEnabled()).resolves.toBe(false);
  });

  it('is ON only when the user has explicitly turned it on', async () => {
    mockSettingsRows = [row({ seriesFolderGroupingEnabled: true })];

    await expect(getSeriesFolderGroupingEnabled()).resolves.toBe(true);
  });
});

describe('the two defaults are not the same default', () => {
  // The failure this catches is one getter copy-pasted over the other: on a
  // null row — every real device the moment v33 lands — detection must be on
  // and folder grouping must be off, from the SAME row.
  it('reads ON for detection and OFF for folder grouping from one null row', async () => {
    mockSettingsRows = [row()];

    await expect(getSeriesDetectionEnabled()).resolves.toBe(true);
    await expect(getSeriesFolderGroupingEnabled()).resolves.toBe(false);
  });
});
