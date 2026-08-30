# 03 — `maxChapters` is computed twice, and the two copies disagree

**What to build:** One home for "how many chapter boundaries are left in the
Book", shared by the two surfaces that draw the chapter stepper — the way
`stepChapterCount` is already one home for resolving a press.

**Status:** resolved — see `## Answer`, except the device pass

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

- [x] One unit computes the remaining-chapter count; `timer.tsx` and
      `SleepTimerOptions.tsx` both call it and neither re-derives it.
- [x] The empty-queue / no-active-Book divergence is resolved per the ruling
      above, and the ruling is recorded here under `## Answer`.
- [x] `timer.tsx`'s `isActive` guards and `setHasActiveBook` behaviour are
      unchanged — with one disclosed micro-delta on the throw path, recorded
      under `## Answer` and verified unobservable.
- [x] Tests in the `helpers` lane cover both Queue shapes and the
      no-active-Book case. The unit takes its Player reads through the adapter,
      so `fakePlayer.ts` can drive it.
- [x] `tsc` 0, `eslint` 0 errors, full suite green.
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

## Answer — 2026-08-30

**Built as specified. `src/helpers/remainingChapterCount.ts` is the one home;
both surfaces call it and neither re-derives the eight-step computation.**

### The shape

`remainingChapterCount(): Promise<number | null>` — no arguments, no state, no
opinion about what a surface shows. It reads the Player through the
`src/player/` adapter (`getQueue`, `getActiveBookId`, `getProgress`,
`getActiveTrackIndex`) so `fakePlayer.ts` drives it in the `helpers` lane, and
it takes the library-store and `findChapterIndexByPosition` lookups with it.
Triage's adopted shape (ruling 4) survived contact: `null` means *the ceiling
is not known*.

- **empty queue → `null`.** No Book loaded.
- **a read throws → `null`.** One `try` wraps the whole computation.
- **single-item queue, no usable chapter list → `0`.** Known, and it is zero —
  not unknown. Same for a single item carrying no `bookId`, and for a Book
  missing from the store.
- **multi-file, `getActiveTrackIndex()` undefined → `0`.** Ported verbatim.

The queue-shape verdict (`queue.length === 1`) is a straight port with the
deferral comment attached, per the Out of scope note. This is now the single
site that changes when `.scratch/queue-shape/spec.md` is settled.

### What each surface does with `null`

Neither answer was harmonised, which is what kept the diff honest:

- **Settings (`timer.tsx`)** answers `20` — `setMaxChapters(remaining ?? 20)`
  — exactly what it showed before. Ruling 3's provenance (an arbitrary seed
  from `661eb1f`, never justified) is recorded at the `useState(20)`, so the
  number is documented as a seed rather than preserved by cargo cult.
- **Modal (`SleepTimerOptions.tsx`)** answers `0`, also exactly what it showed
  before, with the reasoning in a comment: the no-Book half of `null` is
  unreachable there (ruling 1 — the player screen cannot be reached with no
  Book loaded), and for the reachable half — a read that threw with a Book
  loaded — `0` is honest because the sheet unmounts on dismiss and recomputes
  on the next open.

So the table in "The copies have already drifted" is preserved rather than
resolved, which is the correct outcome once ruling 1 established the
divergence is latent and not live. The modal did gain one thing it lacked: the
unit's `catch` means a failed read no longer produces an unhandled rejection.

### What was deliberately left alone

- `timer.tsx` still asks `getActiveBookId()` itself for `hasActiveBook`, in the
  same place, inside the same `try`. The unit does not answer that question.
- Both `isActive` guards still wrap every `setState`; the unit returns a value
  precisely so they can stay at the call site.
- The modal's computation is still inside its mount effect, so ruling 2's
  lazy-mount property holds: the ceiling is recomputed on every sheet-open and
  nothing runs at player-screen open.
- `stepChapterCount` / `normalizeChapterCount` untouched.

