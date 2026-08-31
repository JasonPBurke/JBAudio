# Give Queue shape a module of its own

Status: ready-for-agent

Scoped by the grilling of `.scratch/queue-shape/brief.md` on 2026-08-31, driver-approved
in full. Twelve decisions, all answered; the brief's `## Not yet decided` section is
closed. Read the brief for the history — this file supersedes its design sketches, and
where the two disagree **this file wins**.

⚠ **The brief's central sketch is dead.** `resolveQueueShape` returning
`'absolute' | 'chapter-relative'` was the architecture review's guess. It is not what
gets built. See `## Solution`.

## Problem statement

`CONTEXT.md` names the hazard on **Position** — what it is measured against depends on
how the Queue was built — and no module owns it. The brief measured five mechanisms
across four sites.

**Re-measured during scoping: nine mechanisms in six variants.** Two are on no list in
the brief or its addenda:

| # | Mechanism | Where | Note |
| - | --------- | ----- | ---- |
| 1 | `isSingleFileBook()` | `helpers/singleFileBook.ts:8` | URL equality, `length > 1` |
| 2 | `book.isSingleFile` | scan-time flag, `scannedBookGrouping.ts:181` | `length > 0` |
| 3 | `shouldUseClippedChapters()` | `helpers/clippedChapters.ts:68` | chapters + heap gate |
| 4 | `usesChapterQueue()` | `helpers/chapterPlayback.ts:34` | composes 1 + 3 |
| 5 | `treatAsSingleFile()` | `helpers/clippedChapters.ts:110` | composes 2 + 3 |
| 6 | `queue.length === 1` | `chapterSkip.ts:62`, `service.ts:686`, `remainingChapterCount.ts:58` | three live sites |
| 7 | inline `book.isSingleFile && !shouldUseClippedChapters(...)` | `helpers/bookProgressUtils.ts:66` | **not on any list** |
| 8 | `isChapterRelative = shouldUseClippedChapters(...)` | `components/PlayerProgressBar.tsx:82` | **not on any list** |
| 9 | `readQueueShape()` | `helpers/relativeSeek.ts:130` | **misnamed** — resolves no shape |

Also found: `getChapterEndPosition()` in `singleFileBook.ts:78` has **zero callers**.

### Why there are nine

`helpers/singleFileBook.ts` already contains the translator, as an unguarded inverse
pair:

- `calculateAbsolutePosition(chapters, idx, progress)` — Chapter Position → Book Position
- `calculateProgressWithinChapter(chapters, position)` — Book Position → Chapter Position

Neither consults the Queue shape. Both hardcode the one-item mapping and are correct
**only because every call site branches before calling them**. That is the disease's
mechanism: when the conversion pair silently assumes one shape, the decision must live
at the call sites, and it multiplies with them.

`singleFileBook.ts` is the translator wearing a special case's name.

### The four authoring shapes

| Shape | URLs | `startMs` | Runtime Queue |
| ----- | ---- | --------- | ------------- |
| A. multi-file, one chapter per file | distinct | all `0` | multi-item, item = file = chapter |
| B. single-file with real chapters | one | non-zero | **depends on the heap gate** — clipped multi-item, or legacy one-item |
| C. single-file, no chapter metadata | one | `0` | one-item, exactly one chapter row |
| D. multi-file, each file with embedded chapters | **distinct** | **non-zero** | **broken — see below** |

⚠ **Shape D is already broken in the queue builder, independent of this work.**
`scanLibrary.ts:472`'s `buildChaptersFromMetadata` runs **per file**, so a two-file Book
with five embedded chapters each becomes ten chapter rows with distinct URLs and non-zero
`startMs`. `handleBookPlay.ts:217` then builds **one whole-file track per chapter row**
with no clipping — file A repeated five times — so playing "chapter 3" starts file A at
0:00. This spec does **not** fix that and does **not** represent shape D in the verdict.
See `## Out of scope`.

## Solution

**The module answers in coordinates, not in a verdict.**

Two exports with very different audiences:

