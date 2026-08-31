/**
 * `resolveTimerMode` and `resolveTimerGesture`, directly.
 *
 * The sibling `sleepTimerSelection.test.ts` drives these through the real
 * `setup/sleepTimer.ts` over a fake row, which is what proves the reported
 * reproductions are fixed. This file pins the decisions themselves — the
 * migration rule, and the one flag that separates the two surfaces — because
 * those are the parts a refactor could quietly reverse while every integration
 * sequence still passed.
 */
import {
  resolveTimerGesture,
  resolveTimerMode,
  type TimerSelectionState,
} from '@/helpers/sleepTimerSelection';

const HOUR = 60 * 60 * 1000;

const state = (over: Partial<TimerSelectionState> = {}): TimerSelectionState => ({
  mode: null,
  durationMs: null,
  chapters: null,
  active: false,
  ...over,
});

describe('resolveTimerMode', () => {
  it('reads an explicit mode back verbatim', () => {
    expect(resolveTimerMode('duration', null, 5)).toBe('duration');
    expect(resolveTimerMode('chapter', HOUR, null)).toBe('chapter');
  });

  it("reads a deliberate deselect ('none') as nothing selected", () => {
    // Distinct from `null` on purpose: 'none' is a choice, null is a row that
    // predates the column. Storing null for a deselect would re-light whichever
    // option still held a dialed value.
    expect(resolveTimerMode('none', HOUR, 3)).toBeNull();
  });

  it('derives a pre-v35 row duration-first', () => {
    expect(resolveTimerMode(null, HOUR, null)).toBe('duration');
    expect(resolveTimerMode(null, null, 3)).toBe('chapter');
    expect(resolveTimerMode(null, null, null)).toBeNull();
  });

  it('derives a row carrying the double-highlight bug as duration', () => {
    // Both columns non-null is exactly what a device running the bug holds.
    // Duration is what every inference site already picked, so resolving it
    // this way changes nothing about the timer those devices are running.
    expect(resolveTimerMode(null, HOUR, 2)).toBe('duration');
  });

  it('treats an unrecognised value as a legacy row rather than trusting it', () => {
    expect(resolveTimerMode('', HOUR, null)).toBe('duration');
    expect(resolveTimerMode('nonsense', null, 2)).toBe('chapter');
  });
});

describe('the stepper dials without selecting', () => {
  it('never patches the mode to something new', () => {
    const command = resolveTimerGesture(
      state({ mode: 'duration', durationMs: HOUR }),
      { kind: 'stepChapter', delta: 1, displayedCount: 0, maxChapters: 5 },
      'modal',
    );

    expect(command.patch.chapters).toBe(1);
    expect(command.patch.mode).toBe('duration');
    expect(command.action).toEqual({ kind: 'none' });
  });

  it('is inert at a bound', () => {
    expect(
      resolveTimerGesture(
        state({ mode: 'chapter', chapters: 0 }),
        { kind: 'stepChapter', delta: -1, displayedCount: 0, maxChapters: 5 },
        'modal',
      ),
    ).toEqual({ patch: {}, action: { kind: 'none' } });
  });

  it('re-targets a chapter timer that is already running', () => {
    // Otherwise the row would name one count while the countdown named another.
    expect(
      resolveTimerGesture(
        state({ mode: 'chapter', chapters: 2, active: true }),
        { kind: 'stepChapter', delta: 1, displayedCount: 2, maxChapters: 5 },
        'modal',
      ).action,
    ).toEqual({ kind: 'arm', mode: 'chapter', chaptersRemaining: 3 });
  });

  it('leaves a running DURATION timer alone', () => {
    expect(
      resolveTimerGesture(
        state({ mode: 'duration', durationMs: HOUR, active: true }),
        { kind: 'stepChapter', delta: 1, displayedCount: 0, maxChapters: 5 },
        'modal',
      ).action,
    ).toEqual({ kind: 'none' });
  });
});

describe('the surface flag is the only difference between the two screens', () => {
  const pick = { kind: 'pickDuration', durationMs: HOUR } as const;

  it('the modal arms on selection', () => {
    expect(resolveTimerGesture(state(), pick, 'modal').action).toEqual({
      kind: 'arm',
      mode: 'duration',
      durationMs: HOUR,
    });
  });

  it('settings selects without arming', () => {
    const command = resolveTimerGesture(state(), pick, 'settings');
    expect(command.patch).toEqual({ mode: 'duration', durationMs: HOUR });
    expect(command.action).toEqual({ kind: 'none' });
  });

  it('settings DOES re-target a timer that is already running', () => {
    expect(
      resolveTimerGesture(
        state({ mode: 'chapter', chapters: 2, active: true }),
        pick,
        'settings',
      ).action,
    ).toEqual({ kind: 'arm', mode: 'duration', durationMs: HOUR });
  });

  it('both surfaces agree on everything else', () => {
    for (const surface of ['modal', 'settings'] as const) {
      // Pressing the lit option deselects and cancels, on both.
      expect(
        resolveTimerGesture(
          state({ mode: 'duration', durationMs: HOUR, active: true }),
          pick,
          surface,
        ),
      ).toEqual({ patch: { mode: null }, action: { kind: 'cancel' } });
    }
  });
});

describe('the bell', () => {
  it('cancels whatever is running without touching the selection', () => {
    const command = resolveTimerGesture(
      state({ mode: 'duration', durationMs: HOUR, active: true }),
      { kind: 'bell', ceiling: 5 },
      'modal',
    );
    // An empty patch is the guarantee that disarming leaves the highlight.
    expect(command.patch).toEqual({});
    expect(command.action).toEqual({ kind: 'cancel' });
  });

  it('re-arms the dialed chapter count, bounded by the book', () => {
    expect(
      resolveTimerGesture(
        state({ mode: 'chapter', chapters: 5 }),
        { kind: 'bell', ceiling: 2 },
        'modal',
      ).action,
    ).toEqual({ kind: 'arm', mode: 'chapter', chaptersRemaining: 2 });
  });

  it('arms the dialed count in full when the ceiling is not known', () => {
    expect(
      resolveTimerGesture(
        state({ mode: 'chapter', chapters: 5 }),
        { kind: 'bell', ceiling: null },
        'modal',
      ).action,
    ).toEqual({ kind: 'arm', mode: 'chapter', chaptersRemaining: 5 });
  });

  it('asks for the options sheet when nothing is selected', () => {
    expect(
      resolveTimerGesture(state(), { kind: 'bell', ceiling: 5 }, 'modal')
        .action,
    ).toEqual({ kind: 'openOptions' });
  });
});

describe('picking the chapter row', () => {
  it('arms the count the row is SHOWING, leaving the dialed one intact', () => {
    // A 10-chapter preference in a book with 2 boundaries left.
    const command = resolveTimerGesture(
      state({ chapters: 10 }),
      { kind: 'pickChapter', count: 2 },
      'modal',
    );

    expect(command.action).toEqual({
      kind: 'arm',
      mode: 'chapter',
      chaptersRemaining: 2,
    });
    // The preference is NOT overwritten with the clamped value, so it comes
    // back in full in a longer book.
    expect(command.patch.chapters).toBeUndefined();
    expect(command.patch.mode).toBe('chapter');
  });
});
