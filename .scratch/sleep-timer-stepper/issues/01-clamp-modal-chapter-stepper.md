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
  `timer_active`** in the player sheet, so a cancelled or expired timer still
  renders as armed. **Ticket filed:**
  `.scratch/sleep-timer-armed-flag/issues/01-derive-armed-state-from-timer-active.md`
  — it carries the traced census, the device-test table, and two rulings that
  stop the obvious wrong fixes (do not clear the configured values in
  `cancel()`; the settings card is correct as it stands).
- **The in-memory mirror is not healed.** `sleepTimer.activate()` writes
  `mode.chaptersRemaining` to its cache and to the Zustand store directly
  (`:279`) as well as to the DB; only the DB write heals. Unreachable now that
  both press sites guard, and inventing behaviour for an armed chapter timer
  with a null count would be speculative — recorded rather than fixed.
- **`hasActiveBook` is still a dead prop** on `SleepTimerDurationCard` (the
  sibling finding in Provenance). Left alone: this ticket touched the stepper,
  and removing a prop touches the call site and its screen.

## Device test — PENDING

JS-only change: `npx expo start` and reload is enough, **no native rebuild**, and
**no schema change, so no device wipe** (unlike the series work).

**The fix's own defect is invisible at the moment of the press** — pre-fix, the
press clamped local state, so the screen looked right and only the DB was wrong.
Every row below is therefore written around an observable *consequence*, and all
of Part A is visible in the UI with no `adb`. Run each row on the **pre-fix
build first** (`git checkout bf95df8 -- src/`, reload; then restore) — the
"Before" column is the proof the row can detect the bug at all. A row that looks
identical before and after is not testing anything.

**Queue shape:** the ceiling is computed on two different branches
(`updateMaxChapters`, multi-file vs legacy single-file), so run rows A2/A3 on a
multi-file book **and** on a one-item book if you have Pro. Prove the shape,
don't assume it: `adb shell dumpsys media_session | grep -i queue` (8 vs 1).

### Part A — the clamp (no planting needed)

| # | Steps | Before (pre-fix) | After (expected) |
|---|---|---|---|
| A1 | Chapter timer OFF. Player → timer sheet → press `−` on the chapter row. | The row **lights up as armed** (the `-1` echoes back through the observer as `!== null`) while no timer is running. | Nothing happens at all. Row stays unarmed, label stays "End of Chapter". |
| A2 | Press `+` until the label reads **"End of Book"**, then press `+` once more. | Label flips to "End of N Chapters" with a count past the end of the book. | Label stays "End of Book". |
| A3 | Play the **last** chapter of a book, open the sheet (ceiling is 0). Press `+`, then `−`. | `+` writes 1 and the label changes. | Both presses are no-ops; label stays "End of Chapter". |
| A4 | Settings → Sleep Timer → same two bound presses on the card. | Already correct. | Unchanged — this row guards against the shared helper breaking the surface that was right. |
| A5 | Step up to 3, close the sheet, reopen it. | 3 | 3 — the clamp must not have broken ordinary persistence. |

### Part B — healing a value already on disk

A post-fix build **cannot write a negative**, so this must be planted. Cheapest
method, no adb: `git checkout bf95df8 -- src/`, reload Metro, run row A1 once to
write `-1`, then `git checkout HEAD -- src/` and reload. The DB survives both.

| # | Steps | Before | After (expected) |
|---|---|---|---|
| B1 | Plant `-1` as above. Open the timer sheet. | Chapter row renders **armed** holding a negative count. | Row renders **off**; count reads "End of Chapter". |
| B2 | With `-1` planted, open **Settings → Sleep Timer**. | Chapter row highlighted as the configured mode. | Not highlighted. |
| B3 | ⚠ **Pro required.** Plant `-1`, then: Settings → Sleep Timer → configure "End of Chapter" (this sets `timer_chapters` — do it *before* planting, since bedtime cannot be enabled without a timer configured), enable **Bedtime Mode**, set the window to bracket now (start ≈ now − 5 min, end ≈ now + 2 h). Confirm no duration timer is set. Re-plant `-1`. Force-stop, relaunch, start playback, let a chapter boundary pass. | **Playback stops at the end of the next chapter** — a chapter timer the user never armed. This is the whole reason the ticket exists. | Playback continues. Bedtime does not arm chapter mode. |
| B4 | If B3 cannot be run (no Pro), verify from the DB instead — debug build: `adb shell run-as com.fuzzylogic42.JBAudio find . -name '*.db'`, pull it, and confirm `settings.timer_chapters` reads **NULL**, not `-1` and not `0`, after the sheet has been opened once. | `-1` | `NULL` |

### Part C — regression

| # | Steps | Expected |
|---|---|---|
| C1 | Arm "End of Chapter" from the sheet, play to a chapter boundary. | Playback pauses at the boundary, as before. |
| C2 | Arm "End of 3 Chapters", cross one boundary, reopen the sheet. | Count has decremented to 2. |
| C3 | Arm from **Settings → Sleep Timer** instead, play to the boundary. | Same as C1 — the shared helper did not change arming. |

### Traps

- ⚠ **The ceiling is computed once, on sheet mount** (`updateMaxChapters` runs in
  the `[db]` effect). Skip chapters with the sheet open and it goes stale, so a
  `+` that looks wrongly clamped may just be a stale ceiling. **Close and reopen
  the sheet after any seek or skip** before judging rows A2/A3.
- ⚠ Row A1's "before" symptom needs the chapter timer **off** at the start
  (`timer_chapters` NULL). If a count is already configured, `−` is a legitimate
  decrement and proves nothing.
- ⚠ Do not read the countdown pill as the state of the sheet: they derive
  differently, which is its own filed defect
  (`.scratch/sleep-timer-armed-flag/issues/01-derive-armed-state-from-timer-active.md`).
  Judge these rows by the chapter row inside the sheet.
