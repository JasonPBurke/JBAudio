# Sleep timer — the selection has its own field

**Status:** built, tests green, **DEVICE PASS PENDING**
Schema **v35**. Uncommitted on `main` at time of writing.

## The bug, as reported

Select "1 hr" in the player modal (arms, closes). Reopen, press `+` on the
chapter stepper. Close and reopen: **both** the 1 hr button and the chapter row
are highlighted, on the modal *and* on the settings screen. Tapping the chapter
row to clear it darkens both, and reopening lights both again — the only escape
is selecting a duration.

## Cause

"Which option is selected" had no field. It was inferred at four sites from
whether `timer_duration` / `timer_chapters` were non-null, and the
"only one selected" rule was a **side effect of `activate()`** clearing the
other column — not a property of the data. Three writers bypassed `activate()`:

| Writer | What it did |
|---|---|
| the stepper's `+` / `−` | wrote `timer_chapters` directly, lighting a second option |
| `cancel()` | cleared neither column, so a "deselect" press left both lit |
| `onPlaybackStopped` | cleared `timer_chapters` but not `timer_duration` |

A fourth conflation sat under it: `onChapterChanged` **decremented
`timer_chapters` itself**, so arming "End of 3 Chapters" rewrote the user's own
setting to 2, then 1, then 0.

## Confirmed spec

- `timer_mode` (`'duration' | 'chapter' | 'none'`) is the highlight and the only
  thing that decides it. `timer_duration` and `timer_chapters` are **dialed
  values** — global preferences that outlive a book change.
- `timer_chapters_remaining` is what a running chapter timer consumes.
  `timer_chapters` is never decremented, never clamped by a render, never
  cleared by playback.
- **Modal**: picking an unlit option selects *and* arms, then closes. Pressing
  the lit option deselects and cancels; the sheet stays open. The stepper dials
  only — it can never light the row.
- **Settings**: identical, minus arming. It never takes a disarmed timer to
  armed, but it *does* re-target one already running, so the highlight and the
  countdown can never name two different timers.
- **Bell**: arms/disarms only, never writes a selection. Nothing selected →
  opens the sheet. Re-arms from the *dialed* count, bounded by the book.
- **Display capping is unchanged** and was already correct: `chapterStepperView`
  clamps to `remainingChapterCount()` for display and never writes back, so a
  stored 2 shows "End of Book" in a 1-chapter book and returns as
  "End of 2 Chapters" in a 10-chapter one.
- **Lifetime**: `onPlaybackStopped` clears only the remaining count and
  `timer_active`. Only the user clears a user choice.
- **Bedtime** switches on `timer_mode` and honours either mode.
- **Migration**: no SQL backfill. `timer_mode` reads null on pre-v35 rows and
  `resolveTimerMode` resolves duration-first — which is what every inference
  site already did, so devices currently carrying the bug keep the timer they
  already had.

## Two consequences accepted deliberately

1. **`+` mid-countdown extends a running chapter timer.** The row and the
   countdown must agree, so editing the value of a running timer re-targets it.
   Reads as a bug in a report; it is not.
2. **Both value columns non-null is now normal.** A dialed hour and a dialed
   chapter count are two remembered preferences. Only `timer_mode` says which is
   chosen — so any future check of the form `timerChapters !== null` to mean
   "chapter timer selected" is a regression.

## Where it lives

- `src/helpers/sleepTimerSelection.ts` — pure. `resolveTimerMode` (the migration
  rule) and `resolveTimerGesture` (every press, both surfaces, one `surface`
  flag as the only difference).
- `src/setup/applyTimerCommand.ts` — the only place a selection reaches the DB.
- Rewired: `SleepTimerOptions.tsx`, `timer.tsx`, `SleepTimerDurationCard.tsx`,
  `PlayerControls.tsx`, `sleepTimer.ts`, `useObserveSettings.ts`,
  `settingsQueries.ts`.

## Tests

- `helpers/__tests__/sleepTimerSelection.test.ts` — the three reported repros as
  gesture sequences, driving the **real** `setup/sleepTimer.ts` over an
  in-memory row (`support/settingsRow.ts`). Went red on all three before the fix.
- `helpers/__tests__/sleepTimerSelection.unit.test.ts` — the decisions directly:
  migration rule, surface asymmetry, bell, stepper.

91 suites / 1140 tests green (baseline 89/1111). tsc 0, eslint 0 errors.

## Device pass — still owed

1. Repro 1 verbatim: 1 hr → `+` → close → reopen. One highlight, both surfaces.
2. Bell disarm → reopen. Highlight still there, timer off.
3. Dial "End of 3 Chapters", arm, let one boundary pass, reopen. Row still says
   **3**, pill says 2.
4. Short book: dial 3 in a long book, open a 1-chapter book — row reads
   "End of Chapter"; go back — row reads "End of 3 Chapters" again.
5. **Upgrade path**: a device already carrying the double highlight must come up
   with the duration lit and the chapter row dark, still running its old timer.
