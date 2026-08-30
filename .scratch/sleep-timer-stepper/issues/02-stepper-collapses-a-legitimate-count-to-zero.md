# 02 — A `−` press collapses a legitimate chapter count straight to zero

**What's wrong:** `stepChapterCount` clamps to `maxChapters` on every press. But
`maxChapters` **shrinks as the Book plays**, so a count the user legitimately set
goes out of range on its own, without anyone touching anything. The next `−`
press does not step it down by one — it snaps it to the ceiling, which by then
is `0`.

**Status:** wontfix — the stepper is correct as it stands; see `## Answer`

**Related:** `03-maxchapters-is-computed-twice-and-the-copies-disagree.md`
— the ceiling this ticket argues about is computed by two copies that
disagree. Settle this ticket first; `03` should extract a settled rule.

**Found:** 2026-08-29, in the Spec-axis review of the player-seam branch
(`.scratch/player-seam/`), checking ticket `01` of this folder against its
acceptance criteria. Not a regression from any earlier build — it arrived with
`01`'s clamp.

## The reproduction

Arithmetic only; no device needed.

1. On a Book with 5 chapters, at chapter 1, set the sleep timer to end after 4
   chapters. `timerChapters = 4`, `maxChapters = 4`. Display: "End of 4
   Chapters".
2. Let it play. On the last chapter, `maxChapters = 0`
   (`src/app/(settings)/timer.tsx:191` — `book.chapters.length - 1 -
   currentChapterIndex`). `timerChapters` is untouched, still `3` or `4`.
3. Press `−` once.

```ts
stepChapterCount(3, -1, 0)
//   ceiling = Math.max(0, 0)        → 0
//   next    = 3 + (-1)              → 2
//   next > ceiling                  → return ceiling
//                                   → 0
```

`src/helpers/chapterTimerStepper.ts:28-32`. The display goes from "End of 4
Chapters" to **"End of Chapter"** in one press. Before ticket `01` the modal
stepped it to 2.

Both surfaces are affected — they share the helper by design
(`SleepTimerOptions.tsx:161-166`, `SleepTimerDurationCard.tsx:69-74`).

## Why this is worth a ticket rather than a shrug

Two rules in the same file now disagree, and the disagreement is documented on
one side only.

`normalizeChapterCount` **deliberately refuses** to clamp the high side, and
says why (`chapterTimerStepper.ts`, its docblock):

> Only the lower bound is enforced. `maxChapters` is a runtime fact about the
> book and the playhead, unknown at the write boundary and to every read site,
> and in the UI it resolves asynchronously from 0 — clamping to it here would
> **flatten a legitimate count to zero** on the first frame. The high side needs
> no healing anyway: an over-count simply never fires, because the book ends
> first.

So the write boundary holds that an over-count is **harmless and must be
preserved**. `stepChapterCount` holds that an over-count is **corruption to be
healed**, because that is what ticket `01` needed it for — the `-1` left by the
old unclamped modal.

Both are right about their own case. The bug is that they cannot tell the two
cases apart: `-1` from a broken press and `3` from a Book that has played on
are both "out of range", and only one of them deserves snapping.

The flattening `normalizeChapterCount` exists to prevent is therefore not
prevented — it is deferred to the user's next press.

## Severity

Low. Nothing is persisted wrongly, nothing fires early, and the user can see the
new value and press `+` back. It is a surprise, not a loss. It is on the surface
ticket `01` was asked to make *correct*, which is why it is filed rather than
dropped.

## Decisions the driver must make

- **Does a `−` press step, or heal?** The candidate fix is that `−` steps down
  by one from `current` when `current > ceiling` (`3 → 2`), and only `+` and
  the out-of-range `+` case clamp. That keeps `01`'s guarantee — no press can
  persist a value the surface refuses to display — while letting a stale count
  walk back into range instead of falling off a cliff.
