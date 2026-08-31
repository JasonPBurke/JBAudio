/**
 * Feedback loop for the sleep-timer / swipe-away bug.
 *
 * Repro shape (from the report):
 *   active duration timer + playing -> pause -> swipe app off recents
 *   -> reopen later -> timer has counted down through the time the app was gone.
 *
 * Control shape (must NOT reproduce):
 *   same, but only backgrounded (process stays alive) -> remaining unchanged.
 *
 * "Process death" is simulated with jest.resetModules() + a re-require: the
 * module's in-memory state is rebuilt from scratch while the fake DB (held on
 * globalThis, so it survives the module registry reset) persists like SQLite.
 */

type FakeDisk = {
  timerDuration: number | null;
  timerActive: boolean;
  /** The DIALED count — the user's choice. Never decremented by playback. */
  timerChapters: number | null;
  /** What a RUNNING chapter timer consumes. Split from the dialed count in v35. */
  chaptersRemaining: number | null;
  timerMode: 'duration' | 'chapter' | null;
  sleepTime: number | null;
  frozenRemainingMs: number | null;
  fadeoutDuration: number | null;
  bedtimeModeEnabled: boolean;
  bedtimeStart: number | null;
  bedtimeEnd: number | null;
  customTimer: number | null;
};

const g = globalThis as unknown as { __fakeDisk: FakeDisk };

g.__fakeDisk = {
  timerDuration: null,
  timerActive: false,
  timerChapters: null,
  chaptersRemaining: null,
  timerMode: null,
  sleepTime: null,
  frozenRemainingMs: null,
  fadeoutDuration: 0,
  bedtimeModeEnabled: false,
  bedtimeStart: null,
  bedtimeEnd: null,
  customTimer: null,
};

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getPlaybackState: jest.fn().mockResolvedValue({ state: 'playing' }),
    getActiveTrack: jest.fn().mockResolvedValue(null),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    setVolume: jest.fn().mockResolvedValue(undefined),
  },
  State: { Playing: 'playing', Paused: 'paused' },
}));

jest.mock('@/db/settingsQueries', () => {
  const disk = (globalThis as any).__fakeDisk as FakeDisk;
  return {
    getTimerSettings: jest.fn(async () => ({ ...disk })),
    updateSleepTime: jest.fn(async (v: number | null) => {
      disk.sleepTime = v;
    }),
    updateFrozenRemaining: jest.fn(async (v: number | null) => {
      disk.frozenRemainingMs = v;
    }),
    updateTimerActive: jest.fn(async (v: boolean) => {
      disk.timerActive = v;
    }),
    updateTimerDuration: jest.fn(async (v: number | null) => {
      disk.timerDuration = v;
    }),
    updateChapterTimer: jest.fn(async (v: number | null) => {
      disk.timerChapters = v;
    }),
    updateChapterRemaining: jest.fn(async (v: number | null) => {
      disk.chaptersRemaining = v;
    }),
    updateTimerMode: jest.fn(async (v: 'duration' | 'chapter' | null) => {
      disk.timerMode = v;
    }),
  };
});

// The timer records footprints through this helper, whose real module pulls
// in bookQueries -> the WatermelonDB node adapter. Stub the seam, not the
// query layer behind it.
jest.mock('@/helpers/activeBookFootprints', () => ({
  recordActiveBookFootprint: jest.fn().mockResolvedValue(undefined),
}));

// ─── Controllable clock ───────────────────────────────────────────────────────
//
// Two things must be controlled: wall-clock reads (Date.now) and the module's
// backup setTimeout. jest's modern fake timers can do both, but faking Date
// alongside jest.resetModules() makes Date.now() silently fall back to real
// wall-clock mid-test. So: fake the timers only (doNotFake: ['Date']) and own
// the clock with an explicit spy, which module resets cannot disturb.

const T0 = 1_700_000_000_000;
let NOW = T0;

/**
 * Advance both clocks. advanceTimersByTimeAsync (not the sync variant) is
 * required: the module's backup timer callback is async, so the sync variant
 * returns with it still suspended at its first await and an assertion made
 * straight after reads "hasn't happened yet" as "doesn't happen".
 */
const advance = async (ms: number) => {
  NOW += ms;
  await jest.advanceTimersByTimeAsync(ms);
};

// ─── Module loading ───────────────────────────────────────────────────────────

type SleepTimerModule = typeof import('../sleepTimer');

const loadModule = (): SleepTimerModule =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../sleepTimer') as SleepTimerModule;

/**
 * Simulate a swipe-away: the JS runtime is destroyed, so module-scope state
 * AND every pending setTimeout die with it. The DB row survives.
 */
const killProcess = (): SleepTimerModule => {
  jest.clearAllTimers();
  jest.resetModules();
  return loadModule();
};

/**
 * What the user actually sees, mirroring CountdownTimer + PlayerControls:
 *   uiSleepTime = store.endTimeMs ?? settings.sleepTime
 *   frozen wins when set; otherwise count down from uiSleepTime.
 */
