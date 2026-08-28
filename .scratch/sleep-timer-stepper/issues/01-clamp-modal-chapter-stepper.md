# 01 — Clamp the modal's chapter stepper, or stop it writing on every press

**What to build:** The player's sleep-timer modal stops persisting chapter counts
it refuses to display. Two surfaces that show the same stepper start agreeing
about what a press means.

**Status:** resolved

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

- [x] The modal cannot persist a `timerChapters` outside `[0, maxChapters]`
- [x] Pressing `−` at zero and `+` at the ceiling are both no-ops, in the DB and
      on screen
- [x] The behaviour of the two steppers is identical, and that is asserted by a
      test rather than by inspection
- [x] The `sleepTimer.ts` restore question above is answered in an `## Answer`
      section, with the trace, whether or not it turns out to be reachable
- [x] Values already persisted out of range are handled, with the choice recorded
- [x] `tsc` 0, `eslint` 0, test count at or above baseline

## Provenance

Found while writing the device-test guide for
`.scratch/player-seam/issues/06-migrate-components-screens-modals.md`, which
migrated the modal's Player reads. **Not caused by that ticket** — both handlers
and both commented-out `disabled` props predate it and were untouched by it
(`756cbec` changed only the import block and `updateMaxChapters`). Ticket 06 also
left a sibling finding in the same area: `hasActiveBook` is a dead prop on
`SleepTimerDurationCard`, declared and destructured but never referenced. Worth
folding into whichever ticket touches that card next.

## Answer

### The `sleepTimer.ts` restore question: yes, reachable

Two routes — and the worse one never involves arming the chapter timer at all.

**Route A — bedtime auto-activation.** This is the one that matters, because the
user never touches the chapter timer.

1. Chapter timer off: `timer_chapters` is `null`, `timer_active` is `false`.
2. Open the player sheet, press `−` once. `handleChapterMinus` wrote
   `updateChapterTimer(0 - 1)`, so the row holds `-1`. Local state clamped to 0,
   so nothing on screen looked wrong.
3. Bedtime mode on, inside the window, playback resumes. `onPlaybackResumed`
   computes `willActivateBedtime` from
   `bedtimeModeEnabled && !settings.timerActive && inBedtimeWindow`
   (`sleepTimer.ts:521-527`) — `timerActive` is still `false`, so the stray write
   does not gate it — then falls to `else if (settings.timerChapters !== null)`
   (`:552`) and arms **chapter mode with `remainingChapters: -1`**, writing
   `timerActive = true`. There is no clamp anywhere on that branch.
4. At the next chapter boundary `onChapterChanged` (`:585-593`) reads
   `timerChapters === -1`. It decrements only when the count is `> 0`, so it
   takes the `else` and **fires**: pause, volume reset, timer cleared.

Net effect: one stray `−` press turns the next night's bedtime activation into
"stop at the end of the next chapter". In *outcome* that is what a count of 0
does — but the user never asked for a chapter timer, and the value that armed it
is out of range.

**Route B — through the modal itself.** The ticket assumed a remount was needed
to read `-1` back. It is not: the settings observer
(`SleepTimerOptions.tsx:88-95`) echoes the DB straight into state, so `-1` lands
in `chaptersToEnd` in the **same modal session**.

To arm from it, the modal needs `chapterTimerActive` false while `chaptersToEnd`
holds `-1`. The deterministic way there is a **duration** timer: `activate({kind:
'duration'})` writes `updateChapterTimer(null)` (`sleepTimer.ts:274`), so the
observer sets `chapterTimerActive` false while its `if (timerChaptersValue !==
null)` skip leaves `chaptersToEnd` at `-1`. The next chapter-row press then arms
via `activate({ kind: 'chapter', chaptersRemaining: -1 })` (`:212`) — same
fire-at-the-next-boundary outcome, plus `remainingChapters: -1` in the store.

⚠ A first draft of this trace routed through `cancel()` instead. That is
**racy, not deterministic**, and a device repro following it could fail:
`cancel()` (`:316-332`) does leave `timer_chapters` set, but every write it
makes re-emits the observer, which re-asserts `chapterTimerActive = true`
unconditionally (`:97`) — so whether the press-handler's own
`setChapterTimerActive((prev) => !prev)` or the observer lands last decides the
outcome. Corrected after review.

Either way, "the arm path is currently unaffected" held only for as long as the
modal's local state stayed clamped, and the observer un-clamps it.

**High side.** A `+` past the ceiling persists a count larger than the chapters
left; that timer simply never fires, because the book ends first. Bounded and
inert, unlike the negative case.

## What was built

**Shared decision unit.** `src/helpers/chapterTimerStepper.ts` — `stepChapterCount`
resolves one press and returns where it lands (equal to the current count when
the press is a no-op); `normalizeChapterCount` heals a count crossing the
database boundary, in either direction. Both press sites are one line around
`stepChapterCount`, so "the two steppers behave identically" is structural
rather than a convention.

