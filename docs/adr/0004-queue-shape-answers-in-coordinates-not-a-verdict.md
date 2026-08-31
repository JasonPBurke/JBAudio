# Queue shape answers in coordinates, not a verdict

**Status:** accepted (driver, 2026-08-31), from the grilling of
`.scratch/queue-shape/brief.md` on 2026-08-31 and scoped in
`.scratch/queue-shape/spec.md`, which is driver-approved in full. **Not yet
implemented** — the tickets under `.scratch/queue-shape/issues/` build it in two
stages, the verdict first and the translator second.

The module that owns Queue shape exports a **position translator** as its primary
function. The shape verdict — `queueShapeOf(chapters)` — is a secondary export with
three callers.

The part that will look wrong later, and the reason this document exists: **the
architecture review said this module's primary export should be
`resolveQueueShape(): 'absolute' | 'chapter-relative'`, and it isn't.** Neither
the name, nor the primacy, nor the two words survived scoping. All three were
rejected on evidence, not taste, and they were rejected as one decision.

## What was actually wrong

The brief counted five mechanisms answering "what is Position measured against?"
across four sites. Re-measuring during scoping found **nine, in six variants**,
two of them on no list anywhere: `bookProgressUtils.ts:66`'s inline
`book.isSingleFile && !shouldUseClippedChapters(...)`, and
`PlayerProgressBar.tsx:82`'s `isChapterRelative`. The full census is in the spec's
`## Problem statement`.

Deduplication is the obvious reading of nine mechanisms, and it is the wrong one.
Two of the nine (`usesChapterQueue`, `treatAsSingleFile`) already *are* the
deduplicated form — shared predicates, composed from the others — and they did not
stop the count from growing. Something kept regenerating the branch.

What kept regenerating it is in `helpers/singleFileBook.ts`, which already contains
the translator as an unguarded inverse pair:

```ts
calculateAbsolutePosition(chapters, idx, progress)   // Chapter Position → Book Position
calculateProgressWithinChapter(chapters, position)   // Book Position → Chapter Position
```

Neither consults the Queue shape. Both hardcode the one-item mapping, and both are
correct **only because every call site branches before calling them**. That is the
mechanism of the disease: when the conversion silently assumes one shape, the
decision cannot live in the conversion, so it lives at the call sites and
multiplies with them. `singleFileBook.ts` is the translator wearing a special
case's name.

`CONTEXT.md` had the matching gap: **one word, Position, for three quantities**, with
a `⚠` admitting that what it was measured against depended on how the Queue was
built. Nine mechanisms is what a missing noun looks like in code. Every site that
needed one of the two derived quantities had to re-derive it, and had no word to
name which one it meant.

## The decision

1. **The translator is the primary export; the verdict is demoted to three
   callers** — the two queue builders (`handleBookPlay`, `restoreLastActiveBook`)
   and `evaluateBookEnd`.
2. **The verdict's vocabulary is `'one-item' | 'multi-item'`**, not
   `'absolute' | 'chapter-relative'`.
3. **The translator is exact-or-null**, with a separately named best-effort
   variant for callers that want an approximation.

They are one decision read three ways. Once the module answers in coordinates, the
verdict has almost no audience, and the audience it keeps is builders — which
settles the vocabulary. And a translator that is the single source of a number
consumed by both a library row and book-end detection cannot pick one error policy
for both — which settles the contract.

## 1 — Why the translator is primary