1. **`queueShapeOf(chapters) → 'one-item' | 'multi-item'`** — the verdict. Three callers
   only: the two queue builders (`handleBookPlay`, `restoreLastActiveBook`), which ask in
   order to *build*, and `evaluateBookEnd`, which already takes it as a parameter.
2. **A position translator** — everyone else (~13 sites). It returns both coordinates at
   once, computed once, so **no consumer branches on shape again**.

The verdict is demoted because it was never the right primary export. Every consumer is
asking for one of two coordinates — Book Position, or Chapter Position — and the shape
question is nothing but *the conversion between them*.

## User stories

- As a listener on a legacy single-file Book, the player screen, the library row, the
  notification and the sleep timer agree about which Chapter I am in, because one function
  decided it.
- As a listener whose Book has one chapter whose duration failed to extract, I see a
  sensible progress display rather than a blank or a `NaN`, and the Book is **not** marked
  Finished early.
- As the developer, adding a new surface that needs "where am I?" cannot introduce a tenth
  mechanism, because the two functions that would let it are gone and the one that
  replaced them returns both answers.

## Implementation decisions

### 1. The module never reads the Player

`queueShapeOf` and the translator are **pure and synchronous**. Neither imports
`@/player/*`. Book and numbers in, coordinates out.

This is [ADR 0003](../../docs/adr/0003-only-the-rntp-adapter-imports-rntp.md)'s decision 2
applied one layer up — the IO half must not decide, and the deciding half must not do IO.

Three consequences that are the *reason* for the rule, not side effects:

- **The queue builders can use it.** They ask in order to build a Queue, so there is no
  Queue to observe. An async, Player-reading verdict would leave the two sites that most
  need one answer keeping their own — the exact split this spec exists to close.
- **`BookDurationRow` stays off the bridge.** It renders once per visible library row and
  is deliberately unmemoized (`'use no memo'` plus no `React.memo`, both intentional). It
  works entirely from persisted `book.bookProgress`. A signature that forced Player reads
  would pull an async bridge call into a FlashList row.
- **It is testable in the `helpers` lane** with no fake player.

⚠ The no-cache-invalidation guarantee in decision 6 depends on this purity. If the module
ever fetches, logs, or does IO, revisit that decision at the same time.

### 2. The verdict's single input

```
queueShapeOf: chapters.length > 0 && every chapter shares chapters[0].url
              && !shouldUseClippedChapters(chapters)   →  'one-item'
              otherwise                                →  'multi-item'
```

**Two corrections are folded in here, both deliberate:**

- **`length > 1` becomes `length > 0`.** `isSingleFileBook` (`> 1`) and the persisted
  `book.isSingleFile` (`> 0`) are the same predicate written twice with an off-by-one in
  the copy everything downstream reads. Today a **one-chapter Book** makes
  `treatAsSingleFile()` and `usesChapterQueue()` **both return `true`** — "positions are
  absolute" and "positions are chapter-relative" asserted about the same Book. It does not
  bite only because such a Book has `startMs: 0`, so the coordinate systems coincide, and
  because nearly every consumer guards with `chapters.length > 1`.
- **`book.isSingleFile` is dropped from every playback decision.** It buys nothing: the
  library store hydrates `chapters` in the same conversion that reads the flag
  (`store/library.tsx:48,67`), so there is no "flag available, chapters aren't" case. The
  `service.ts` comments that appear to defend it — *"use isSingleFile from database
  instead of queue.length... eliminates the race condition where queue isn't ready"* —
  argue against **`queue.length`**, not for the flag over a live check. The derived check
  is equally race-immune, for the same reason. **The DB column stays; no playback code
  reads it.**

⚠ **Audit obligation.** `hasValidChapterData()` (`singleFileBook.ts:159`) carries a
matching `length > 1`. Changing one threshold without checking the other is how this
off-by-one got here. Audit every caller of both for whether `> 1` was load-bearing.

### 3. The translator's contract — exact-or-null

The translator returns **both coordinates**, each independently nullable, or `null` for
the whole record when there is no Book or no chapters.

⚠ **`null` means "I could not tell", never "the answer is zero".** This is the house rule
already stated three times in this codebase and it is being extended, not invented:

