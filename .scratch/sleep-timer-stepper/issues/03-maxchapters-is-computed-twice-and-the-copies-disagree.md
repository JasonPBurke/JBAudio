# 03 — `maxChapters` is computed twice, and the two copies disagree

**What to build:** One home for "how many chapter boundaries are left in the
Book", shared by the two surfaces that draw the chapter stepper — the way
`stepChapterCount` is already one home for resolving a press.

**Status:** needs-triage

**Related:** `02-stepper-collapses-a-legitimate-count-to-zero.md` — same helper,
same two surfaces, but a **behaviour** ruling rather than an extraction. Kept
separate on purpose: this ticket claims *no behaviour change* except the one
named below, and folding a ruling into it would remove the ability to verify
that claim. Sequence `02` first if both are taken, so this one extracts a
settled rule rather than a contested one.

**Found:** 2026-08-29, in the whole-branch Standards review of the player seam
(finding 3), and sharpened while filing `02`.

## The duplication

The same eight-step computation runs in two places:

- `src/app/(settings)/timer.tsx:165-219`
- `src/modals/SleepTimerOptions.tsx:118-149`

`getActiveBookId()` → `getQueue()` → `queue.length === 1` → library-store lookup
→ `getProgress()` → `findChapterIndexByPosition()` → `chapters.length - 1 -
index`, else `getActiveTrackIndex()` → `queue.length - 1 - index`. Down to a
verbatim shared comment in both copies:

> Clipped single-file books have one queue item per chapter, so they take the
> multi-file (else) path; this branch is legacy-only.

The player-seam branch **edited both copies** and extracted the smaller
neighbouring duplication (`stepChapterCount` / `normalizeChapterCount`) while
leaving this one standing.

## The copies have already drifted

This is what makes the ticket more than tidying. With **no Book loaded — an
empty queue, or the `getActiveBookId()` call throwing** — the two surfaces
resolve different ceilings:

| | Settings (`timer.tsx`) | Player modal (`SleepTimerOptions`) |
| --- | --- | --- |
| empty queue | `setMaxChapters(20)` (`:211`) | falls to the else branch → `getActiveTrackIndex()` is `undefined` → `0` |
| read throws | `setMaxChapters(20)` (`:216`) | no `catch` at all |

So the settings card offers a ceiling of 20 where the modal offers 0. Ticket
`01` unified how a press is **resolved**; the value it is resolved **against**
still disagrees. That is the same defect `01` closed, one layer down.

⚠ **Reachability is unproven.** `SleepTimerOptions` is the player's modal and
may not be reachable with no Book loaded, in which case the divergence is
latent rather than live. Establishing that is part of this ticket, not an
assumption to build on. `timer.tsx` additionally tracks `hasActiveBook`, which
the modal does not — that asymmetry is probably why only one copy grew a
fallback.

## What the shared unit must preserve

Both copies must keep working exactly as they do today, minus the divergence:

- **The `isActive` guards in `timer.tsx` are load-bearing** — the computation is
  async and the screen can unmount mid-flight. They guard `setState`, not the
  arithmetic, so they belong at the call site, not inside the shared unit.
  Returning a value the caller sets is the shape that keeps this honest.
- **`setHasActiveBook`** is `timer.tsx`-only and answers a different question.
  Do not fold it in.
- **The `20` fallback is a UI affordance, not a fact about a Book.** If the
  shared unit returns "unknown" rather than a number, each surface can keep its
  own answer — which may be the right resolution of the divergence rather than
  picking 20 or 0 for both.

## Decisions the driver must make

- **Which ceiling is right with no Book loaded**, or whether the unit should
  return `null`/"unknown" and let each surface answer for itself.
- **Where the unit lives.** `chapterTimerStepper.ts` already owns the stepper's
  decisions and documents the `[0, maxChapters]` range, which argues for beside
  it; against, that file is currently pure and this unit does four Player reads.
  A separate `helpers/` module that the stepper file references may be cleaner.

## Acceptance criteria

- [ ] One unit computes the remaining-chapter count; `timer.tsx` and
      `SleepTimerOptions.tsx` both call it and neither re-derives it.
- [ ] The empty-queue / no-active-Book divergence is resolved per the ruling
      above, and the ruling is recorded here under `## Answer`.
- [ ] `timer.tsx`'s `isActive` guards and `setHasActiveBook` behaviour are
      unchanged.
- [ ] Tests in the `helpers` lane cover both Queue shapes and the
      no-active-Book case. The unit takes its Player reads through the adapter,
      so `fakePlayer.ts` can drive it.
- [ ] `tsc` 0, `eslint` 0 errors, full suite green.
- [ ] Device pass: set an end-of-chapter timer from **both** surfaces on a
      single-file and a multi-file Book, and confirm the displayed ceiling
      matches on each.

## Notes

- ⚠ **Do not resolve the queue-shape question here.** `queue.length === 1` is
  one of five competing mechanisms and is deferred repo-wide to
  `.scratch/queue-shape/spec.md` (`needs-triage`); ADR 0003 refuses to answer it
  inside the adapter. Adopt whatever the existing copies do and change no
  verdicts — if queue-shape is later settled, this unit becomes the single site
  that has to change, which is most of the reason to build it.
- The `20` is otherwise unexplained in both the initial `useState(20)`
  (`timer.tsx:80`) and the fallbacks. Its origin should be recorded, not
  preserved by cargo cult.
