/**
 * Which sleep timer the user has CHOSEN, and what each press does to that
 * choice. The pure half; `setup/sleepTimer.ts` owns the running timer.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * "Which option is highlighted" used to have no home. It was inferred at four
 * call sites from whether `timer_duration` and `timer_chapters` happened to be
 * non-null, and the "only one highlighted" rule was a side effect of
 * `activate()` clearing the other column — not a property of the data. Any
 * writer that skipped `activate()` broke it silently, and three did: the
 * chapter stepper wrote `timer_chapters` directly, `cancel()` cleared neither
 * column, and `onPlaybackStopped` cleared one but not the other. That is the
 * whole of the reported double-highlight bug.
 *
 * So selection becomes one field. `timer_mode` is the highlight and the only
 * thing that decides it; `timer_duration` and `timer_chapters` demote to VALUES
 * the user has dialed. Two options can no longer be lit at once because there
 * is only one field to be lit by.
 *
 * The same split runs one layer down. `timer_chapters` is what the user chose
 * and nothing but a press may change it; the count a running timer consumes is
 * `timer_chapters_remaining`. Before this, `onChapterChanged` decremented the
 * user's setting, so arming "End of 3 Chapters" quietly rewrote it to 2, then
 * 1, then 0 — and the row afterwards named a choice the user never made.
 *
 * And it is the same split `chapterStepperView` already makes for display: the
 * stored count bounded by the book's ceiling, never written back. Three layers,
 * one rule — the stored intent and the runtime projection of it are different
 * values, and only the user edits the first.
 */
import { stepChapterCount } from '@/helpers/chapterTimerStepper';

/** Which option is highlighted. `null` is "the user has chosen no timer". */
export type TimerSelection = 'duration' | 'chapter' | null;

/**
 * Reads `settings.timer_mode`. `null` is every row written before the column
 * existed, and something has to decide what those mean — once, here, for the
 * same reason `resolveProvenance` exists: `addColumns` cannot backfill, so a
 * one-forgotten-`??` bug is otherwise inevitable.
 *
 * Duration wins a tie, and the tie is common: devices currently running the
 * double-highlight bug hold BOTH columns non-null. Duration is what those
 * devices already DO — every inference site tested `timerDuration` first — so
 * deriving 'duration' changes no behaviour on them. It only makes the
 * behaviour they already had visible and single-valued.
 */
export function resolveTimerMode(
  storedMode: string | null | undefined,
  timerDuration: number | null,
  timerChapters: number | null,
): TimerSelection {
  if (storedMode === 'duration' || storedMode === 'chapter') return storedMode;
  if (storedMode === 'none') return null;
  // Legacy row: the column did not exist when it was written.
  if (timerDuration !== null) return 'duration';
  if (timerChapters !== null) return 'chapter';
  return null;
}

/**
 * The persisted timer state a gesture is resolved against.
 *
 * `chapters` is the DIALED count, not the remaining one. Passing the remaining
 * count here is the mistake this type exists to make hard: the bell would then
 * re-arm a timer shorter than the one the user configured.
 */
export type TimerSelectionState = {
  mode: TimerSelection;
  /** The dialed duration in ms. Survives deselection; only a new pick changes it. */
  durationMs: number | null;
  /** The dialed chapter count. Only a stepper press changes it. */
  chapters: number | null;
  /** Whether a timer is currently running. */
  active: boolean;
};

export type TimerGesture =
  /** A duration preset or the custom button, in the modal or in settings. */
  | { kind: 'pickDuration'; durationMs: number }
  /** The chapter row itself. `count` is the stepper's displayed (clamped) count. */
  | { kind: 'pickChapter'; count: number }
  /** A `+` or `−` on the chapter stepper. Dials a value; never selects. */
  | { kind: 'stepChapter'; delta: number; displayedCount: number; maxChapters: number }
  /** The bell icon on the player screen. */
  | { kind: 'bell'; ceiling: number | null };

/** What the running timer should do. `arm` covers re-targeting an armed one. */
export type TimerAction =
  | { kind: 'none' }
  | { kind: 'cancel' }
  | { kind: 'arm'; mode: 'duration'; durationMs: number }
  | { kind: 'arm'; mode: 'chapter'; chaptersRemaining: number }
  /** Nothing is selected, so the bell has nothing to arm — show the options. */
  | { kind: 'openOptions' };

export type TimerCommand = {
  /** Fields to persist. An absent key means "leave it alone". */
  patch: Partial<Pick<TimerSelectionState, 'mode' | 'durationMs' | 'chapters'>>;
  action: TimerAction;
};

