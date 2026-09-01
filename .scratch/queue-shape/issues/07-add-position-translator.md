# 07 — Add the position translator beside the conversion pair

**Spec:** `.scratch/queue-shape/spec.md` — decisions 1, 3.

**What to build:** One function that answers "where am I, in Book terms?" and returns
**both** coordinates at once — Book Position and Chapter Position — so that no consumer ever
converts between them again.

This is the module the whole effort is for. Stage 1 gave every site the same verdict but
left each one branching on it; this removes the branch. The shape question is nothing but
*the conversion between the two coordinates*, so once the conversion happens in one place,
the question stops being asked.

⚠ **The translator already exists in the codebase, unguarded.** Two functions convert in
each direction today, both assuming the one-item mapping, both correct only because their
callers branch first. That is the mechanism that produced nine competing mechanisms: when
the conversion silently assumes a shape, the decision has to live at every call site and it
multiplies with them. This ticket writes the guarded version; `11` deletes the pair.

Pure and synchronous, taking plain numbers. That is what lets the persisted consumers —
library rows, chapter list, footprint list — use it without touching the bridge, and it is
why the signature must not grow a Player read for convenience.

**The contract is exact-or-null.** `null` means *I could not tell*, **never** *the answer is
zero*. This is the house rule already stated three times in this codebase, being extended
rather than invented: the sleep-timer ceiling returns null for not-known so callers can tell
"zero" from "not arrived"; book-end detection returns "none" and never "clear" for an
undecidable tick; the skip-next decision treats an unreadable index as *act*, not as *index
zero*.

Each coordinate is independently nullable, because they have **opposite reliability and it
flips with the shape**: on a chapter Queue, Chapter Position is exact and free while Book
Position must be summed from chapter durations, which is corruptible; on a one-item Queue it
is the other way round.

The best-effort variant returns an approximate Book Position, counting unusable durations as
zero. It is separate and separately named because the approximation must be **asked for by a
name that admits what it is**. See the spec for why one policy cannot serve both consumers.

**Blocked by:** 04

**Status:** resolved

- [x] Returns both coordinates from one call, computed once
- [x] Pure and synchronous, plain numbers in; imports nothing from the player adapter
- [x] Each coordinate independently nullable; the **whole** result is null — not a result of
      nulls — when there is no Book or no chapters, so callers can tell "no Book" from "a
      Book I cannot measure"
- [x] An unreadable Queue index yields null for the coordinate that needs it, never a
      fabricated zero
- [x] A chapter with an unusable duration voids **Book Position only**; Chapter Position
      still answers where it can
- [x] The best-effort variant exists under a name that says it approximates, and its header
      names the shipped bug that makes the distinction load-bearing
- [x] Unit tests cover both shapes, both coordinates, and every null path
- [x] Nothing calls it yet; the app is unchanged
- [x] `tsc` 0, eslint 0, full suite green

## Answer

`src/helpers/bookLocation.ts` — `locateInBook(chapters, reading)` and
`approximateLocationInBook(chapters, reading)`, both pure, synchronous and importing
nothing from `@/player/*`. 35 unit tests in `src/helpers/__tests__/bookLocation.test.ts`,
`helpers` lane. Nothing calls either yet (grep: the module and its own test are the only
files naming it); the app is byte-for-byte unchanged. `tsc` 0, eslint 0, full suite green
— 94 suites / 1196 tests, both projects.

### The name

ADR 0004 deliberately left the primary export unnamed, so: **`locateInBook`**, in
`bookLocation.ts`. It is named for the question the ticket asks — *"where am I, in Book
terms?"* — and not for the shape it dissolves. A reader grepping for "queue shape" lands on
`queueShape.ts`, which is the trade-off the ADR already accepted.

### The signature, and the one thing the ticket did not say

```ts
locateInBook(chapters, reading) -> BookLocation | null
  BookLocation = { bookPositionSeconds: number | null, chapter: { index, positionSeconds } | null }
  reading = { from: 'queue',   queueIndex,   positionSeconds }
          | { from: 'chapter', chapterIndex, chapterPositionSeconds }
```

**The reading is a tagged union because the app genuinely holds both coordinates as
inputs**, and the ticket's framing ("an unreadable Queue index") only describes one of
them. The pair being absorbed is an INVERSE pair, and its two halves have different
callers:

