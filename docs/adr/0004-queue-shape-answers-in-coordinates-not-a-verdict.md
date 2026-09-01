# Queue shape answers in coordinates, not a verdict

**Status:** accepted (driver, 2026-08-31), from the grilling of
`.scratch/queue-shape/brief.md` on 2026-08-31 and scoped in
`.scratch/queue-shape/spec.md`, which is driver-approved in full. The tickets under
`.scratch/queue-shape/issues/` build it in two stages, the verdict first and the
translator second. **Stage 1 has begun** — ticket `01` landed `queueShapeOf` in
`src/helpers/queueShape.ts` on 2026-08-31, beside the nine mechanisms it will
replace. **The translator — ruling 1's primary export — is not built yet**
(ticket `07`), so this ADR rules on a design before the code exists, which is the
point: rulings 2 and 3 are constraints on what gets written.

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
the shape question hands each of its ~13 read consumers a fact they must then act
on;
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
rung 3 for all sixteen — the ~13 read consumers plus the three that keep the
verdict. It fixes the *duplication* — one predicate
instead of nine — and leaves the *branch* at every site, which is the part that
regenerates. It also cannot fix the two live footprint bugs that the coordinate
contract fixes for free (`getCurrentChapterInfo:54` refusing to answer on a
one-item Queue; `recordSeekFootprint:175` recording at chapter 0 for an unreadable
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
treats an unreadable index as "act", not as index 0; `service.ts:676` documents that
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

**That the module does no IO and never reads the Player is
[ADR 0003](0003-only-the-rntp-adapter-imports-rntp.md)'s decision 2, applied one
layer up.** It is cited, not re-argued, and not re-decided here. ADR 0003's `## Known incompleteness` leaves the queue-shape question
open on purpose — it rules only that the answer "belongs above the adapter, never
on it", and points at `.scratch/queue-shape/spec.md` rather than at any module.
This is that answer, and it honours the constraint by doing no IO at all.

## Where the rule lives

- **The verdict**: `src/helpers/queueShape.ts`, shipped by ticket `01`. Its three
  callers are named in the spec's `## Solution`; a fourth is the reopen condition
  below, not a routine addition.
- **The translator**: not yet written — ticket
  `.scratch/queue-shape/issues/07-add-position-translator.md`, which carries
  rulings 1 and 3 as acceptance criteria. **This ADR deliberately gives it no
  identifier.** Naming the primary export before it exists would put a name in the
  one place that cannot be refactored, and ADR 0003's own lesson is that a module
  should be named for the question it answers — which is ticket `07`'s call to
  make, once the signature is real. Ruling 3's contract is what the name has to
  live up to.
- **The nouns**: `CONTEXT.md` defines **Position**, **Book Position**, **Chapter
  Position** and **Queue shape** separately. The rulings are unreadable without
  them, and the glossary split is what made the missing noun visible.
- **The enforcement**: none, deliberately — see the spec's decision 7, which
  records the lint rule that was considered and the grounds for rejecting it.

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
- **Ruling 3 is wrong if the nulls do not survive the call sites.** The argument
  above is that severity differs per consumer; the observable test is whether the
  consumers actually behave differently. If, after tickets `08`–`09`'s migration, every
  site collapses `null` the same way, the fabricated zero has simply moved one
  layer out and two functions were bought for nothing — delete the variant and the
  ceremony with it.

Note what is **not** on this list: "the translator turned out to be more code than
a shared predicate." It is, by design.

## Addendum — the transport verdict (ticket `08`, 2026-08-31)

Ruling 1's reopen condition above says to count the callers before adding one and
not to add one quietly. Ticket `08` added one. This is that count, and the
argument for why ruling 1 survives it.

**A fourth audience exists, and it is not a reader: the TRANSPORT.**
`skipToPreviousChapter` and `pressNext` each hold the verdict, and each uses it
for exactly one thing — choosing between a seek inside a single track and a step
to another Queue item. That is the reopen condition's own test, *"they act on
shape rather than convert with it"*, answered in the affirmative.

It does **not** unseat the translator, and the distinction is worth being exact
about because it is the whole of why:

- Every consumer that asked *where am I* now asks the translator, and none of them
  branches. `chapterSkip.ts`'s two press decisions are the sharpest case: both
  compute where the playhead is with no verdict at all, and the verdict enters
  only at the last step, to pick a transport.
- No caller converts between Book Position and Chapter Position outside
  `bookLocation.ts`. That was the claim ruling 1 rests on, and it holds.
- The two shapes genuinely MOVE differently. No arithmetic dissolves that — unlike
  the coordinate question, which dissolved into one subtraction
  (`chapterStartInQueueSeconds`).

So the shape question really was merely the conversion **for readers**, and the
primary export is named right. What the original ruling got wrong is smaller: it
said "three callers" when it meant "three callers that are not simply choosing a
transport". Read it that way.

⚠ **`setup/service.ts`'s three verdict reads are a third category again**, and
they look like readers. They are not: what they select is not what a Position
means but WHICH SUBSYSTEM OWNS CHAPTER CHANGES — on a one-item Queue only the
progress tick can see a boundary cross, while a multi-item Queue gets one
`PlaybackActiveTrackChanged` per boundary and must not count it twice. Collapsing
them would make a chapter-mode sleep timer count every boundary twice. One of the
three is also `evaluateBookEnd`'s parameter, which ruling 1 already blesses.

**Still owed, and not evidence against ruling 1:** the verdict is read by
`footprintQueries`, `chapterPlayback`, `bookProgressUtils`, `chapterList` and
`footprintList`. Those are the persisted READ consumers, and tickets `09`–`11`
migrate them to the translator. Count again when `11` closes; if any survives as a
reader, ruling 1 is in trouble and this is where to say so.

**Ruling 3 was tested by the migration and held.** Its reopen condition is *"if,
after tickets `08`–`09`'s migration, every site collapses `null` the same way."*
They do not: the sleep-timer ceiling answers "not known", a previous press
restarts the Book, the progress tick declines to write, the pause/stop write
distinguishes which coordinate survived in order to tell an unreadable INDEX from
unreadable BOUNDARIES, and the player screen falls back to a whole-Book display.
Five sites, five different collapses.

## Closing count — ticket `11`, 2026-09-01

The addendum above said *"count again when `11` closes; if any survives as a reader,
ruling 1 is in trouble and this is where to say so."* This is that count, taken
after the old conversion pair was deleted. **No reader survives.**

`queueShapeOf` has nine production call sites, in three kinds, and not one of them
asks what a Position means:

| Caller | Kind | What the verdict picks |
| ------ | ---- | ---------------------- |
| `handleBookPlay.ts:177`, `restoreLastActiveBook.ts:54` | builder | how many Queue items to `add()` |
| `chapterSkip.ts:254`, `nextPress.ts:214`, `chapterJump.ts:70` | transport | a seek inside one track vs a step to another item |
| `service.ts:265`, `:607`, `:756` | ownership | which subsystem sees a chapter change |
| `bookLocation.ts:249` | the translator | the conversion itself |

Ruling 1 stands, and the reopen condition it was written against has now been
tested twice. The persisted readers the addendum still owed —
`footprintQueries`, `chapterPlayback`, `bookProgressUtils`, `chapterList`,
`footprintList` — are all on the translator; the first two no longer import
`queueShapeOf` at all, and `db/footprintQueries.ts` no longer imports the Player
either.

**What ticket `11` deleted**, which is what makes the earlier tickets permanent
rather than additive:

- `calculateAbsolutePosition` and `calculateProgressWithinChapter` — the inverse
  pair this ADR's context section is about. Their last three callers were the two
  queue BUILDERS, which is why `08`–`10` did not reach them: a builder does not
  ask where playback is, it places the playhead. Placing it is the same
  conversion, so they call `locateInBook` now too.
- `findChapterIndexByPosition` — absorbed into `bookLocation.ts` as an internal
  step of `chapterIndexAtPosition`, so the unguarded backwards walk can no longer
  be reached without the two refusals that wrap it.
- `resolveCurrentChapterIndex` — unreferenced since `08`.
- `helpers/singleFileBook.ts` itself. What survived it is one predicate,
  `hasValidChapterData`, now in `helpers/chapterMetadata.ts` — named for what it
  answers rather than for one of the two shapes it was written beside.

**Ruling 3 recount.** The reopen condition is *"if every site collapses `null` the
same way"*. **Eight sites, and they still do not**: the five listed in the
addendum, plus `09`'s whole-Book-duration fallback in the library row and the
remaining-time label, `10`'s record-no-footprint, and now `11`'s decline-to-seek
in `restoreLastActiveBook`.

⚠ Count that last one ONCE, not twice. `handleBookPlay` guards the same way, but
its guard is UNREACHABLE — it clamps the stored index into range before calling,
and a Book with no chapters cannot reach the one-item arm at all — so it is
defensive code, not a live collapse. Counting both would inflate the very number
this recount exists to keep honest.

The live one is still the newest KIND: a `null` that changes where playback
STARTS rather than what is displayed. It is why the clamp stayed at
`restoreLastActiveBook`'s call site instead of moving into the translator — the
track's label and the seek must agree about which chapter this is, and only the
caller knows that — and why its refusal reports to Sentry under its own message
rather than folding into the pre-existing out-of-bounds one. A reading that is
MISSING and a reading that is WRONG are different failures.

**⚠ A NINTH CONVERSION WAS FOUND DURING THIS TICKET'S REVIEW, and it is recorded
here because the wrong argument for keeping it was persuasive.**
`resolvePreviousPress`'s one-item arm computed the previous chapter's seek target
as a hand-rolled `chapters[index - 1].startMs / 1000`. It was first defended — in
an earlier draft of this very section — as *"not a conversion, because both sides
are the same coordinate on this shape"*. That is false: the INPUT is a chapter
index and only the OUTPUT is a Position, which is exactly what
`calculateAbsolutePosition(chapters, i, 0)` did. It calls `locateInBook` now.

The defence is worth naming because it is the disease's own reasoning — *"correct
only because every call site branches before calling them"* — restated as a
justification. **On a one-item Queue the two coordinates coincide, so ANY
conversion there looks like an identity.** That is the shape on which a
hand-rolled conversion is hardest to see and easiest to excuse, and it is where
to look first if a tenth ever appears.

`nextBoundaryAfter` in the same file was checked under the same suspicion and is
genuinely same-coordinate: a Position in, the next boundary's Position out, no
index at either end. It stays. If a site ever needs an arbitrary chapter's start
in QUEUE rather than Book coordinates, the move is a
`chapterStartInQueueSeconds`-shaped export, not a hand-rolled division by 1000.