- `remainingChapterCount()` returns `null` for not-known so callers can tell "the ceiling
  is 0" from "the ceiling has not arrived".
- `evaluateBookEnd()` returns `'none'` and never `'clear'` for an undecidable tick.
- `resolveNextPress()` treats an unreadable index as "act", not as "index 0".
- `service.ts:677` documents that fabricating `0` for an unreadable index "would corrupt
  chapter index".

**Why the coordinates are independently nullable — they have opposite reliability, and it
flips with the shape:**

| | multi-item | one-item |
| - | ---------- | -------- |
| Chapter Position | **exact and free** — the queue index *is* it | derived by scanning `startMs` |
| Book Position | derived by summing `chapterDuration` — **corruptible** | **exact and free** — the raw position |

So on the common shape the coordinate the translator must *manufacture* is the corruptible
one. The corruption is not hypothetical: `scanLibrary.ts:532`'s `makeErrorChapter` stores
`duration: 0` for a file whose metadata extraction failed, and the single-chapter path
falls back to `0` whenever the duration tag is missing.

#### The best-effort variant

A **separately named** function returns an approximate Book Position, counting unusable
durations as zero. Exact-or-null is the default; the approximation must be **asked for by
a name that admits what it is**.

⚠ **This is not over-engineering, and here is the reason to keep it when someone proposes
`?? 0`:** the same arithmetic error has different severity per consumer, and severity is a
property of what the caller *does* with the number — which the translator cannot see.

- In `bookProgressUtils` (library rows), an undercount reads the progress capsule a little
  low. **Cosmetic.**
- In `evaluateBookEnd`, the identical undercount empties the "still to come" sum and marks
  the Book **Finished hours early**. Recovery costs the user their position — nothing moves
  a Book off Finished except a play press, and that restarts from 0:00. **Destructive.**

`bookEndDetection.ts`'s `measureQueue` already voids its whole measurement rather than
counting such a row as zero, with a full rationale in its header. That policy is right
there and wrong for a library row. Hence two functions, not one policy.

Today's `bookProgressUtils.ts:77` writes `chapters[i]?.chapterDuration ?? 0` and nothing
about that line says it belongs to the family that once marked a 20-file Book Finished at
chapter 5.

### 4. Vocabulary

**`'one-item' | 'multi-item'`.** Reused verbatim from `bookEndDetection.ts:43`, which
already ships it, device-verified on both shapes, with a documented fail-closed rule
(anything not exactly `'one-item'` is treated as multi-item).

The review's `'absolute' | 'chapter-relative'` is rejected: once the translator absorbs
the branching, only three callers see a verdict and two of them are *builders*. For a
builder deciding how many tracks to create, "one-item / multi-item" is the question;
"absolute / chapter-relative" is a non-sequitur.

### 5. Glossary — `CONTEXT.md` gains three terms and loses a hazard

⚠ **Nine mechanisms is what a missing noun looks like in code.** `CONTEXT.md` had **one
word for three quantities**, so every site that needed one of the derived two had to
re-derive it and had no word to name which one it meant.

Stage 1 rewrites `CONTEXT.md`'s **Position** entry and adds three:

- **Position** — narrowed to what the Player reports: where playback has reached *within
  the current Queue item*. The `⚠` about what it is measured against is **deleted** — that
  warning was the glossary admitting it had not finished. Position was never ambiguous;
  the app was.
- **Book Position** — how far into the whole Book. Answers *"how far through?"*
- **Chapter Position** — which Chapter, and how far into that Chapter. Answers *"how far
  into this one?"*
- **Queue shape** — whether a Book's Queue is one item or one per Chapter. A property of
  the **Queue**, not of the Book: the same Book can differ between devices.

This follows the repo's own most-repeated rule, stated three times in `CONTEXT.md`'s keys
cluster: **name a key after the question it answers**. Position is that rule's third
instance, after the `activeBookId` collision and the Series identity-vs-display-order
merge.

Nothing about the heap gate enters the glossary. It answers a *cause* — "can this device
afford clipping?" — and causes are not what things are. It stays a private input.

### 6. Caching — `WeakMap`, verdict only

