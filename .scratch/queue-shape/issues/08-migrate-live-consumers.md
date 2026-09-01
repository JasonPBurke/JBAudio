# 08 — Migrate the live consumers

**Spec:** `.scratch/queue-shape/spec.md` — `## Solution`, decision 3.

**What to build:** The surfaces that ask the Player where it is — the player screen, the
playback service's progress handling, the skip-previous and skip-next presses, and the
sleep timer's chapter ceiling — stop branching on Queue shape. Each reads the Player once,
hands the numbers to the translator, and uses the coordinate it wants.

This is where the read cluster the brief identified finally collapses: seven places that
each assembled the same Player reads and reconstructed "where am I, in Book terms?" from
scratch.

⚠ **The player's progress bar must keep its current split.** It computes a chapter offset
**once per chapter change** and lets the animation worklet do the cheap subtraction on every
frame. The translator returns a fresh object per call, so calling it per frame would put
allocation pressure on the UI thread. Preserve the split; do not move the translator call
into the worklet.

⚠ The skip-next decision is already the pattern to copy — it takes the shape verdict as a
**parameter** and refuses to derive it, with a header explaining why. It sits one function
below a skip-previous that does the opposite. Both are in the file the skip-next parity
ticket held up as the already-extracted target shape.

**Blocked by:** 07

**Status:** resolved

- [x] The player screen, playback service, both skip presses and the sleep-timer ceiling all
      use the translator
- [x] None of them branches on Queue shape any more
- [x] The progress bar still computes its chapter offset once per chapter change, not per
      frame, and no translator call happens inside a worklet
- [x] Each migrated site reads the Player once and passes numbers down, rather than reading
      inside a helper
- [x] Behaviour is unchanged except where a coordinate is now null and was previously a
      fabricated zero; every such site is listed on this ticket with what it now does
- [x] `tsc` 0, eslint 0, full suite green

## Answer

Six live surfaces now read the Player once and hand the numbers to `locateInBook`. `tsc` 0,
eslint 0 errors (34 pre-existing warnings, none in a touched file), full suite green — 94
suites / 1204 tests, both projects.

| Surface | File | What it asks the translator for |
| ------- | ---- | ------------------------------- |
| Player screen — chapter identity | `hooks/useCurrentChapterStable.ts` | the Chapter, and its start in QUEUE coordinates |
| Player screen — progress bar | `components/PlayerProgressBar.tsx` | that start, once per chapter change |
| Service — progress tick | `setup/service.ts` `handleProgressUpdated` | Chapter index + Chapter Position |
| Service — pause/stop persist | `setup/service.ts` `Event.PlaybackState` | Chapter Position |
| Skip-previous press | `helpers/chapterSkip.ts` | Chapter index + Chapter Position |
| Skip-next press | `helpers/chapterSkip.ts` / `helpers/nextPress.ts` | exact Book Position |
| Sleep-timer ceiling | `helpers/remainingChapterCount.ts` | Chapter index |

### The identity that dissolved the branch

A Chapter's start expressed in the Player's own coordinates is
`positionSeconds - chapter.positionSeconds`. On a one-item Queue the Position IS the Book
Position, so the difference is the Chapter's absolute `startMs`; on a multi-item Queue the
Position ALREADY IS the Chapter Position, so the difference is 0. One expression, both
shapes, no verdict — and it is what the progress bar, the chapter hook and the
restart-this-chapter seek all now use in place of their own branch.

### What still holds a verdict, and why it is not a coordinate branch

- `PressReading.oneItemQueue` — TRANSPORT ONLY. The two shapes genuinely MOVE differently:
  a one-item Queue reaches another Chapter by seeking inside its single track, a multi-item
  one by stepping to another track. No arithmetic dissolves that, so it stays a parameter —
  the arrangement this ticket held up as the pattern to copy, now shared by both ends
  instead of sitting one function above a skip-previous that did the opposite.
- `setup/service.ts`'s three remaining `queueShapeOf` calls. What they select is not "what
  does this Position mean" but WHICH SUBSYSTEM OWNS CHAPTER CHANGES: on a one-item Queue
  only the progress tick can see a boundary cross, while a multi-item Queue gets one
  `PlaybackActiveTrackChanged` per boundary and must not count it twice. The verdict there
  is also `evaluateBookEnd`'s parameter — one of ADR 0004's three blessed callers. The
  comment at that site was rewritten to say so, since it previously described itself as a
  stage-1 arrangement awaiting this ticket.

### The reads, before and after

Every migrated site now issues its Player reads in one `Promise.all` at the top and passes
plain numbers down. Three helpers used to read halfway through a decision:

- `skipToPreviousChapter` fetched `getActiveTrackIndex()` inside one arm of one branch;
- `resolveNextPress` fetched `getProgress()` inside one arm and `getActiveTrackIndex()` +
  `getQueue()` inside the other — so the two arms of one decision could see the Player at
  two different moments;