- the live surfaces hold a **Position** — seconds into the playing Queue item, from the
  Player (`calculateProgressWithinChapter`'s callers);
- the persisted surfaces hold a **Chapter Position** — `current_chapter_progress` is stored
  relative to the chapter's start on a one-item Queue, which is exactly why
  `bookProgressUtils.ts:69` adds `startMs` back (`calculateAbsolutePosition`'s callers).

A translator taking only a Position would have forced every persisted consumer to convert
before calling — the thing this module exists to end, and ticket `09` requires them to use
*the same* translator. On a multi-item Queue the two tags describe the same number and the
results are identical (pinned by a test); they diverge only on a one-item Queue, by the
chapter's `startMs`.

### What each shape/reading combination answers, and where the nulls fall

| Queue shape | reading | Book Position | Chapter Position |
| ----------- | ------- | ------------- | ---------------- |
| one-item | `queue` | the Position itself, exact | scanned from `startMs` |
| one-item | `chapter` | `startMs + position`, exact | the index as given |
| multi-item | either | summed from preceding `chapterDuration` — **voidable** | the index as given |

Two consequences worth stating because they look like inconsistencies:

- **A one-item Queue with a `queue` reading ignores the index entirely** — it can only ever
  be 0 there, so an unreadable one must not refuse the answer. That is
  `getCurrentChapterInfo:54`'s over-strict bug (ticket `10`) having nowhere left to live.
- **A one-item Queue with a `chapter` reading nulls BOTH coordinates** for an unreadable
  index, because there the index is the whole conversion. Same rule — "null for the
  coordinate that needs it" — reaching opposite answers because different coordinates need
  it. Never a fabricated row 0, which is `recordSeekFootprint:174`'s under-strict bug.

### The voiding rule is narrower than `measureQueue`'s, on purpose

`secondsBefore` reads only the chapters BEFORE the playing one, so an unusable
`chapterDuration` later in the Book leaves the answer exact (pinned by a test).
`bookEndDetection`'s `measureQueue` voids on ANY row and is right to: it sums what is still
to come. This sums what is already past. An unusable duration is `<= 0`, non-finite, or
absent — the same predicate `measureQueue` uses.

### The approximation

`approximateLocationInBook` counts unusable durations as zero and is otherwise identical.
Its header names the shipped bug — a `duration: 0` chapter marking a twenty-file Book
Finished at chapter five — and states the argument that has to outlive a refactor: severity
is a property of what the caller does with the number, which this module cannot see.
⚠ **It approximates durations only.** An unreadable index still yields nulls; there is no
honest approximation of *which* Chapter.

### Notes for the tickets that follow

- `findChapterIndexByPosition` is still imported from `singleFileBook.ts` rather than
  copied. Ticket `11` moves its body here and drops it from the public surface; duplicating
  the backwards scan now would have meant two walkers to keep in step in the interim.
- The result is a fresh object per call, including on the unmeasurable path — no shared
  constant is handed out, so a caller's mutation cannot poison the next answer. `08`'s
  progress-bar warning still stands: keep the once-per-chapter-change split, and no
  translator call inside a worklet.
- ⚠ Tests must reach for `__tests__/support/queueShapeFixtures.ts`. A row carrying only
  `startMs` reads as multi-item, and a fixture whose rows all sit at `startMs: 0` makes the
  backwards scan answer the LAST index for every position.

### What the two-axis review changed

Standards found no hard violation (ADR 0003 purity, ADR 0004's rulings, CONTEXT.md's nouns
and the `helpers` lane all clean); spec judged the tagged union justified by `09` rather
than speculative. Five fixes were applied, two of them behavioural:

1. ⚠ **The last fabricated coordinate is gone.** The one-item `queue` path called
   `findChapterIndexByPosition` raw, and that function answers `0` when the position
   precedes every boundary and answers the LAST row when every `startMs` is `0` — the trap
   the test fixtures document, with no production guard. `chapterIndexAtPosition` now wraps
   it and returns `null` in both cases. **Book Position is unaffected and stays exact**; only
   the Chapter goes null. This is the module's own contract finally applied to its own scan.
2. The unmeasurable result is a factory, not a shared mutable constant.
3. `usableDuration` (`> 0`) is named beside `usableSeconds` (`>= 0`), with the
   one-character difference explained: a position of zero is the start of the Book, a
   duration of zero is `makeErrorChapter` reporting a file it could not read.
4. The private policy argument is `'exact' | 'count-unusable-as-zero'`, not a boolean — the
   internals now agree with the header's argument against flags.
5. Coverage filled: the chapter-tag null paths, the one-chapter Book under both tags, the
   approximate variant on a one-item Queue, and the fresh-object guarantee.

### ⚠ Deltas ticket `08`/`09` must handle at migration

Two places where the translator answers differently from the code it replaces. Both are the
contract working as ADR 0004 ruling 3 intends; neither is a regression, and both need a
decided behaviour at the consuming surface:

- **An out-of-range chapter index nulls both coordinates**, where the deleted
  `calculateAbsolutePosition` CLAMPED it (`Math.min(chapterIndex, chapters.length - 1)`)
  and fell back to the raw progress. `bookProgressUtils.ts:64` still clamps today, so this
  is a live consumer delta.
- **A Chapter of `null` with an exact Book Position** is a new combination: it appears on a
  one-item Queue when the position precedes the first boundary, or when the rows carry no
  boundaries at all. A surface showing "which chapter" needs an answer for it; a surface
  showing "how far through" is unaffected.