**One micro-delta, deliberate and unobservable.** Previously, a Player read
throwing *after* `getActiveBookId()` succeeded drove `timer.tsx`'s catch, which
set `hasActiveBook` to `false` even though a Book was loaded. Now the unit
swallows that throw and returns `null`, so `hasActiveBook` keeps the answer
`getActiveBookId()` actually gave — the more truthful one. It is unobservable:
`SleepTimerDurationCard` destructures the prop and never reads it (the dead
prop noted in `01`'s Provenance). `getActiveBookId()` itself throwing still
hits the catch and still sets `false`, unchanged.

### Verification

- `src/helpers/__tests__/remainingChapterCount.test.ts` — 11 cases through
  `fakePlayer.ts`: multi-file mid-queue and last item, `getActiveTrackIndex`
  undefined, legacy single-file mid-chapter and at the start, no usable
  chapters, Book absent from the store, item with no `bookId`, empty queue, a
  first read throwing, and a later read throwing mid-computation.
- `tsc --noEmit` 0 errors. `eslint` 0 errors (4 pre-existing warnings, none in
  the new code). Full suite: 88 suites / 1095 tests green, both lanes.

## Triage rulings

> *This was generated by AI during triage.*

Recorded 2026-08-30, alongside the `wontfix` close of `02`.

**1. The reachability question is answered: the modal's no-Book branch is dead.**
Driver ruling — **the player screen, and therefore this modal, cannot be reached
with no Book loaded.** So the divergence in the table above is **latent, not
live**: only the settings surface can render a chapter stepper with no Book, and
it is the surface holding the `20`. Do not design around a user-visible
disagreement; there isn't one. Do still remove the duplication, and do make the
modal's dead branch dead *by construction* (or comment it as unreachable and say
why) rather than leaving two answers standing.

⚠ This ruling covers **no Book loaded**. It does not cover **the reads
throwing** with a Book loaded, which is a different failure and still
unhandled in the modal (no `catch` at all — an unhandled rejection leaves
`maxChapters` at its initial value for that sheet session). Lazy mount softens
this: the modal unmounts on dismiss, so a transient failure heals on the next
open rather than persisting for the player screen's lifetime.

**2. Mount lifecycle — corrects an assumption `01` and `02` both carried.**
`SleepTimerOptions` is the *child* of a `BottomSheetModal` owned by
`PlayerControls`. `@gorhom/bottom-sheet` 5.2.8 gates children behind
`return mount ? (…) : null`, with `mount` false until `handlePresent`. **The
modal mounts on sheet-open and unmounts on dismiss**, so its ceiling is
recomputed every time the sheet is opened, and nothing runs at player-screen
open. Whatever shape the shared unit takes must keep that property — do not
hoist the computation to a provider or a screen-level effect that would make it
mount-once-per-player-session.

**3. The `20` has no origin to preserve.** `git log -S` puts it in `661eb1f`
("Chore: add sleep time options to settings/timer screen", 2026-02-07) — the
commit that first added the screen. It is an arbitrary seed value from day one,
never justified anywhere. Record that and stop treating it as load-bearing.

**4. Adopted at triage, overturn here if wrong:** the unit returns
`number | null`, where `null` means *"the ceiling is not known"* — no Book, a
read that threw, or simply not resolved yet. Each surface keeps its own answer
to `null`, which resolves the divergence without picking `20` or `0` for both,
and is the third bullet of "What the shared unit must preserve" above. Ticket
`04` depends on this shape: it needs to distinguish "the ceiling is 0" from
"the ceiling has not arrived yet", and today it cannot, because both are `0`.

## Agent Brief

> *This was generated by AI during triage.*

**Category:** enhancement
**Summary:** Give "how many chapter boundaries are left in the Book" one home,
shared by the two surfaces that draw the chapter stepper.

