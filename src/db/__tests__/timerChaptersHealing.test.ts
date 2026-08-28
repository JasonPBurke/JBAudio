import { getTimerSettings } from '@/db/settingsQueries';

/**
 * Devices in closed testing can already hold an out-of-range `timer_chapters`:
 * the player's sleep-timer modal used to write the stepper's raw `n ± 1` to the
 * settings row and clamp only its own local state, so a `−` press at zero left
 * `-1` on disk. That value is not inert — `setup/sleepTimer.ts` fires the
 * chapter timer whenever the count is not `> 0`, and its bedtime
 * auto-activation branch arms chapter mode straight from this getter.
 *
 * The write is fixed at both press sites; this is the healing half, and the
 * ticket's recorded choice is clamp-on-read rather than a migration (see
 * `.scratch/sleep-timer-stepper/issues/01-clamp-modal-chapter-stepper.md`).
 *
 * Faked at the `@/db` boundary for the reason `seriesBackgroundsSetting.test.ts`
 * gives: a real LokiJS adapter leaves an interval alive and jest never exits.
 */

jest.mock('@dr.pogodin/react-native-fs', () => ({
  ExternalStorageDirectoryPath: '/storage/emulated/0',
}));

let mockSettingsRows: Record<string, unknown>[] = [];

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

describe('getTimerSettings heals a persisted chapter count', () => {
  it('reads a negative count back as zero', async () => {
    mockSettingsRows = [rowWith(-1)];

    await expect(getTimerSettings()).resolves.toMatchObject({
      timerChapters: 0,
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