- `remainingChapterCount` fetched `getProgress()` or `getActiveTrackIndex()` depending on
  the shape.

`resolvePreviousPress` and `resolveNextPress` are now **pure and synchronous**, which is why
their suites (`chapterSkip.previous.test.ts`, `chapterSkip.next.test.ts`) no longer need a
simulated player. They build readings through the real `locateInBook`, since half of what is
pinned is that the two modules compose.

### The progress bar's split is intact

`useCurrentChapterStable` resolves the chapter offset on the JS thread when the chapter
changes and parks it in a `SharedValue`; `useDerivedValue` still does one subtraction per
frame. No translator call happens inside a worklet, and the header at that site says why in
terms of the fresh object `locateInBook` returns per call.

### ⚠ Behavioural deltas — every place a coordinate is now null where a zero was fabricated

All nine are the exact-or-null contract (ADR 0004 ruling 3) finally reaching a consumer.

1. **Sleep-timer ceiling, unreadable Queue index.** Was `0` — "no boundaries left", a claim,
   not a reading. Now `null`. It contradicted `remainingChapterCount`'s own header, which
   has always documented `null` as covering "a Player read that failed". Both surfaces
   already handle `null`: the settings screen falls back to its 20 seed, the modal shows 0.
2. **Sleep-timer ceiling, a one-item Book with no usable boundaries or a playhead inside a
   preamble.** Now `null` rather than an index scanned from rows that cannot support one.
3. **Skip-previous, one-item Queue, first chapter, within the threshold.** Reported
   `'previous'`; now `'restart'`. **The seek target is unchanged** — the start of the Book
   either way. Only the footprint label moves, and it stops calling a press that stayed in
   chapter 1 a chapter change. The multi-item side has always answered `'restart'` there,
   and `chapterSkip.ts`'s header has always claimed both shapes did.
4. **Skip-previous, a one-item Book whose rows carry no usable boundaries.** Now restarts
   (`'restart'`, seek 0). The raw backwards scan named the LAST row for every position, so
   the old target could seek FORWARD on a skip-back press.
5. **Skip-next, a press inside a preamble on a one-item Queue.** Now seeks to the FIRST
   boundary. `getNextChapterStartSeconds` derived chapter 0 and took the row after it, so
   the press skipped past the first chapter to the second.
6. **Skip-next, Book Position unreadable on a one-item Queue.** Now `'none'` — the press
   does nothing. Deliberately NOT the acting path the other arm takes for an unreadable
   index: acting here means choosing between a seek that cannot be computed and FINISHING
   THE BOOK, and a Book marked Finished by accident costs the user their position (nothing
   moves a Book off Finished but a play press, which restarts it from 0:00). The
   destructive direction never gets the benefit of the doubt.
7. **Service progress tick, a one-item Book whose Chapter cannot be told.** The tick now
   writes nothing — store, DB and lock-screen metadata all skipped — instead of writing a
   fabricated chapter index and progress every second. Two Books were affected, and the
   first is the worse: rows all at `startMs: 0` made the backwards scan return the LAST
   chapter, so such a Book reported itself in its final chapter from the first second; a
   playhead inside a preamble was reported as chapter 0. Book-end detection and the
   sleep-timer tick still run on those ticks.
8. **Service pause/stop persist, same case.** The DB write is skipped rather than storing a
   Book Position in a column that means seconds into a Chapter. ⚠ The two levels of `null`
   are both used here and mean different things: a `null` RESULT is "no chapter rows at
   all", where the stored Chapter Position IS the raw Position and always has been, so that
   write still happens.
9. **Player screen, an out-of-range Queue index, and a one-item Book with no boundaries or
   a preamble.** `useCurrentChapterStable` clamped an out-of-range index to the last chapter
   (`Math.min(index, chapters.length - 1)`); the translator refuses. The screen shows no
   chapter and the progress bar falls back to its whole-Book display — the fallback it has
   always taken when a chapter duration was unavailable.

10. **Skip-previous, a one-item Book with a SINGLE chapter that starts at a non-zero
    `startMs`, pressed past the threshold.** Now seeks to that chapter's start;
    `getPreviousPressTarget` special-cased a one-chapter list and always seeked 0. The new
    answer is the same rule every other case follows — restart the Chapter you are in.
11. **Player screen, chapter identity on a multi-item Queue, while backgrounded or for one
    bridge round-trip after a boundary.** A chapter Queue used to read its index straight
    out of the store in a `useMemo`, so it updated synchronously and updated while
    backgrounded; it now waits for a Position like the one-item path always did. The
    staleness is bounded: a chapter can only change while PLAYING, and playing means 1 Hz
    progress events, so a resumed screen corrects within a second. ⚠ Not a null delta — a
    timing one, and the only place this migration traded a synchronous answer for an
    asynchronous one.