**Current behavior:**
An eight-step computation is duplicated verbatim — down to a shared comment — in
the settings timer screen and the player's sleep-timer modal. Each keeps the
result in its own `maxChapters` state. The two copies have drifted at their
edges: with no Book loaded the settings screen falls back to `20` and the modal
resolves `0`, and the modal has no error handling at all where the settings
screen has a `try/catch`. Both then feed that number to `stepChapterCount` as
the ceiling, and to the stepper's label and its `+` button dimming.

**Desired behavior:**
One unit answers the question. Both surfaces call it and neither re-derives it.
The unit returns the remaining-boundary count, or `null` when it cannot know —
no active Book, or a Player read that failed. It does **not** set state, does
**not** answer "is there an active Book", and does **not** decide what a surface
shows when the answer is `null`; each surface keeps its own fallback so the
existing settings behaviour is preserved rather than harmonised by accident.

**Key interfaces:**
- A new module under `src/helpers/` — not inside `chapterTimerStepper.ts`, which
  is pure and must stay that way. Have the stepper's module docblock point at it
  so the pair is discoverable.
- Signature shape: an async function taking no arguments and returning
  `Promise<number | null>`. Player reads go through the `src/player/` adapter
  (`getActiveBookId`, `getQueue`, `getProgress`, `getActiveTrackIndex`) so
  `fakePlayer.ts` can drive it in the `helpers` lane.
- The library-store and `findChapterIndexByPosition` lookups move into the unit
  with the rest of the computation.
- Call sites keep their own `isActive` guard around the `setState` that consumes
  the returned value. The guard protects `setState`, not the arithmetic, so it
  stays at the call site — this is why the unit returns a value rather than
  accepting a setter.

**Acceptance criteria:**
- [x] One unit computes the remaining-chapter count; both surfaces call it and
      neither contains the queue-shape branch any more.
- [x] The unit returns `null` for no-active-Book and for a failed Player read.
- [x] The settings screen still shows a ceiling of `20` in those cases, and
      still sets `hasActiveBook` as it does today — except on the throw path,
      see the micro-delta under `## Answer`.
- [x] The modal's behaviour on `null` is chosen deliberately and commented,
      including a note that the no-Book case is unreachable there (ruling 1).
- [x] The settings screen's `isActive` guards still wrap every `setState`, and
      no `setState` runs after unmount.
- [x] The modal still computes its ceiling on sheet-open and unmounts on
      dismiss — the lazy-mount property in ruling 2 is preserved.
- [x] `helpers`-lane tests, driven by `fakePlayer.ts`, cover: multi-file queue,
      legacy single-file queue with chapters, single-file with no usable
      chapters, no active Book, and a throwing Player read.
- [x] The `20`'s provenance (ruling 3) is recorded in a comment where it is
      used, as an arbitrary seed rather than a computed default.
- [x] `tsc` 0, `eslint` 0 errors, full suite green.
- [ ] Device pass: set an end-of-chapter timer from **both** surfaces on a
      single-file and a multi-file Book, and confirm the displayed ceiling
      matches on each.

**Out of scope:**
- ⚠ **The queue-shape question.** `queue.length === 1` is one of five competing
  mechanisms, deferred repo-wide to `.scratch/queue-shape/spec.md`; ADR 0003
  refuses to answer it inside the adapter. Port whatever the existing copies do
  and change no verdicts. Making this the single site that must change when
  queue-shape is settled is most of the point of the ticket.
- **Any change to what the stepper displays.** A stale count still renders as a
  confident over-count; that is ticket `04`, which builds on this unit's `null`.
- **Any change to `stepChapterCount` or `normalizeChapterCount`.** Ruled correct
  in `02`.
- **`hasActiveBook` as a dead prop** on the settings card (noted in `01`'s
  Provenance). Adjacent, and removing a prop touches the card and its screen.
- **The modal's missing `catch`** beyond whatever the shared unit's `null`
  return handles for it.