Every consumer is asking for one of two coordinates: **Book Position** ("how far
through?") or **Chapter Position** ("which Chapter, and how far into it?"). The
shape question is nothing but the conversion between them. A module that answers
the shape question hands each of its ~13 consumers a fact they must then act on;
a module that answers in coordinates hands them the thing they wanted, and
**no consumer branches on shape again**.

The spec frames the four designs already coexisting in this repo as a ladder:
re-derive inline; shared predicate; explicit parameter; shape-neutral
representation. `relativeSeek`'s reader is the only rung-4 code here, and its
walker is annotated *"correct for BOTH queue shapes"* — the question dissolved
rather than answered. The review targeted rung 3. This targets rung 4 for the
consumers that only need a number, and keeps rung 3 for the three that genuinely
need a verdict.

**The trade-off:** two exports where the review wanted one, and a primary export
whose name never says the words "queue shape" — so a reader grepping for the
concept lands on the secondary function. Accepted, because the alternative puts
the popular name on the unpopular export.

**Rejected: the verdict as the sole export, with the conversion staying at the
call sites.** This is the review's design and the brief's central sketch. It is
rung 3 for all sixteen consumers. It fixes the *duplication* — one predicate
instead of nine — and leaves the *branch* at every site, which is the part that
regenerates. It also cannot fix the two live footprint bugs that the coordinate
contract fixes for free (`getCurrentChapterInfo:54` refusing to answer for a
one-item Book; `recordSeekFootprint:174` recording at chapter 0 for an unreadable
index — see the spec's decision 8), because both are errors in *how a site
branches*, and a shared predicate leaves each site branching.

## 2 — Why `'one-item' | 'multi-item'`

Reused verbatim from `bookEndDetection.ts:43`, which already ships these two
strings, device-verified on both shapes, with a documented fail-closed rule
(anything not exactly `'one-item'` is treated as multi-item). Reusing them means
`evaluateBookEnd` — one of the three verdict callers — needs no translation layer
at its boundary.

The deciding argument is who is left reading the verdict. Two of the three callers
are **builders**: they ask in order to construct a Queue, before any Queue exists.
For a builder deciding how many tracks to create, "one item or many?" is the
question it is actually asking. "Absolute or chapter-relative?" is a non-sequitur
at that site — a statement about a coordinate system, addressed to code that is not
yet reading any position.

**The trade-off:** the two words describe the Queue's structure, so they say
nothing about coordinates, and a reader who wants to know what Position means still
has to know the mapping. That is the correct silence: `CONTEXT.md` now defines
**Queue shape** as a property of the Queue, not of the Book, and coordinates are
what the translator returns.

**Rejected: `'absolute' | 'chapter-relative'`.** It is the better pair of words for
the *consumers* — and after ruling 1 there are no consumers, only builders and
book-end detection. It would also have introduced a second vocabulary for a
distinction `bookEndDetection` already names, so every future reader would have to
learn that the two pairs are the same pair.

## 3 — Why exact-or-null, and why `?? 0` is not a simplification

The translator returns both coordinates, each independently nullable, and `null`
for the whole record when there is no Book or no chapters. **`null` means "I could
not tell", never "the answer is zero".** This is a house rule stated four times
already — `remainingChapterCount()` returns `null` for not-known; `evaluateBookEnd()`
returns `'none'` rather than `'clear'` for an undecidable tick; `resolveNextPress()`
treats an unreadable index as "act", not as index 0; `service.ts:677` documents that
fabricating `0` for an unreadable index "would corrupt chapter index". It is being
extended here, not invented.

The coordinates are nullable **independently** because they have opposite
reliability and it flips with the shape:

| | multi-item | one-item |
| - | ---------- | -------- |
| Chapter Position | **exact and free** — the queue index *is* it | derived by scanning `startMs` |
| Book Position | derived by summing `chapterDuration` — **corruptible** | **exact and free** — the raw position |

So on the common shape, the coordinate the translator must manufacture is the
corruptible one. The corruption is not hypothetical: `scanLibrary.ts:532`'s
`makeErrorChapter` stores `duration: 0` for a file whose metadata extraction
failed, and the single-chapter path falls back to `0` whenever the duration tag is
missing.

**This is the ruling most likely to read as fussiness in six months**, and the one
most likely to be "simplified" to a zero default. It is recorded here because that
form has already shipped a bug: a chapter with a zero duration emptied a
remaining-time sum and marked a **twenty-file Book Finished at chapter five**.
Recovery cost the user their position — nothing moves a Book off Finished except a
play press, and that restarts from 0:00.

The argument that must outlive any refactor: **the same arithmetic error has
different severity per consumer, and severity is a property of what the caller does
with the number — which the translator cannot see.** In `bookProgressUtils`, an
undercount reads the progress capsule a little low: cosmetic. In `evaluateBookEnd`,
the identical undercount is destructive. `bookEndDetection.ts`'s `measureQueue`
already voids its whole measurement rather than count such a row as zero, with a
full rationale in its header — the right policy there and the wrong one for a
library row. Hence two functions and no default, rather than one function with a
policy.

Today's `bookProgressUtils.ts:77` writes `chapters[i]?.chapterDuration ?? 0`, and
nothing about that line says it belongs to the family that once marked a 20-file
Book Finished at chapter 5. The named best-effort variant is how that line says so.

**The trade-off:** every consumer of Book Position now handles a `null`, including
the ones for which the honest approximation is fine, and the module has two
functions where a default would need one.

**Rejected: one function returning `?? 0`.** It is smaller, and it is how the
shipped bug was written. **Rejected: one function plus an options flag**
(`{ approximate: true }`). Same information, but a flag at a call site is easy to
copy without reading, and a default value means the destructive caller gets the
cosmetic policy by omission. The approximation must be **asked for by a name that
admits what it is.**

## Not decided here

**The module does no IO and never reads the Player.** That is
[ADR 0003](0003-only-the-rntp-adapter-imports-rntp.md)'s decision 2 — the IO half
must not decide, and the deciding half must not do IO — applied one layer up, not a
new ruling. ADR 0003's `## Known incompleteness` names this module as the answer
to the queue-shape question it deliberately left open; this is that answer.

## When this is wrong

Three conditions, each of which should reopen exactly one ruling:

- **Ruling 1 is wrong if the verdict's audience grows.** Three callers is what makes
  demotion right. If a fourth and fifth consumer legitimately need the verdict rather
  than a coordinate — meaning they act on shape rather than convert with it — then
  the shape question was not merely the conversion, and the primary export is
  wearing the wrong name. Count the callers before adding one; do not add one
  quietly.
- **Ruling 2 is wrong if a third Queue shape becomes representable.** Shape D —
  a multi-file Book whose files each carry embedded chapters — is currently broken
  in the queue builder (`handleBookPlay.ts:217` builds one whole-file track per
  chapter row) and is deliberately unrepresented, because representing it would be
  encoding the bug. When that defect is fixed, a two-word union stops being a
  complete description. The fail-closed rule keeps it *safe*; it does not keep it
  *honest*.
- **Ruling 3 is wrong if the nulls do not survive the call sites.** The contract
  buys nothing if consumers write `?? 0` immediately on receipt — that only moves
  the fabricated zero one layer out and pays two functions for it. The test is
  whether the destructive consumers act on `null` differently from the cosmetic
  ones. If, after migration, every site collapses `null` the same way, delete the
  variant and the ceremony with it.

Note what is **not** on this list: "the translator turned out to be more code than
a shared predicate." It is, by design.
