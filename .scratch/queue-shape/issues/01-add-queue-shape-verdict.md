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

## Threshold audit (decision 2's audit obligation)

**Ruling: neither threshold is changed. `isSingleFileBook` and `hasValidChapterData` both
keep `length > 1`.** `queueShapeOf` composes its own `length > 0` predicate instead of
editing theirs, which is what makes this ticket an expand-half with no behavioural delta.

### `isSingleFileBook()` — `chapters.length <= 1 → false`

| Caller | Effect on a ONE-chapter Book today | `> 1` load-bearing? |
| ------ | ---------------------------------- | ------------------- |
| `clippedChapters.ts:73` (`shouldUseClippedChapters`) | gate returns `false` | **Jointly** — see below |
| `restoreLastActiveBook.ts:53` | falls to the multi-file branch, which maps 1 chapter → 1 track | No, but see the title delta |
| `handleBookPlay.ts:176` | same | No, but see the title delta |
| `chapterPlayback.ts:37` (`usesChapterQueue`) | returns `true` | No — zero delta, see below |

### `hasValidChapterData()` — `chapters.length <= 1 → false`

| Caller | Effect on a ONE-chapter Book today | `> 1` load-bearing? |
| ------ | ---------------------------------- | ------------------- |
| `clippedChapters.ts:74` (`shouldUseClippedChapters`) | gate returns `false` | **Jointly** — see below |
| `restoreLastActiveBook.ts:70` | unreachable — already inside the `singleFile` branch, which requires `> 1` | No, redundant |
| `handleBookPlay.ts:192` | unreachable for the same reason | No, redundant |
| `service.ts:299` | unreachable — inside `book.chapters.length > 1` at `service.ts:259` | No, redundant |

### The three findings

1. **The two thresholds are load-bearing only TOGETHER, inside
   `shouldUseClippedChapters`.** Flipping either one alone changes nothing there, because
   the other still rejects a one-chapter Book. Flipping *both* to `> 0` would make a
   one-chapter Book with a non-zero `startMs`, non-auto chapters and a small sample table
   **clippable** — i.e. a one-item Book would start loading as a one-item *clipped* queue.
   That is a real runtime change with no ticket behind it. This is exactly the failure the
   spec's ⚠ warns about: changing one threshold without checking the other is how the
   original off-by-one arrived.

2. **`usesChapterQueue`'s `true` on a one-chapter Book costs nothing today**, which is why
   the contradiction with `treatAsSingleFile` has never bitten. Traced through both
   consumers: `resolveCurrentChapterIndex` clamps to `Math.min(queueIndex, 0) === 0`, and
   `calculateRemainingBookTime`'s chapter-queue branch sums zero prior chapters, so
   `totalPlayed === positionSeconds` — arithmetically identical to the legacy branch. The
   contradiction is latent, not active.

3. **A one-chapter Book takes the multi-file branch in both queue builders, and that branch
   differs cosmetically.** It sets the track title from `chapter.chapterTitle` and the
   artist from `chapter.author`; the single-file branch sets the title to `book.bookTitle`
   whenever `hasValidChapterData` is false. So when ticket `03` routes these two sites
   through the verdict, a one-chapter Book moves onto the single-file branch and its
   **notification title changes** from the chapter title to the Book title. That is the
   correct display for a Book whose one "chapter" is the whole file, but it is a visible
   change and belongs on `03`'s device rows, not filed as a regression.

### Ticket `03` inherits

- Do not touch either threshold. Route callers onto `queueShapeOf` instead and let the two
  old predicates die with their callers.
- Carry finding 3 onto `03` as an expected, observable delta.