Memoize `queueShapeOf` on a `WeakMap` keyed by the **chapters array reference**. Never
memoize the translator: its inputs include `position`, which changes every tick, so a memo
there is a pure allocation leak.

Why the key works, and why there is no invalidation code to get wrong:

- The library store caches Book objects and has `isCachedBookCurrent` to skip
  re-conversion, so `book.chapters` is reference-stable.
- **`bookProgressValue` is a tri-state enum (0/1/2), not a fraction**
  (`seriesRowFacts.ts:8` warns about exactly that misreading), and
  `currentChapterProgress` is **not** in the observed column list
  (`store/library.tsx:281–291`). So per-tick progress writes do **not** re-convert the
  Book. The array reference changes only on rescan, a metadata/artwork edit, or a
  Started/Finished transition.
- A rescan yields a new array; the old entry is collected.

⚠ **The header must state why the cache is sound, because it depends on two facts outside
the module.** Both non-chapter inputs are process-constant: `CLIPPED_CHAPTERS_SPIKE` is a
compile-time constant, and `getHeapLimitBytes()` reads native once and caches
(`deviceHeap.ts:12`). **If either ever becomes runtime-variable, this memo silently serves
stale verdicts with no symptom.**

Measured cost without the memo, for context: a multi-file Book exits `.every()` on the
first differing URL (~O(1)); a single-file Book costs up to four full passes over the
chapters array. No bridge traffic either way.

### 7. Enforcement — none, deliberately

**No lint rule.** The driver is the sole developer and stage 2 follows stage 1
immediately, so the window in which a tenth mechanism could appear is hours.

Recorded for whoever revisits this: a narrow `no-restricted-syntax` ban on
`queue.length === 1` was considered and rejected on those grounds — **not** because it
would not work. If this spec's stages are ever separated by weeks, reconsider it.

- It must match the identifier `queue`, **not** `.length === 1` generally — there are six
  legitimate `.length === 1` uses in `src/` (`settingsQueries`, `seriesPickerRows` ×2,
  `gradientColorSorter`, and a `scanLibrary` comment).
- `no-restricted-syntax` is a different rule name from `no-restricted-imports`, so it does
  **not** trigger the override trap documented at `eslint.config.js:125–130`, where a later
  block replaces an earlier one outright and must restate `paths` or the RNTP ban silently
  switches off across almost all of `src/`.
- **An allow-list on `getQueue` was rejected outright.** ADR 0003 records that the existing
  rule "reached its final form (**no allow list**) in ticket 10" — allow-lists rot. And
  `getQueue` is innocent: it has four honest consumers asking three honest questions
  (*is anything loaded?* `service.ts:547`, `restoreLastActiveBook:48`; *am I at the last
  item?* `resolveNextPress:188`; *what is in it?* `relativeSeek:144`). Only the `=== 1`
  form is the mechanism.

### 8. Footprints — `db/` stops deciding

`db/footprintQueries.ts` carries a rule-shaped comment the brief inherited:
*"NOTHING under `db/` may decide what Position is measured against."*

The landing site already exists. `addFootprint(bookId, chapterIndex, positionInChapterMs,
trigger)` is the private primitive both derivation paths call (lines 118, 179) and is
already pure persistence.

- **Promote `addFootprint`.** `db/footprintQueries.ts` exports it plus its query
  functions, and imports nothing from `@/player`.
- **Derivation moves up to `helpers/activeBookFootprints.ts`** — the module that already
  owns the Active Book on behalf of all seven calling surfaces, per its own header.
- **The rule-shaped comment is DELETED, not reworded.** A comment describing a violation
  has no correct rewrite once the violation is gone.

Rejected: pushing Chapter Position out to the seven calling surfaces. Six of them do not
have one and would each acquire Player reads — re-scattering the read cluster this spec
absorbs.

⚠ **Two live bugs are fixed for free here, and they are opposite:**

- `getCurrentChapterInfo:54` — `if (trackIndex == null) return null`, checked **before**
  the shape branch, so a one-item Book (where the index is always 0 and irrelevant)
  refuses to answer. **Over-strict.**
