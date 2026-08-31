/**
 * The sleep timer's SELECTION, driven as gesture sequences over the settings
 * row — the user's three reported reproductions, plus the spec they violate.
 *
 * ── Why this file, and what is real in it ────────────────────────────────────
 *
 * "Which option is highlighted" has no home. It is inferred at four call sites
 * from whether `timer_duration` and `timer_chapters` are non-null, and the
 * "only one highlighted" rule is a side effect of `activate()` clearing the
 * other column rather than a property of the data. So the only place the bug is
 * observable is the ROW, across a sequence of presses.
 *
 * Everything below the presses is REAL: `setup/sleepTimer.ts` runs unmodified
 * on top of an in-memory row (`support/settingsRow.ts`), as do
 * `chapterStepperView` and `stepChapterCount`. Only the three modal press
 * handlers are transcribed, with line citations, because they live inside
 * `SleepTimerOptions.tsx` — a component the `helpers` lane cannot render and the
 * `rn` lane cannot load (`@gorhom/bottom-sheet`, `pressto`,
 * `lucide-react-native` are all outside the jest-expo allowlist). That absence
 * of a seam is a finding in its own right: the press logic is untestable where
 * it currently lives.
 */
import {
  chapterStepperView,
  normalizeChapterCount,
} from '@/helpers/chapterTimerStepper';
import {
  resolveTimerGesture,
  resolveTimerMode,
  type TimerCommand,
  type TimerGesture,
  type TimerSelectionState,
} from '@/helpers/sleepTimerSelection';
import { createFakeSettings } from './support/settingsRow';

const HOUR_MS = 60 * 60 * 1000;

let mockSettings: ReturnType<typeof createFakeSettings>;
let mockPlaybackState: 'playing' | 'paused' = 'playing';

jest.mock('@/db/settingsQueries', () => ({
  __esModule: true,
  getTimerSettings: () => mockSettings.queries.getTimerSettings(),
  updateSleepTime: (...a: [number | null]) =>
    mockSettings.queries.updateSleepTime(...a),
  updateTimerActive: (...a: [boolean]) =>
    mockSettings.queries.updateTimerActive(...a),
  updateChapterTimer: (...a: [number | null]) =>
    mockSettings.queries.updateChapterTimer(...a),
  updateTimerDuration: (...a: [number | null]) =>
    mockSettings.queries.updateTimerDuration(...a),
  updateFrozenRemaining: (...a: [number | null]) =>
    mockSettings.queries.updateFrozenRemaining(...a),
  updateTimerMode: (...a: ['duration' | 'chapter' | null]) =>
    mockSettings.queries.updateTimerMode(...a),
  updateChapterRemaining: (...a: [number | null]) =>
    mockSettings.queries.updateChapterRemaining(...a),
}));

jest.mock('@/player/trackPlayer', () => ({
  __esModule: true,
  State: { Playing: 'playing', Paused: 'paused' },
  getPlaybackState: async () => ({ state: mockPlaybackState }),
  pause: jest.fn(async () => {}),
  play: jest.fn(async () => {}),
  setVolume: jest.fn(async () => {}),
}));

