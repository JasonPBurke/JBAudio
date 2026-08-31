# 01 — Add `queueShapeOf` beside the existing mechanisms

**Spec:** `.scratch/queue-shape/spec.md` — decisions 1, 2, 4, 6.

**What to build:** One function that answers, for a Book, whether its Queue is **one item**
or **one item per Chapter**. That is the question nine separate pieces of code currently
answer for themselves, by consulting different sources, with results that can disagree.

It is pure and synchronous — a Book's chapters in, a verdict out, no Player read — because
the two queue builders ask it *in order to build a Queue* (so there is nothing to observe
yet) and the library list asks it once per visible row (so it must not touch the bridge).

The expand half of an expand–contract: nothing calls it yet and the app behaves
identically. Ticket `04` removes what it replaces.

⚠ It carries a **deliberate correction**. The existing derived check and the persisted
scan-time flag are the same predicate written twice, with an off-by-one in the copy
everything downstream reads. Today a **one-chapter Book** makes the "treat as single file"
and "uses chapter queue" helpers **both return true** — two contradictory claims about one
Book. The new verdict uses the correct threshold, so a one-chapter Book answers
`'one-item'`. Nothing consumes that yet; ticket `03` lands the behavioural effect.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Verdict is `'one-item' | 'multi-item'` — the vocabulary the book-end detection helper
      already ships, device-verified on both shapes. Not `'absolute' | 'chapter-relative'`;
      the architecture review's sketch is rejected, see the spec's `## Solution`
- [x] Pure and synchronous; imports nothing from the player adapter, does no IO, logs
      nothing
- [x] A Book with exactly one chapter answers `'one-item'`
- [x] Memoised on the chapters array via a `WeakMap`, keyed by array reference so a rescan
      collects the old entry and there is no invalidation code
- [x] The module header states **why** the memo is sound — both non-chapter inputs are
      process-constant — and that making either runtime-variable would silently serve stale
      verdicts with no symptom
- [x] Unit tests cover all four authoring shapes from the spec, **including** the
      multi-file-with-embedded-chapters shape that is already broken in the queue builder —
      asserting what it currently answers, so later tickets cannot move it silently
- [x] The matching threshold on the sibling chapter-data predicate is audited, every caller
      of both is checked for whether the old threshold was load-bearing, and the findings
      are recorded on this ticket before any threshold is changed
- [x] The dead chapter-end helper (zero callers) is deleted
- [x] `tsc` 0, eslint 0, full suite green

---

## Answer

`queueShapeOf` lives in `src/helpers/queueShape.ts`, with unit tests in
`src/helpers/__tests__/queueShape.test.ts` (helpers lane, 13 tests). It has no callers —
this is the expand half. `getChapterEndPosition` is deleted. `tsc` 0, eslint 0 errors, full
suite green (92 suites / 1153 tests, both projects).

Two shapes of input the ticket did not name, both decided by
`bookEndDetection`'s fail-closed rule (anything not exactly `'one-item'` is multi-item):
**undefined chapters** and an **empty array** both answer `'multi-item'`, so a Book with no
usable chapter data is left unhandled downstream rather than confidently mishandled. Pinned
by tests.

The projection type is **shared, not copied**: `clippedChapters.ts` now exports its
`GateChapter` and `queueShape.ts` aliases it. A second, drifting copy of that projection is
exactly how a Book slips past the memory gate in one module while the queue builders reject
it. (`chapterPlayback.ts`'s `ChapterLike` is a third copy of the same four fields; it dies
with that module in `04`.)

### Threshold audit (decision 2's audit obligation)

**Ruling: neither threshold changes. `isSingleFileBook` and `hasValidChapterData` both keep
`length > 1`.** `queueShapeOf` composes its own `length > 0` predicate instead of editing
theirs, which is what keeps this ticket free of behavioural delta.

#### `isSingleFileBook()` — `chapters.length <= 1 → false`

| Caller | A ONE-chapter Book today | `> 1` load-bearing? |
| ------ | ------------------------ | ------------------- |
| `clippedChapters.ts:73` (`shouldUseClippedChapters`) | gate returns `false` | **Jointly** — finding 1 |
| `restoreLastActiveBook.ts:53` | falls to the multi-file branch, which maps 1 chapter → 1 track | No — but see finding 3 |
| `handleBookPlay.ts:176` | same | No — but see finding 3 |
| `chapterPlayback.ts:37` (`usesChapterQueue`) | returns `true` | No — finding 2 |

#### `hasValidChapterData()` — `chapters.length <= 1 → false`