- `recordSeekFootprint:174` — `chapterIndex = trackIndex ?? 0` on the chapter-queue path,
  where the index is the *only* source of truth. An unreadable index silently records a
  footprint at chapter 0. **Under-strict, and the destructive direction.**

Each guards the case the other needs. Decision 3's contract fixes both.

⚠ Also drop `footprintQueries`' `.sort((a, b) => a.startMs - b.startMs)` (lines 70, 151).
`bookEndDetection` warns that `startMs` is `0` on every row of a multi-file Book, so
sorting by it is a no-op on the shape where order matters most. **Array position is the
ordering** — both queue builders map in order and neither filters nor sorts. Reading the
store's Book instead of re-fetching removes the sort and lands on the memo's stable array
reference at the same time.

## Testing decisions

Jest runs two projects. Pure TypeScript goes in the `helpers` lane; anything importing
React Native must be named `*.rn.test.tsx`. **Read
`docs/testing/jest-projects-and-rn-tests.md` before writing any component or hook test.**

`src/helpers/__tests__/support/fakePlayer.ts` is the existing harness for queue-position
work and simulates the native `seekTo` clamp.

### Stage 1 — green tests alone, no device pass

- `tsc` 0, eslint 0, full suite green.
- A grep proving zero surviving mechanisms from the table in `## Problem statement`.
- New unit tests pinning `queueShapeOf` across **all four authoring shapes**, including
  shape D — asserting what it *currently* answers, so stage 2 cannot move it silently.
- `fakePlayer` coverage of the one behavioural delta: `seekTo(0)` vs `skip(0)` at book end
  on a one-item queue (`service.ts:608`, which is unguarded by `chapters.length > 1`).

**Stage 1 has exactly one behavioural delta.** The one-chapter flip above. `PlayerProgressBar`'s
predicate change is **inert on every Book that works today**: checked against all four
shapes, old and new agree on A, B and C, and diverge only on D — which is already broken
in the queue builder for a bigger reason.

### Stage 2 — device pass required

Real corpus subjects, confirmed present:

| Book | Shape | Covers |
| ---- | ----- | ------ |
| multi-file, one chapter per file | A → multi-item | the chapter-queue path |
| single-file **with** chapters | B → **either** | the contested case |
| single-file, **no** chapters | C → one-item | the one-chapter flip |

⚠ **"Single-file with chapters" is two runtime shapes and you cannot tell which from the
outside.** `shouldUseClippedChapters` needs *all* of: non-auto-generated chapters, at
least one non-zero `startMs`, and an estimated sample-table peak under half the device
heap. So a short single-file Book with real chapters is **clipped multi-item**, while the
same Book auto-chaptered, or a long one (the recorded OOM case was 28.7 h), is **legacy
one-item**. **Confirm which branch each test Book takes before the pass**, or all three
subjects may exercise the same path.

Two **ffmpeg-synthesised** subjects, for the cases the corpus cannot produce:

1. **A Book with one unusable `chapterDuration` mid-list** — the exact-or-null path. This
   is the case with real history: a `duration: 0` chapter once marked a 20-file Book
   Finished at chapter 5, and unit tests did not catch it. A synthesised subject exercises
   scan → DB → store → translator → render end-to-end, which no test lane reaches.
2. **A multi-file Book whose files each carry embedded chapters** — shape D. Turns "known
   unrepresented shape" from a hypothesis into characterised, documented behaviour.

Device observations, all UI-only (⚠ the preview build refuses `run-as`, so **no DB
inspection** — every `.scratch` DB recipe fails):

1. A synthesised Book with a bad chapter renders something sensible in the library row —
   not blank, not `NaN` — and is **not** marked Finished early.
2. The player screen's elapsed/remaining track correctly on a clipped single-file Book.
3. A footprint recorded during a chapter-queue Book lands on the right chapter after the
   decision-8 move.

⚠ **Stage 2 tests must NOT mock `helpers/activeBookFootprints`.** The existing convention
is to mock that helper rather than `@/db/footprintQueries` — but stage 2 moves the code
under test *into* it, so the existing mocks would swallow exactly what is being verified.

## Ticket breakdown