// `sleepTimer.ts` registers an AppState listener at module scope (:698), so the
// module cannot be imported in the node lane without this.
jest.mock('react-native', () => ({
  __esModule: true,
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('@/helpers/activeBookFootprints', () => ({
  __esModule: true,
  recordActiveBookFootprint: jest.fn(async () => {}),
}));

type SleepTimer = typeof import('@/setup/sleepTimer');
let sleepTimer: SleepTimer;

beforeEach(() => {
  // `activate()` schedules a backup `setTimeout` out at the timer's full
  // duration (`scheduleBackupTimer`), which holds the node event loop open and
  // hangs the run. Fake timers retire it and pin `Date.now()`, so a sequence
  // that arms a one-hour timer is as deterministic as one that does not.
  // (This is the node lane; the RNTL fake-timer trap does not apply here.)
  jest.useFakeTimers();
  mockSettings = createFakeSettings();
  mockPlaybackState = 'playing';
  // `sleepTimer.ts` holds module-scope mutable state (`cachedTimer`,
  // `frozenRemainingMs`, `lastActivatedMode`). Without a fresh module per test
  // a prior activation leaks into the next sequence and the repros stop being
  // independent.
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sleepTimer = require('@/setup/sleepTimer');
});

// ─── Reading the row the way the two surfaces do ─────────────────────────────

/** The selection, resolved once — the single thing that decides a highlight. */
const selection = () =>
  resolveTimerMode(
    mockSettings.row.timerMode,
    mockSettings.row.timerDuration,
    normalizeChapterCount(mockSettings.row.timerChapters),
  );

/** Is the preset button for `presetMs` highlighted? */
const durationHighlighted = (presetMs: number) =>
  selection() === 'duration' && mockSettings.row.timerDuration === presetMs;

/** Is the chapter row highlighted? */
const chapterHighlighted = () => selection() === 'chapter';

/** How many options the two surfaces would light up right now. */
const highlightCount = (presetMs: number) =>
  (durationHighlighted(presetMs) ? 1 : 0) + (chapterHighlighted() ? 1 : 0);

// ─── Driving a press ─────────────────────────────────────────────────────────

/** The state a gesture is resolved against, read off the row. */
const currentState = (): TimerSelectionState => ({
  mode: selection(),
  durationMs: mockSettings.row.timerDuration,
  chapters: normalizeChapterCount(mockSettings.row.timerChapters),
  active: mockSettings.row.timerActive,
});

/**
 * Persist a command and run its action. This is what each press site does,
 * and the only thing that differs between them is which gesture they build —
 * which is the point of putting the decision in one pure function.
 */
async function apply(command: TimerCommand) {
  if (command.patch.mode !== undefined) {
    await mockSettings.queries.updateTimerMode(command.patch.mode);
  }
  if (command.patch.durationMs !== undefined) {
    await mockSettings.queries.updateTimerDuration(command.patch.durationMs);
  }
  if (command.patch.chapters !== undefined) {
    await mockSettings.queries.updateChapterTimer(command.patch.chapters);
  }

  switch (command.action.kind) {
    case 'cancel':
      await sleepTimer.cancel();
      break;
    case 'arm':
      await sleepTimer.activate(
        command.action.mode === 'duration'
          ? { kind: 'duration', durationMs: command.action.durationMs }
          : {
              kind: 'chapter',
              chaptersRemaining: command.action.chaptersRemaining,
            },
      );
      break;
    case 'none':
    case 'openOptions':
      break;
  }
}

const press = (gesture: TimerGesture, surface: 'modal' | 'settings' = 'modal') =>
  apply(resolveTimerGesture(currentState(), gesture, surface));

const pressPreset = (minutes: number, surface: 'modal' | 'settings' = 'modal') =>
  press({ kind: 'pickDuration', durationMs: minutes * 60 * 1000 }, surface);

/** `+` / `−`. Steps from the DISPLAYED count, which is the stored one clamped. */
function pressStepper(
  delta: number,
  maxChapters: number,
  surface: 'modal' | 'settings' = 'modal',
) {
  const view = chapterStepperView(
    normalizeChapterCount(mockSettings.row.timerChapters) ?? 0,
    maxChapters,
  );
  return press(
    { kind: 'stepChapter', delta, displayedCount: view.count, maxChapters },
    surface,
  );
}

/** Tapping the chapter row itself. Arms the count the row is SHOWING. */
function pressChapterRow(
  maxChapters: number,
  surface: 'modal' | 'settings' = 'modal',
) {
  const view = chapterStepperView(
    normalizeChapterCount(mockSettings.row.timerChapters) ?? 0,
    maxChapters,
  );
  return press({ kind: 'pickChapter', count: view.count }, surface);
}

/** The bell icon on the player screen. */
const pressBell = (ceiling: number | null = 5) =>
  press({ kind: 'bell', ceiling });

// ─── The reported reproductions ──────────────────────────────────────────────

describe('the user-reported reproductions', () => {
  it('repro 1: + on the chapter stepper lights a second option', async () => {
    await pressPreset(60);
    expect(highlightCount(HOUR_MS)).toBe(1);

    await pressStepper(1, 5);

    // The stepper only dialed a number. It must not have selected anything.
    expect(highlightCount(HOUR_MS)).toBe(1);
    expect(durationHighlighted(HOUR_MS)).toBe(true);
  });

  it('repro 1: the settings screen shows the same double highlight', async () => {
    await pressPreset(60);
    await pressStepper(1, 5);

    // Same two inferences, read from the settings surface.
    expect(highlightCount(HOUR_MS)).toBe(1);
  });

  it('repro 2: disarming from the bell keeps exactly one option lit', async () => {
    await pressPreset(60);
    await pressBell(); // disarm
    expect(mockSettings.row.timerActive).toBe(false);

    await pressStepper(1, 5);

    expect(highlightCount(HOUR_MS)).toBe(1);
    expect(durationHighlighted(HOUR_MS)).toBe(true);
  });

  it('repro 3: tapping the chapter row cannot leave the selection stuck', async () => {
    await pressPreset(60);
    await pressStepper(1, 5);

    // The user taps the chapter row to "turn it off". Today this cancels the
    // timer but clears neither column, so both stay lit on the next open and
    // the only escape is re-selecting a duration.
    await pressChapterRow(5);

    expect(highlightCount(HOUR_MS)).toBeLessThanOrEqual(1);
  });
});

// ─── The invariant those repros violate ──────────────────────────────────────

describe('at most one option is ever selected', () => {
  it('holds after every gesture in a sequence', async () => {
    // Asserted after EVERY step on purpose. Checking only the end state used to
    // pass for free whenever the sequence happened to finish on an `activate()`,
    // which was the one call that cleared the other column.
    //
    // Counts HIGHLIGHTS, not non-null value columns. Both values being set at
    // once is now normal and correct — a dialed hour and a dialed chapter count
    // are two remembered preferences — and only `timer_mode` says which is
    // chosen. Counting the columns here is what the old model forced, and it is
    // exactly the conflation the fix removes.
    const selected = () => (selection() === null ? 0 : 1);

    const sequence: [string, () => Promise<void>][] = [
      ['select 1hr', () => pressPreset(60)],
      ['stepper +', () => pressStepper(1, 5)],
      ['stepper +', () => pressStepper(1, 5)],
      ['bell disarm', () => pressBell()],
      ['bell re-arm', () => pressBell()],
      ['select 30min', () => pressPreset(30)],
      ['stepper -', () => pressStepper(-1, 5)],
    ];

    // Collected rather than asserted in the loop so a failure names the gesture
    // that broke the invariant instead of just the count.
    const trace: string[] = [];
    for (const [label, gesture] of sequence) {
      await gesture();
      trace.push(`${label} -> ${selected()} selected`);
    }

    // Every gesture here either picks or dials; none deselects, so one option
    // is lit throughout. `stepper -` at a floor of 0 is a no-op that must also
    // leave the selection alone.
    expect(trace).toEqual(sequence.map(([label]) => `${label} -> 1 selected`));
  });
});

// ─── The confirmed spec ──────────────────────────────────────────────────────

describe('the dialed chapter count is the user’s, and only the user changes it', () => {
  it('survives arming: arming consumes a separate remaining count', async () => {
    await pressStepper(1, 5); // dial "End of 2 Chapters"
    await pressStepper(1, 5); // dial "End of 3 Chapters"
    expect(mockSettings.row.timerChapters).toBe(2);

    await pressChapterRow(5); // arm it

    // Without this the test passes for the wrong reason: a dialed count already
    // reads as active, so the row press cancels instead of arming and nothing
    // ever writes to `timer_chapters`.
    expect(mockSettings.row.timerActive).toBe(true);
    expect(mockSettings.row.timerChapters).toBe(2);
  });

  it('survives a chapter boundary while armed', async () => {
    await pressStepper(1, 5);
    await pressStepper(1, 5);
    await pressChapterRow(5);
    expect(mockSettings.row.timerActive).toBe(true);

    await sleepTimer.onChapterChanged();

    expect(mockSettings.row.timerChapters).toBe(2);
  });

  it('survives playback stopping', async () => {
    await pressStepper(1, 5);
    await pressStepper(1, 5);

    await sleepTimer.onPlaybackStopped();

    expect(mockSettings.row.timerChapters).toBe(2);
    expect(mockSettings.row.timerActive).toBe(false);
  });

  it('is capped for display but restored in a larger book', async () => {
    await pressStepper(1, 10);
    await pressStepper(1, 10); // dialed 2 -> "End of 3 Chapters"

    // A one-chapter book: the ceiling is 0, so the row reads "End of Chapter".
    expect(chapterStepperView(mockSettings.row.timerChapters, 0).label).toBe(
      'End of Chapter',
    );
    // Arming there must honour the book without overwriting the preference.
    await pressChapterRow(0);
    expect(mockSettings.row.timerActive).toBe(true);
    expect(mockSettings.row.timerChapters).toBe(2);

    // Back in a larger book, the original choice is intact.
    expect(chapterStepperView(mockSettings.row.timerChapters, 10).label).toBe(
      'End of 3 Chapters',
    );
  });
});

describe('the bell arms without changing the selection', () => {
  it('disarm then re-arm leaves the same single option lit', async () => {
    await pressPreset(60);

    await pressBell(); // disarm
    expect(highlightCount(HOUR_MS)).toBe(1);
    expect(durationHighlighted(HOUR_MS)).toBe(true);

    await pressBell(); // re-arm
    expect(highlightCount(HOUR_MS)).toBe(1);
    expect(mockSettings.row.timerActive).toBe(true);
  });

  it('re-arms a chapter timer from the dialed count, not the remaining one', async () => {
    await pressStepper(1, 5);
    await pressStepper(1, 5); // dialed 2
    await pressChapterRow(5); // armed

    await sleepTimer.onChapterChanged(); // one boundary consumed
    await pressBell(); // disarm
    await pressBell(); // re-arm

    expect(sleepTimer.getStatus().remainingChapters).toBe(2);
  });
});