12. **Service pause/stop persist, multi-item Queue with an unreadable index — CAUGHT BY
    THE REVIEW, and it was a regression, not a delta.** The first version of this migration
    required `location.chapter` for every write, which `locateInBook` nulls when the Queue
    index is unusable. On a chapter Queue the Position IS the Chapter Position and the old
    code needed no index at all, so a transient index read failure silently DROPPED the
    pause write and cost the user their position. Fixed before commit: the handler now asks
    which coordinate survived. No Chapter and no exact Book Position means the index failed
    on a chapter Queue — write the Position, nothing is fabricated. An exact Book Position
    with no Chapter means one Queue item whose rows carry no boundaries — decline, because
    writing there would store a Book Position in a column that means seconds into a
    Chapter. The two levels of `null` in ruling 3's contract are what make the distinction
    available, and this is the site that needs it.

### Removed on the way

- `getPreviousPressTarget` / `PreviousPressTarget` and `getNextChapterStartSeconds`
  (`helpers/singleFileBook.ts`). Both were one-item-only press-target calculators, correct
  only because their caller had branched on shape first; their whole behaviour is now in
  `resolvePreviousPress` / `resolveNextPress`. Leaving them would have left two competing
  press-target calculators, which is the disease this spec treats.
- `helpers/__tests__/singleFileBook.test.ts` — it tested only `getPreviousPressTarget`. Its
  cases moved verbatim into `chapterSkip.previous.test.ts`, one of them with its expectation
  changed and the reason written above it (delta 3).
- `PreviousPressKind` moved from `singleFileBook.ts` to `chapterSkip.ts`, beside the
  decision that produces it. `activeBookFootprints.ts` imports it from there (type-only, so
  no runtime cycle).

### Notes for the tickets that follow

- ⚠ `resolveCurrentChapterIndex` (`helpers/chapterPlayback.ts`) is now **unreferenced by
  production code** — `useCurrentChapterStable` was its last caller. It is left in place
  deliberately: ticket `11` names "the chapter-index resolver" as its own to remove, along
  with `findChapterIndexByPosition`. Its tests still pass and still pin its behaviour.
- `calculateRemainingBookTime` (same file, used by `BookTimeRemaining`) still branches on
  the verdict. It is a derived-display consumer, so it belongs to ticket `09` with the other
  persisted surfaces, not here.
- `helpers/singleFileBook.ts` is now down to `findChapterIndexByPosition`,
  `calculateAbsolutePosition`, `calculateProgressWithinChapter` and `hasValidChapterData` —
  the first three being exactly ticket `11`'s removal list. That leaves the module holding
  one function and a name that describes a shape, which is `11`'s last checkbox.

### What the two-axis review changed

Both axes ran against the staged diff. Six fixes were applied, one of them a real bug.

1. ⚠ **The dropped pause write** — delta 12 above. The spec axis traced it; it was the only
   finding that would have cost a user anything.
2. **The press decisions stopped being handed a location.** `PressReading` carried
   `chapters`, `positionSeconds`, `queueIndex` AND a `location` derived from all three, so
   the type described states where the location disagreed with the numbers beside it. Both
   resolvers now call `locateInBook` themselves — pure, so no rule is bent — and the
   reading is the numbers alone.
3. **`chapterStartInQueueSeconds` is one exported function** (`bookLocation.ts`) rather than
   the same subtraction written by hand at three sites, two of which had already drifted on
   whether to clamp.
4. **The player screen's chapter and its start became ONE value.** They were a
   `Chapter | undefined` beside a `number`, so the start read `0` for a chapter that never
   resolved — ruling 3's fabricated zero, reintroduced one layer up. They are now a single
   `CurrentChapterLocation | undefined`, known together or not at all.
5. **The widened `getQueue()` read is justified in the code.** Both axes flagged that
   `handleNextPress` now reads the Queue on the one-item arm too. The read stays — making it
   conditional is what "reads the Player once" forbids — with a comment recording that the
   arm where the read is NEW has a Queue of exactly one item by definition of the verdict,
   and the arm that could cost hundreds always read it.
6. **`NextPressBook` moved to `nextPress.ts`**, which is now its only user;
   `resolveNextPress` takes chapter rows and numbers.

Not changed, and recorded rather than fixed: `useCurrentChapterStable` keeps two Player
reads at two moments. Only one is per-decision — `getProgress` — while
`getActiveTrackIndex` fires solely as a cold-store mount fallback and its answer is stored,
never combined with a fresh position. The steady-state index comes from the library store,
so the hook makes no per-tick index read at all. Commented at the site.

**ADR 0004 gained an addendum.** Its ruling-1 reopen condition — *"Count the callers before
adding one; do not add one quietly"* — was tripped by this ticket, which adds
`skipToPreviousChapter` as a verdict holder. The addendum records the count, separates the
three audiences that now exist (builders, transport, chapter-change ownership), argues why
ruling 1 survives, notes that the persisted readers still owed to tickets `09`–`11` are the
real test, and records that ruling 3's own reopen condition was checked and held: the five
migrated sites collapse `null` five different ways.