const displayedRemainingMs = (mod: SleepTimerModule): number => {
  const s = mod.getStatus();
  if (s.frozenRemainingMs != null && s.frozenRemainingMs > 0) {
    return s.frozenRemainingMs;
  }
  const uiSleepTime = s.endTimeMs ?? g.__fakeDisk.sleepTime;
  if (!uiSleepTime) return 0;
  return Math.max(0, uiSleepTime - NOW);
};

const MIN = 60_000;

/**
 * Resolved lazily on every call, never captured in a const: jest.resetModules()
 * hands the module under test a FRESH mock instance, so a reference taken once
 * would be asserting against an object nothing under test ever touches.
 */
const tp = (): Record<string, jest.Mock> =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-track-player').default;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers({ doNotFake: ['Date'] });
  NOW = T0;
  jest.spyOn(Date, 'now').mockImplementation(() => NOW);
  Object.assign(g.__fakeDisk, {
    timerDuration: null,
    timerActive: false,
    timerChapters: null,
    chaptersRemaining: null,
    timerMode: null,
    sleepTime: null,
    fadeoutDuration: 0,
    bedtimeModeEnabled: false,
    bedtimeStart: null,
    bedtimeEnd: null,
    customTimer: null,
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('sleep timer survives a swipe-away while paused', () => {
  it('CONTROL: backgrounded (process alive) keeps the frozen remaining time', async () => {
    const mod = loadModule();

    await mod.activate({ kind: 'duration', durationMs: 30 * MIN });
    await advance(5 * MIN);
    await mod.onPlaybackPaused();

    expect(displayedRemainingMs(mod)).toBe(25 * MIN);

    // App goes to background but is never killed; 10 minutes pass.
    await advance(10 * MIN);

    expect(displayedRemainingMs(mod)).toBe(25 * MIN);
  });

  it('BUG: swiped off recents while paused must not consume the away time', async () => {
    const mod = loadModule();

    await mod.activate({ kind: 'duration', durationMs: 30 * MIN });
    await advance(5 * MIN);
    await mod.onPlaybackPaused();

    expect(displayedRemainingMs(mod)).toBe(25 * MIN);

    // Swipe off recents -> process dies. 10 minutes pass. Reopen.
    const revived = killProcess();
    await advance(10 * MIN);
    await revived.syncFromDB();

    expect(displayedRemainingMs(revived)).toBe(25 * MIN);
  });

  it('BUG: a long absence must not silently consume the whole timer', async () => {
    const mod = loadModule();

    await mod.activate({ kind: 'duration', durationMs: 30 * MIN });
    await advance(5 * MIN);
    await mod.onPlaybackPaused();

    // Away for longer than the remaining 25 minutes.
    const revived = killProcess();
    await advance(90 * MIN);
    await revived.syncFromDB();

    expect(displayedRemainingMs(revived)).toBe(25 * MIN);

    // Pressing play must resume the timer, not treat it as expired and cancel it.
    tp().getPlaybackState.mockResolvedValue({ state: 'playing' });
    await revived.onPlaybackResumed();

    expect(revived.getStatus().isActive).toBe(true);
    expect(displayedRemainingMs(revived)).toBe(25 * MIN);
  });

  it('BUG: a frozen timer must not self-fire when the original end time passes', async () => {
    const mod = loadModule();

    await mod.activate({ kind: 'duration', durationMs: 30 * MIN });
    await advance(5 * MIN);
    await mod.onPlaybackPaused();

    // Process stays alive, paused, well past the original end instant.
    // The backup setTimeout scheduled at activation is still pending.
    await advance(60 * MIN);
    await Promise.resolve();
    await Promise.resolve();

    expect(tp().pause).not.toHaveBeenCalled();
    expect(mod.getStatus().isActive).toBe(true);
    expect(displayedRemainingMs(mod)).toBe(25 * MIN);
  });

  it('a timer armed while already paused survives a swipe-away', async () => {
    tp().getPlaybackState.mockResolvedValue({ state: 'paused' });
    const mod = loadModule();

    // Arming while paused takes the other branch of activate(): it never
    // computes an end instant at all, so before the fix syncFromDB found
    // neither a sleepTime nor a chapter count and showed no timer whatsoever.
    await mod.activate({ kind: 'duration', durationMs: 45 * MIN });
    expect(displayedRemainingMs(mod)).toBe(45 * MIN);

    const revived = killProcess();
    await advance(20 * MIN);
    await revived.syncFromDB();

    expect(revived.getStatus().isActive).toBe(true);
    expect(displayedRemainingMs(revived)).toBe(45 * MIN);
  });

  it('chapter mode is untouched by the frozen-duration handling', async () => {
    const mod = loadModule();

    await mod.activate({ kind: 'chapter', chaptersRemaining: 2 });
    await advance(5 * MIN);
    await mod.onPlaybackPaused();

    const revived = killProcess();
    await advance(30 * MIN);
    await revived.syncFromDB();

    const status = revived.getStatus();
    expect(status.isActive).toBe(true);
    expect(status.mode).toBe('chapter');
    expect(status.remainingChapters).toBe(2);
    expect(g.__fakeDisk.frozenRemainingMs).toBeNull();
  });
});