**Stage 1 — the verdict.** Call sites keep their own branching.

- `01` — `queueShapeOf` + the `WeakMap` memo + the `length > 0` correction; unit tests
  across all four shapes.
- `02` — the `hasValidChapterData` / `isSingleFileBook` threshold audit (decision 2).
- `03` — collapse all nine mechanisms onto the verdict; delete `usesChapterQueue`,
  `treatAsSingleFile`, `isSingleFileBook`, the `bookProgressUtils` inline copy,
  `PlayerProgressBar`'s `isChapterRelative`, the three `queue.length === 1` sites, and the
  dead `getChapterEndPosition`.
- `04` — `CONTEXT.md`: rewrite **Position**, add **Book Position**, **Chapter Position**,
  **Queue shape**.
- `05` — the ADR (see below).

**Stage 2 — the translator.**

- `06` — the translator: absorb `calculateAbsolutePosition`,
  `calculateProgressWithinChapter`, `resolveCurrentChapterIndex`,
  `findChapterIndexByPosition`; exact-or-null plus the named best-effort variant.
- `07` — migrate the ~13 consumers; none branches on shape afterwards.
- `08` — footprints: promote `addFootprint`, move derivation to `activeBookFootprints`,
  drop the `startMs` sort, delete the rule-shaped comment.
- `09` — device pass.

### The ADR (ticket `05`)

One ADR covering three rulings, which are one story — **the module answers in coordinates,
not in a verdict** — with the other two following from it:

1. The translator is the primary export; the verdict is demoted to three callers.
2. `'one-item' | 'multi-item'`, not `'absolute' | 'chapter-relative'`.
3. Exact-or-null, with a separately named best-effort variant.

It exists because a future reader **will** ask "why isn't there a `resolveQueueShape`
here, the review said there should be." Cite ADR 0003 for the Player-read ban rather than
restating it.

Deliberately **not** in the ADR: the Player-read ban (ADR 0003 decision 2 applied again),
the `length > 0` correction and flag removal (a bug fix — spec plus code comment), and the
memo (cheap to reverse, unsurprising).

Ruling 3 is the borderline one and is included **because** it reads as fussiness in six
months and would get "simplified" back to `?? 0`. That form has already caused one shipped
bug. It should be defended somewhere a refactor cannot delete.

## Out of scope

- **Fixing shape D.** `handleBookPlay:217` building one whole-file track per chapter row
  is a real defect with a real user impact, and it is not this spec's. This spec
  characterises it and refuses to encode it in the verdict — representing shape D would be
  encoding the bug. **File it separately.**
- **Removing `book.isSingleFile` from the DB.** The column stays; only playback stops
  reading it.
- **`relativeSeek`'s `readQueueShape()`.** It is misnamed — it returns
  `{ durations[], index, position }` and its walker is annotated *"correct for BOTH queue
  shapes"*. It resolves no shape and is the design this spec generalises **from**, not a
  mechanism to remove. Rename it if convenient; changing its behaviour is out of scope.
- **A lint rule.** See decision 7.

## Further notes

`resolveNextPress` (`chapterSkip.ts:166`) is the pattern to generalise from: it takes the
shape verdict as a **parameter** and refuses to derive it, with a header explaining why.
It sits one function below `skipToPreviousChapter`, which does the opposite at
`chapterSkip.ts:62`. Both are in the file the skip-next parity ticket held up as the
already-extracted target shape.

The four designs for this problem that coexist in the repo today, as a ladder — useful for
judging any future proposal:

1. **Re-derive inline** — `queue.length === 1` at the site.
2. **Shared predicate** — `usesChapterQueue` / `treatAsSingleFile`. Deduplicated, but every
   consumer still branches.
3. **Explicit parameter** — `evaluateBookEnd({queueShape})`, `resolveNextPress`. The
   decision is hoisted out; the branch still lives inside the helper.
4. **Shape-neutral representation** — `relativeSeek`'s reader. Correct for both shapes
   without branching. The question is dissolved, not answered.

The brief targeted rung 3. This spec targets rung 4 for the ~13 read consumers and rung 3
for the three that genuinely need a verdict.