- **Or: is "end of the book" the honest answer?** At `maxChapters = 0` every
  count above 0 means the same thing, because the Book ends first. Snapping to
  0 could be read as telling the truth rather than losing information. If that
  is the ruling, say so in this file and close it — the behaviour is then
  correct and merely undocumented.
- **Whichever wins, `normalizeChapterCount`'s docblock must stop contradicting
  it.** It currently states the flattening cannot happen.

## Acceptance criteria

- [ ] The chosen rule is recorded here under `## Answer`, with the reasoning.
- [ ] `stepChapterCount` implements it, and `normalizeChapterCount`'s docblock
      agrees with it in writing.
- [ ] A `helpers`-lane test covers the shrinking-ceiling case specifically:
      `current` legitimately above `ceiling`, `delta = -1`. `01`'s existing
      tests cover the `-1`-corruption case and must keep passing unchanged.
- [ ] Both surfaces still resolve every press through the helper — `01`'s
      guarantee is not weakened.
- [ ] `tsc` 0, `eslint` 0 errors, full suite green.

## Notes

- ⚠ **Do not clamp at the write boundary** as part of this. That is the exact
  thing `normalizeChapterCount` documents as wrong, and the reason given (the
  UI resolves `maxChapters` asynchronously from 0) is still true.
- ⚠ **Do not touch the bedtime auto-arm path.** `setup/sleepTimer.ts` arms on
  `timerChapters !== null`; the heal-to-`null`-not-`0` rule is load-bearing and
  argued in `01`.
- No device pass is needed for the arithmetic. One is worth running for the
  display only if the fix changes what the stepper shows at a bound.

## Answer

> *This was generated by AI during triage.*

**Ruling: the stepper is correct. Clamping to the ceiling is the rule, for `−`
as well as `+`. Closed `wontfix` — "already correct, merely undocumented", the
second option this ticket offered.**

### Why the clamp is right rather than merely defensible

**Clamping is nearest-reachable-value, not information loss.** With a stale
count of `5` and `maxChapters = 2`, the user asked for an end six chapters out
and the Book can only offer three. Returning `2` is the closest honest reading
of that intent — "as late as the Book allows". The candidate fix in this
ticket's first bullet (`5 → 4`) answers with a *second* value the Book still
cannot honour, and makes the user press three more times to reach a meaningful
one.

**It keeps `−` and `+` on one rule.** The candidate fix gives `−` different
behaviour from `+` on the same out-of-range value. That is a new asymmetry to
document, to test, and to remember.

**The ceiling a press clamps against is always fresh.** See the mount finding
below. Both surfaces recompute `maxChapters` on mount, and for the modal mount
*is* sheet-open, so the value the press resolves against reflects the playhead
as of the moment the sheet was opened.

### The repro in this ticket does not hold as written

The label on both surfaces is:

```
chaptersToEnd === maxChapters && maxChapters > 0  → 'End of Book'
chaptersToEnd > 0                                  → `End of ${chaptersToEnd + 1} Chapters`
otherwise                                          → 'End of Chapter'
```

(`SleepTimerOptions.tsx:512-516`, `SleepTimerDurationCard.tsx:86-90`.)

Two consequences the ticket missed:

1. **The count renders as `chaptersToEnd + 1`.** Step 1's "5-chapter Book at
   chapter 1, `timerChapters = 4`, `maxChapters = 4`" hits the *first* branch
   (`4 === 4 && 4 > 0`) and displays **"End of Book"**, not "End of 4 Chapters".
   The dramatic before/after in the repro never occurs.
2. **`'End of Book'` is unreachable when `maxChapters === 0`,** because that
   branch is gated on `maxChapters > 0`. So a stored `0` renders "End of
   Chapter" — which, on the last chapter, *is* the end of the Book. The two
   strings name the same event; only one is worded for it.

Rebuilt honestly, the "cliff" exists **only** at `maxChapters === 0`:

- 10-chapter Book, chapter 8, `max = 2`, stale count `5`, press `−` → clamps to
  `2` → label goes "End of 6 Chapters" → **"End of Book"**. No cliff at all.
- Last chapter, `max = 0`, stale count `3`, press `−` → clamps to `0` → "End of
  4 Chapters" → **"End of Chapter"**. Same rule, same truthful answer; it
  simply does not get to use the words "End of Book".

So the ticket's own fallback position is the stronger one on the merits, not the
lazy one.

### The drift is narrower than the ticket implies

`onChapterChanged` opens with `if (!timerActive || timerChapters === null)
return;` (`setup/sleepTimer.ts:571`). **The count decrements in lockstep with the
ceiling whenever the timer is armed.** So `current > ceiling` cannot arise from
ordinary armed playback at all. It needs a count that is *configured but not
armed* — which the stepper itself produces, since every press writes
`updateChapterTimer(next)` without arming. Reachable, no Pro required, but it is
a stale **setting**, not a running timer.

### The docblock's claim, verified and strengthened

`normalizeChapterCount` says an over-count "simply never fires, because the book
ends first". True, and stronger than stated: `onPlaybackStopped`
(`setup/sleepTimer.ts:560`) writes `updateChapterTimer(null)`, so at Book end the
whole chapter-timer setting is **wiped**, not merely left inert.

### Mount finding — corrects a trap recorded in `01`

`SleepTimerOptions` is rendered as the *child* of a `BottomSheetModal` owned by
`PlayerControls` (`PlayerControls.tsx:673-677`). `@gorhom/bottom-sheet` 5.2.8
gates children behind `return mount ? (…) : null`
(`BottomSheetModal.tsx:436`); `mount` starts `false` (`:29`) and is set `true`
only in `handlePresent` (`:195`), with `unmount()` clearing it on dismiss.

**The modal therefore mounts on sheet-open and unmounts on dismiss.** Its `[db]`
effect — the settings subscription, `fetchSettings()`, and `updateMaxChapters()`
— runs fresh on every open, and *nothing* runs at player-screen open.

- `01`'s trap "the ceiling is computed once, on sheet mount… close and reopen the
  sheet after any seek" is correct, but reads as more alarming than it is:
  **"sheet mount" is sheet-open.** The staleness window is one sheet session.
- A hypothesis raised during this triage — that the ceiling goes stale across the
  whole player-screen lifetime, letting `+` climb to a ceiling many chapters past
  the Book's end — is **false**, and was withdrawn on this evidence.

### What survives, and where it went

The display *is* still wrong in one state, and this ruling does not fix it: a
stale count reads as a confident "End of 6 Chapters" when two chapters remain,
until the user presses something. **That wrongness is manufactured before the
press, not by it** — the `−` press is what corrects it. Filed as `04`, together
with the async-resolution window that lazy mount exposes, because both are the
same fix (an honest displayed count needs an explicit "ceiling unknown" state).

### Docblock correction

`normalizeChapterCount`'s last paragraph asserted the flattening cannot happen.
The accurate statement is that it must not happen **at the database boundary**,
where the ceiling is unknown — and that at the **press site**, where the ceiling
is known and fresh, clamping to it is the deliberate rule. Both docblocks in
`src/helpers/chapterTimerStepper.ts` were rewritten to say so. Comment-only; no
behaviour changed.

## Acceptance criteria — resolution

- [x] The chosen rule is recorded here under `## Answer`, with the reasoning.
- [x] `stepChapterCount` implements it (**unchanged**), and
      `normalizeChapterCount`'s docblock agrees with it in writing.
- [ ] ~~A `helpers`-lane test covers the shrinking-ceiling case~~ → **moved to
      `04`**, which locks the clamp as a characterization test alongside the
      display change it must not break. `01`'s 24 tests pass unchanged.
- [x] Both surfaces still resolve every press through the helper — untouched.
- [x] `tsc` 0, `eslint` 0 errors, full suite green.