const NOTHING: TimerCommand = { patch: {}, action: { kind: 'none' } };

/**
 * Resolve one press into a persisted change and a timer action.
 *
 * `surface` is the ONLY difference between the player modal and the settings
 * screen, and it is deliberately one parameter rather than two functions:
 * everything else about them is required to be identical, and two functions is
 * how they drifted apart in the first place.
 *
 * - `'modal'` — picking an option selects AND arms it, because the modal is
 *   reached from the player with the intent to start a timer now.
 * - `'settings'` — picking an option only selects. It never takes a disarmed
 *   timer to armed. It DOES re-target one that is already running, so the
 *   highlight and the countdown can never state two different timers.
 *
 * Deselecting — pressing the option that is already lit — cancels on both
 * surfaces. Nothing selected cannot mean something is running.
 */
export function resolveTimerGesture(
  state: TimerSelectionState,
  gesture: TimerGesture,
  surface: 'modal' | 'settings',
): TimerCommand {
  switch (gesture.kind) {
    case 'pickDuration': {
      const alreadyLit =
        state.mode === 'duration' && state.durationMs === gesture.durationMs;
      if (alreadyLit) return deselect();
      return {
        // The dialed value is stored alongside the mode: a preset press is
        // both "this timer" and "this length".
        patch: { mode: 'duration', durationMs: gesture.durationMs },
        action: armIf(surface === 'modal' || state.active, {
          kind: 'arm',
          mode: 'duration',
          durationMs: gesture.durationMs,
        }),
      };
    }

    case 'pickChapter': {
      if (state.mode === 'chapter') return deselect();
      return {
        // The mode is stored; the dialed count is NOT overwritten with the
        // displayed one. In a book too short for the stored count those differ,
        // and the stored count is the user's — see the ceiling note on `arm`.
        patch: { mode: 'chapter' },
        action: armIf(surface === 'modal' || state.active, {
          kind: 'arm',
          mode: 'chapter',
          // Armed against what the book can actually deliver, which is what the
          // row is showing. The preference above is left intact, so it returns
          // in full in a longer book.
          chaptersRemaining: gesture.count,
        }),
      };
    }

    case 'stepChapter': {
      const next = stepChapterCount(
        gesture.displayedCount,
        gesture.delta,
        gesture.maxChapters,
      );
      if (next === gesture.displayedCount) return NOTHING;
      return {
        // The mode is REWRITTEN TO ITSELF, and that is not redundant. A stored
        // `null` means "row written before v35", which `resolveTimerMode`
        // resolves duration-first off the value columns — so a stepper press
        // that wrote only `timer_chapters` would leave a fresh row looking
        // exactly like a legacy one and light the chapter row anyway, which is
        // the very bug this file exists to kill. Writing the resolved mode back
        // makes the column explicit without changing what it says.
        patch: { mode: state.mode, chapters: next },
        // A running chapter timer follows the value it is named by, so the row
        // and the countdown always agree. Note this lets `+` extend a timer
        // mid-countdown, which is intended.
        action:
          state.active && state.mode === 'chapter'
            ? { kind: 'arm', mode: 'chapter', chaptersRemaining: next }
            : { kind: 'none' },
      };
    }

    case 'bell': {
      // Arming is the bell's whole job. It never writes a selection — which is
      // what makes "disarm from the icon, and the highlight stays" true.
      if (state.active) return { patch: {}, action: { kind: 'cancel' } };
      if (state.mode === 'duration' && state.durationMs !== null) {
        return {
          patch: {},
          action: {
            kind: 'arm',
            mode: 'duration',
            durationMs: state.durationMs,
          },
        };
      }
      if (state.mode === 'chapter') {
        const dialed = state.chapters ?? 0;
        return {
          patch: {},
          action: {
            kind: 'arm',
            mode: 'chapter',
            // From the DIALED count, bounded by this book — never from a
            // remaining count a previous run left behind.
            chaptersRemaining:
              gesture.ceiling === null
                ? dialed
                : Math.min(dialed, Math.max(gesture.ceiling, 0)),
          },
        };
      }
      return { patch: {}, action: { kind: 'openOptions' } };
    }
  }
}

/**
 * Pressing the lit option. Clears the mode and stops any running timer, and
 * leaves both dialed values alone so the next press re-selects the same
 * lengths rather than a default.
 */
function deselect(): TimerCommand {
  return { patch: { mode: null }, action: { kind: 'cancel' } };
}

function armIf(should: boolean, action: TimerAction): TimerAction {
  return should ? action : { kind: 'none' };
}