- `SleepTimerOptions.tsx` — one `stepChapters(delta)` that writes nothing
  when the press lands where it started. **Guarded in the handler, not by
  restoring the two `disabled` props** (which are now deleted): the ticket
  preferred it, and it is also how the card guards, so the two match in shape
  and not only in outcome. The buttons still dim via icon opacity.
- `SleepTimerDurationCard.tsx` — its two inline guards replaced by the same
  helper, under the same name. It was already correct at the bounds; see the
  deliberate out-of-range change below.

**Healing: no migration, as recommended — but healed to `null`, not to 0, and at
the write boundary as well as on read.** Both corrections came out of review:

- ⚠ **`-1 → 0` would have been inert.** It is still non-null, so bedtime still
  arms (`!== null`), and 0 still fires at the next chapter boundary (`not > 0`).
  Every affected device would have behaved *identically* after the "heal" — the
  first draft of this Answer conceded the outcome equivalence without noticing
  it made the fix a no-op on the reachable path. A negative is the fingerprint
  of a press that should have been a no-op, and the row held `null` before that
  press, so `null` is the honest heal. It is also the safe direction for a sleep
  timer: the cost of being wrong is a timer the user can see is off and re-arm,
  against playback silently stopping on a night they never set one.
- ⚠ **The write boundary was left unguarded.** The first draft healed five read
  sites and left `updateChapterTimer` — the single write site, and the one every
  caller goes through — writing whatever it was handed, so any future writer
  reintroduced the defect. It now heals what it is handed.

Healed on read at every path a persisted row can reach: `getTimerSettings()`
(`settingsQueries.ts`, covering `setup/sleepTimer.ts`'s restore/bedtime/decrement
paths *and* the settings screen), the modal's two reads, and `useObserveSettings`
(which feeds `PlayerControls`). Both components now derive `chapterTimerActive`
from the healed value too, so a legacy row cannot render an armed chapter timer.

Only the **lower** bound is enforced anywhere: `maxChapters` is a runtime fact
about the book and the playhead, unknown at the write boundary and to every read
site, and in the UI it resolves asynchronously from 0 — clamping to it would
flatten a legitimate count to zero on the first frame. The high side needs no
healing (see above). No migration, per the ticket and
[[watermelondb-addcolumns-defaultvalue-trap]].

**Deliberate behaviour change on the card.** The spec said "make the modal match
the card… the smaller diff", and the shared helper does change one card
behaviour: `−` at an out-of-range 9 with `maxChapters` 5 now yields 5, where it
used to yield 8. That is the healing direction, and the "identical behaviour"
criterion cannot be met by a helper only one surface uses.

## Tests

`src/helpers/__tests__/chapterTimerStepper.test.ts` (18) and
`src/db/__tests__/timerChaptersHealing.test.ts` (6) — 24 in total. Both healing
sites were mutation-checked: reverting the `getTimerSettings` clamp, and
separately the `updateChapterTimer` clamp, each fails a test.

⚠ **Why not a rendered comparison of the two steppers.** Neither component can be
rendered under jest: trap 7 in `docs/testing/jest-projects-and-rn-tests.md` — the
`jest-expo` `transformIgnorePatterns` allowlist does not cover
`@gorhom/bottom-sheet`, `lucide-react-native`, `react-native-timer-picker` or
`pressto`, and widening it starts a cascade this repo has already backed out of
once. The doc's ratified answer is to extract the decision unit and test that,
which is what the shared helper is. Both call sites are a single line, and are
verified by inspection only in that last inch.

**Note on tracker shape:** this effort is a single ticket with no `map.md`, so
`docs/agents/issue-tracker.md`'s "append a context pointer to the map's
Decisions-so-far" step has nowhere to land. Precedented for a one-ticket defect
effort; the `## Answer` here is the record.

## Still open, deliberately not done here

- **The structural question** the ticket flagged: should the modal persist per
  press at all, or route through a callback the way the card does? Not answered
  — the clamp is the contained fix, per the ticket's own recommendation.
- **`chapterTimerActive` derives from `timerChapters !== null` and ignores
  `timer_active`**, in both the modal and the card. Found during the trace above:
  after `cancel()` the row can render as armed because `cancel()` leaves
  `timer_chapters` set. Out of scope for a clamping ticket; worth its own.
- **The in-memory mirror is not healed.** `sleepTimer.activate()` writes
  `mode.chaptersRemaining` to its cache and to the Zustand store directly
  (`:279`) as well as to the DB; only the DB write heals. Unreachable now that
  both press sites guard, and inventing behaviour for an armed chapter timer
  with a null count would be speculative — recorded rather than fixed.
- **`hasActiveBook` is still a dead prop** on `SleepTimerDurationCard` (the
  sibling finding in Provenance). Left alone: this ticket touched the stepper,
  and removing a prop touches the call site and its screen.
