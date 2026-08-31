/**
 * An in-memory stand-in for the singleton `settings` row, plus the slice of
 * `@/db/settingsQueries` that `setup/sleepTimer.ts` writes through.
 *
 * Why this exists: the sleep timer's "which option is selected" state is not
 * held anywhere addressable. It is inferred, at four separate call sites, from
 * whether `timer_duration` and `timer_chapters` happen to be non-null — and the
 * "only one at a time" rule is a side effect of `activate()` clearing the other
 * column, not a property of the data. To test that rule you have to watch the
 * ROW across a sequence of gestures, which means standing the row up.
 *
 * The real module cannot load in the `helpers` lane: it pulls in WatermelonDB's
 * SQLite adapter and `@dr.pogodin/react-native-fs`. Mocking at this boundary is
 * the established pattern here (see `remainingChapterCount.test.ts`, and the
 * activeBookFootprints note about mocking the helper rather than the query
 * module) and it keeps everything above the boundary — all of `sleepTimer.ts` —
 * running as real code.
 *
 * `normalizeChapterCount` is applied here exactly as `updateChapterTimer` does
 * it, because the heal is part of the write contract and a fake that skipped it
 * would let a negative count through that production never sees.
 */
import { normalizeChapterCount } from '@/helpers/chapterTimerStepper';
import { resolveTimerMode } from '@/helpers/sleepTimerSelection';

export type SettingsRow = {
  timerDuration: number | null;
  timerChapters: number | null;
  timerActive: boolean;
  sleepTime: number | null;
  timerFrozenRemaining: number | null;
  /** Raw column. `null` is a pre-v35 row, which is why it is not TimerSelection. */
  timerMode: string | null;
  timerChaptersRemaining: number | null;
  timerFadeoutDuration: number | null;
  bedtimeModeEnabled: boolean;
  bedtimeStart: string | null;
  bedtimeEnd: string | null;
  customTimer: number | null;
};

/** A fresh install: nothing configured, nothing armed. */
export function emptyRow(): SettingsRow {
  return {
    timerDuration: null,
    timerChapters: null,
    timerActive: false,
    sleepTime: null,
    timerFrozenRemaining: null,
    timerMode: null,
    timerChaptersRemaining: null,
    timerFadeoutDuration: null,
    bedtimeModeEnabled: false,
    bedtimeStart: null,
    bedtimeEnd: null,
    customTimer: null,
  };
}

export type FakeSettings = {
  row: SettingsRow;
  /** The `@/db/settingsQueries` surface `sleepTimer.ts` consumes. */
  queries: {
    getTimerSettings: () => Promise<ReturnType<typeof readTimerSettings>>;
    updateSleepTime: (v: number | null) => Promise<void>;
    updateTimerActive: (v: boolean) => Promise<void>;
    updateChapterTimer: (v: number | null) => Promise<void>;
    updateTimerDuration: (v: number | null) => Promise<void>;
    updateFrozenRemaining: (v: number | null) => Promise<void>;
    updateTimerMode: (v: 'duration' | 'chapter' | null) => Promise<void>;
    updateChapterRemaining: (v: number | null) => Promise<void>;
  };
  reset: (next?: Partial<SettingsRow>) => void;
};

/** Mirrors `getTimerSettings`, including its heal-on-read of the chapter count. */
function readTimerSettings(row: SettingsRow) {
  return {
    timerDuration: row.timerDuration,
    timerActive: row.timerActive,
    timerChapters: normalizeChapterCount(row.timerChapters),
    timerMode: resolveTimerMode(
      row.timerMode,
      row.timerDuration,
      normalizeChapterCount(row.timerChapters),
    ),
    chaptersRemaining: normalizeChapterCount(row.timerChaptersRemaining),
    sleepTime: row.sleepTime,
    frozenRemainingMs: row.timerFrozenRemaining,
    fadeoutDuration: row.timerFadeoutDuration,
    bedtimeModeEnabled: row.bedtimeModeEnabled === true,
    bedtimeStart: row.bedtimeStart,
    bedtimeEnd: row.bedtimeEnd,
    customTimer: row.customTimer,
  };
}

export function createFakeSettings(): FakeSettings {
  const state = { row: emptyRow() };

  const fake: FakeSettings = {
    get row() {
      return state.row;
    },
    queries: {
      getTimerSettings: async () => readTimerSettings(state.row),
      updateSleepTime: async (v) => {
        state.row.sleepTime = v;
      },
      updateTimerActive: async (v) => {
        state.row.timerActive = v;
      },
      updateChapterTimer: async (v) => {
        state.row.timerChapters = normalizeChapterCount(v);
      },
      updateTimerDuration: async (v) => {
        state.row.timerDuration = v;
      },
      updateFrozenRemaining: async (v) => {
        state.row.timerFrozenRemaining = v;
      },
      // Mirrors `updateTimerMode`: a deliberate deselect stores 'none', never
      // null, so it cannot be mistaken for a pre-v35 row on the next read.
      updateTimerMode: async (v) => {
        state.row.timerMode = v ?? 'none';
      },
      updateChapterRemaining: async (v) => {
        state.row.timerChaptersRemaining = normalizeChapterCount(v);
      },
    },
    reset: (next) => {
      state.row = { ...emptyRow(), ...next };
    },
  };

  return fake;
}
