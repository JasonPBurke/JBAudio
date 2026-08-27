# 01 — Clamp the modal's chapter stepper, or stop it writing on every press

**What to build:** The player's sleep-timer modal stops persisting chapter counts
it refuses to display. Two surfaces that show the same stepper start agreeing
about what a press means.

**Status:** ready-for-agent

## The problem

There are two chapter steppers. One clamps, one doesn't.

`src/components/settings/SleepTimerDurationCard.tsx` (Settings → Sleep Timer)
guards at the press and has a single source of truth:

```tsx
onPress={() => {
  if (chaptersToEnd < maxChapters) {
    onChapterChange(chaptersToEnd + 1);
  }
}}
```

`src/modals/SleepTimerOptions.tsx` (the bottom sheet inside the player) writes
the DB **unclamped** and clamps only the local state, so the two diverge on any
press at a bound:

```ts
const handleChapterPlus = async () => {
  updateChapterTimer(chaptersToEnd + 1);                        // -> DB, unclamped
  setChaptersToEnd((prev) => Math.min(prev + 1, maxChapters));  // -> state, clamped
};

const handleChapterMinus = () => {
  updateChapterTimer(chaptersToEnd - 1);                        // -> DB, unclamped
  setChaptersToEnd((prev) => Math.max(prev - 1, 0));            // -> state, clamped
};
```

Nothing stops the press reaching those handlers: **both `disabled` props are
commented out** — `SleepTimerOptions.tsx:468` (`// disabled={chaptersToEnd === 0}`)
and `:511` (`// disabled={chaptersToEnd >= maxChapters}`). The buttons only *dim*
via icon opacity; they still fire.

`updateChapterTimer` (`db/settingsQueries.ts:95`) writes straight to the settings
record with no clamp of its own.

## What is verified, and what still needs tracing

**Verified by reading:**

- Press `−` at zero and the settings row holds `timerChapters === -1`.
- On the modal's next mount that value is read straight back:
  `setChaptersToEnd(settings[0].timerChapters || 0)` (`SleepTimerOptions.tsx:72`).
  `-1` is truthy, so `chaptersToEnd` becomes `-1`, the label falls through to
  "End of Chapter", **and `chapterTimerActive` (`timerChapters !== null`) reads
  `true`** — the row renders as an armed chapter timer holding a negative count.
- Press `+` past the ceiling and the stored count exceeds the chapters actually
  left in the book.
- The **arm path is currently unaffected**: `handleChapterTimerPress` arms from
  the clamped state (`sleepTimer.activate({ kind: 'chapter', chaptersRemaining:
  chaptersToEnd })`, `:212`), not from the DB. The corruption is in the
  persisted setting, not in the armed timer.

**Needs tracing before the fix is finished** — do not assume either way:

- `setup/sleepTimer.ts` reads `settings.timerChapters` on its restore paths
  (`:545`, `:665`, `:693`), and its decrement path (`:578-586`) fires the timer
  when `timerChapters` is **not** `> 0`. A persisted `-1` therefore looks like
  "fire at the next chapter end" to that code rather than "off". Whether a real
  sequence of presses can reach an armed timer holding a negative count is the
  question this ticket must answer, not guess.

## The change

Make the modal match the card — that is the ratified pattern, it is already in
this repo, and it is the smaller diff. Either restore the two `disabled` props or
guard inside the handlers; guarding in the handler is preferred, because the
dimmed-but-live button is what made this invisible for so long.

⚠ **One judgement call, and it wants a driver ruling if the answer isn't
obvious in code:** should the stepper write to the DB on *every press* at all?
The card routes presses through an `onChapterChange` callback and the screen
owns persistence; the modal persists inline, per press. Making the modal match
the card structurally would answer this and the clamping bug at once.
**Recommendation: clamp first as a contained fix, and note the structural
question rather than doing both in one ticket.**

## Healing values already written

Devices in closed testing may already hold an out-of-range `timerChapters`. Decide
explicitly and record the reason:

- clamp on read (cheap, no migration, hides the bad value rather than fixing it), or
- a schema migration that clamps the column once (honest, but a migration for one
  settings row — see [[watermelondb-addcolumns-defaultvalue-trap]] before writing
  one; `addColumns` ignores `defaultValue`).

**Recommendation: clamp on read.** The bad value is bounded and harmless once the
write is fixed, and this repo has been bitten by migrations that backfill wrong.

## Acceptance criteria

- [ ] The modal cannot persist a `timerChapters` outside `[0, maxChapters]`
- [ ] Pressing `−` at zero and `+` at the ceiling are both no-ops, in the DB and
      on screen
- [ ] The behaviour of the two steppers is identical, and that is asserted by a
      test rather than by inspection
- [ ] The `sleepTimer.ts` restore question above is answered in an `## Answer`
      section, with the trace, whether or not it turns out to be reachable
- [ ] Values already persisted out of range are handled, with the choice recorded
- [ ] `tsc` 0, `eslint` 0, test count at or above baseline

## Provenance

Found while writing the device-test guide for
`.scratch/player-seam/issues/06-migrate-components-screens-modals.md`, which
migrated the modal's Player reads. **Not caused by that ticket** — both handlers
and both commented-out `disabled` props predate it and were untouched by it
(`756cbec` changed only the import block and `updateMaxChapters`). Ticket 06 also
left a sibling finding in the same area: `hasActiveBook` is a dead prop on
`SleepTimerDurationCard`, declared and destructured but never referenced. Worth
folding into whichever ticket touches that card next.
