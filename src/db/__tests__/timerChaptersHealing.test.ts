import { getTimerSettings, updateChapterTimer } from '@/db/settingsQueries';

/**
 * Devices in closed testing can already hold an out-of-range `timer_chapters`:
 * the player's sleep-timer modal used to write the stepper's raw `n ± 1` to the
 * settings row and clamp only its own local state, so a `−` press at zero left
 * `-1` on disk. That value is not inert — `setup/sleepTimer.ts` fires the
 * chapter timer whenever the count is not `> 0`, and its bedtime
 * auto-activation branch arms chapter mode straight from this getter.
 *
 * Both press sites now guard, this module's single write site heals what it is
 * handed, and every read heals rows written before either existed. The ticket's
 * recorded choice is healing rather than a migration (see
 * `.scratch/sleep-timer-stepper/issues/01-clamp-modal-chapter-stepper.md`).
 *
 * Faked at the `@/db` boundary for the reason `seriesBackgroundsSetting.test.ts`
 * gives: a real LokiJS adapter leaves an interval alive and jest never exits.
 */

jest.mock('@dr.pogodin/react-native-fs', () => ({
  ExternalStorageDirectoryPath: '/storage/emulated/0',
}));

let mockSettingsRows: Record<string, unknown>[] = [];

/** What the single settings record was last asked to store. */
const written: Record<string, unknown> = {};

jest.mock('@/db', () => ({
  __esModule: true,
  default: {
    write: async (work: () => Promise<void>) => work(),
    collections: {
      get: () => ({
        query: () => ({ fetch: async () => mockSettingsRows }),
      }),
    },
  },
}));

const rowWith = (timerChapters: number | null) => ({
  timerDuration: null,
  timerActive: true,
  timerChapters,
  sleepTime: null,
  timerFrozenRemaining: null,
  timerFadeoutDuration: null,
  bedtimeModeEnabled: false,
  bedtimeStart: null,
  bedtimeEnd: null,
  customTimer: null,
});

describe('updateChapterTimer heals what it is handed', () => {
  // The guard lives at the write boundary as well as at the two press sites,
  // so a future caller cannot reintroduce the defect by forgetting to clamp.
  const recordingRow = () => ({
    update: async (updater: (r: Record<string, unknown>) => void) =>
      updater(written),
  });

  it('stores a negative count as off, never as a negative', async () => {
    mockSettingsRows = [recordingRow()];

    await updateChapterTimer(-1);

    expect(written.timerChapters).toBeNull();
  });

  it('stores an in-range count unchanged', async () => {
    mockSettingsRows = [recordingRow()];

    await updateChapterTimer(2);

    expect(written.timerChapters).toBe(2);
  });

  it('still stores an explicit off', async () => {
    mockSettingsRows = [recordingRow()];

    await updateChapterTimer(null);

    expect(written.timerChapters).toBeNull();
  });
});

describe('getTimerSettings heals a persisted chapter count', () => {
  // null, not 0: healing to 0 would leave setup/sleepTimer.ts arming bedtime
  // mode (it arms on `!== null`) and firing at the next chapter boundary (it
  // fires when the count is not `> 0`) — the corruption's exact behaviour.
  it('reads a negative count back as off', async () => {
    mockSettingsRows = [rowWith(-1)];

    await expect(getTimerSettings()).resolves.toMatchObject({
      timerChapters: null,
    });
  });

  // null is a real value: the chapter timer is off. Healing it to 0 would arm
  // an "end of chapter" timer on every device that has never used one.
  it('leaves an unarmed chapter timer null', async () => {
    mockSettingsRows = [rowWith(null)];

    await expect(getTimerSettings()).resolves.toMatchObject({
      timerChapters: null,
    });
  });

  it('passes an in-range count through untouched', async () => {
    mockSettingsRows = [rowWith(4)];

    await expect(getTimerSettings()).resolves.toMatchObject({
      timerChapters: 4,
    });
  });
});