| Caller | A ONE-chapter Book today | `> 1` load-bearing? |
| ------ | ------------------------ | ------------------- |
| `clippedChapters.ts:74` (`shouldUseClippedChapters`) | gate returns `false` | **Jointly** — finding 1 |
| `restoreLastActiveBook.ts:70` | unreachable — already inside the `else if (singleFile)` branch, which needs `> 1` | No, redundant |
| `handleBookPlay.ts:192` | unreachable, same reason | No, redundant |
| `service.ts:299` | unreachable — inside `book.chapters.length > 1` at `service.ts:259` | No, redundant |

#### Finding 1 — the two thresholds are load-bearing only TOGETHER

Inside `shouldUseClippedChapters`, flipping either one alone changes nothing, because the
other still rejects a one-chapter Book. Flipping **both** to `> 0` would make a one-chapter
Book with a non-zero `startMs`, non-auto chapters and a small sample table **clippable** —
a one-item Book would start loading as a clipped queue. That is a real runtime change with
no ticket behind it, and it is exactly the failure the spec's ⚠ warns about: changing one
threshold without checking the other is how the original off-by-one arrived.

#### Finding 2 — `usesChapterQueue`'s `true` on a one-chapter Book costs nothing, at all SEVEN call sites

⚠ **This finding was first recorded having traced only two of them.** The two-axis review
caught it; the trace below is the complete one. The gap mattered — two of the untraced five
are footprint writes, which is the direction the spec calls destructive.

| Site | Today (chapter-queue path) | After the flip (one-item path) | Delta |
| ---- | -------------------------- | ------------------------------ | ----- |
| `chapterPlayback.ts:52` `resolveCurrentChapterIndex` | `Math.min(queueIndex, 0)` → `0` | `findChapterIndexByPosition` → `0` | none |
| `chapterPlayback.ts:73` `calculateRemainingBookTime` | sum loop runs zero times, `totalPlayed === position` | `bookDuration - position` | none |
| `db/footprintQueries.ts:75` `getCurrentChapterInfo` | `{ trackIndex, position }` | `{ 0, position - startMs }` | none |
| `db/footprintQueries.ts:158` `recordSeekFootprint` | `chapterIndex = trackIndex ?? 0` | index derived from position → `0` | none — and it **drops the `?? 0` fabrication** |
| `hooks/useCurrentChapterStable.ts:68` | index from `playbackIndex` / `getActiveTrackIndex()` → `0` | derived from progress → `0` | none |
| `app/chapterList.tsx:90` | `skip(0)` | `seekTo(startMs / 1000)` = `seekTo(0)` | none — both land at 0:00 |
| `app/footprintList.tsx:92` | `skip(0)` then `seekTo(pos)` | `seekTo((0 + pos) / 1000)` | none |

⚠ **Every row is zero-delta for the SAME reason, and it is an assumption, not seven
independent proofs:** a one-chapter Book has `startMs: 0` and queue index `0`, so the two
coordinate systems coincide. That is the spec's own explanation of why the off-by-one has
never bitten, load-bearing in seven places at once. A one-chapter Book with a **non-zero**
`startMs` — shape D's degenerate case, which the scanner can produce — breaks every row in
the table. It is not reachable today because `buildChaptersFromMetadata` gives a
single-chapter file `startMs: 0`, but nothing enforces that.

#### Finding 3 — a one-chapter Book changes notification title in `03`

Both queue builders currently send a one-chapter Book down the **multi-file** branch, which
titles the track from `chapter.chapterTitle` and sets the artist from `chapter.author`. The
single-file branch titles it `initialChapter?.chapterTitle ?? book.bookTitle`, and
`hasValidChapterData` is `false` for one chapter, so it resolves to the **Book title**.

So when `03` routes the builders through the verdict, a one-chapter Book's **notification
title changes from the chapter title to the Book title**. That is the correct display for a
Book whose one "chapter" is the whole file, but it is observable and belongs on `03`'s
device rows — not filed later as a regression.

### What the later tickets inherit

- **`02`** (zero-delta consumers): the five sites in finding 2's table are confirmed
  zero-delta. Do not "fix" `footprintQueries:158`'s `?? 0` separately — routing it through
  the verdict removes it.
- **`03`** (one-chapter flip): carry finding 3 as an expected, observable delta.
- **`04`** (remove old mechanisms): do not touch either threshold; let both predicates die
  with their callers, and fold `chapterPlayback.ts`'s `ChapterLike` into the shared
  `GateChapter`.
- **Out of scope, worth filing:** finding 2's caveat — a one-chapter Book with a non-zero
  `startMs` would break all seven sites — is a second face of the shape-D defect the spec
  already sends to its own ticket.

⚠ **The spec's `## Ticket breakdown` numbering is stale** relative to the files in
`issues/`: it lists five stage-1 tickets where there are now six, so its `03`/`04`/`05` do
not mean what the filenames mean. Trust the filenames.
