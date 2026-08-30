# 02 — A `−` press collapses a legitimate chapter count straight to zero

**What's wrong:** `stepChapterCount` clamps to `maxChapters` on every press. But
`maxChapters` **shrinks as the Book plays**, so a count the user legitimately set
goes out of range on its own, without anyone touching anything. The next `−`
press does not step it down by one — it snaps it to the ceiling, which by then
is `0`.

**Status:** needs-triage

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
