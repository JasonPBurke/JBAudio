# 11 — Remove the old conversion pair

**Spec:** `.scratch/queue-shape/spec.md` — `### Why there are nine`.

**What to build:** The contract half of stage 2. With every consumer on the translator, the
old conversion functions are deleted and the app is left with one place that converts
between Book Position and Chapter Position.

The two functions being removed are exact inverses of each other and have been the
translator all along — unguarded, assuming the one-item mapping, correct only because their
callers branched first. The module they live in is named after one of the two shapes, which
is how a general-purpose conversion pair came to look like a special case's helper. Deleting
them is what makes the earlier tickets permanent rather than additive.

Also absorbed and removed: the chapter-index resolver and the position-to-chapter scan,
both of which are now internal steps of the translator rather than exports anyone reaches
for.

**Blocked by:** 08, 09, 10

**Status:** resolved

- [x] The two conversion functions are deleted, not merely unexported
- [x] The chapter-index resolver and the position-to-chapter scan are no longer public
- [x] A grep over non-test sources proves nothing converts between the two coordinates
      outside the translator, and the grep is recorded on this ticket
- [x] Any module left holding only a special case's name is either renamed for what it
      actually does or emptied
- [x] `tsc` 0, eslint 0, full suite green

## Answer

Commit: see branch `queue-shape-single-module`.

### What was deleted

| Gone | Where it went |
| ---- | ------------- |
| `calculateAbsolutePosition` | `locateInBook(chapters, { from: 'chapter', … })?.bookPositionSeconds` |
| `calculateProgressWithinChapter` | already unreferenced — `locateInBook`'s `.chapter.positionSeconds` had replaced it in `08`/`09` |
| `findChapterIndexByPosition` | absorbed into `bookLocation.ts`'s private `chapterIndexAtPosition` |
| `resolveCurrentChapterIndex` (+ its 6 tests) | unreferenced since `08`; callers ask `locateInBook` |
| `helpers/singleFileBook.ts` | → `helpers/chapterMetadata.ts`, holding only `hasValidChapterData` |

### ⚠ The three callers `08`–`10` did not reach, and why

`calculateAbsolutePosition` still had three live call sites when this ticket opened:
`restoreLastActiveBook.ts:84` and `handleBookPlay.ts:209` / `:253`. All three are QUEUE
BUILDERS, which is why the consumer-migration tickets passed over them — a builder does
not ask *where is playback*, it PLACES the playhead. But placing it on a one-item Queue
means turning the DB's stored Chapter Position into the Book Position the Player wants,
which is the same conversion under a different verb. They call the translator now.

In `handleBookPlay` the conversion is hoisted to ONE `resumeBookPosition` beside the
verdict, consumed by both arms (change-book and same-book). The two sites were byte-identical.

### ⚠ BEHAVIOURAL DELTAS — a stale chapter index on restore

`calculateAbsolutePosition` CLAMPED an out-of-range index (`Math.min(idx, length - 1)`);
`locateInBook` refuses it, per `07`'s recorded migration delta.

- `handleBookPlay` is **zero-delta**: it already clamps into `[0, length-1]` at
  `storedChapterIndex` before either call, so the translator can only decline on an
  empty chapter list, which cannot reach the one-item arm at all (`queueShapeOf` answers
  `'multi-item'` for zero chapters).
- `restoreLastActiveBook` **would have** regressed — its raw `progressInfo.chapterIndex`
  reached the conversion unclamped. The clamp was kept AT THE CALL SITE, reusing the
  `validChapterIndex` the one-item track is already LABELLED with, rather than being
  pushed back into the translator. The label and the seek must name the same chapter,
  and only the caller knows that. Its existing out-of-bounds Sentry path now also covers
  `null` — under its OWN Sentry message, not folded into the out-of-bounds one,
  because a reading that is MISSING and a reading that is WRONG are different
  failures — and seeks `0` instead of clamping a number it does not have.

**A second, narrower delta**, found by the spec review and worth recording since
this section once claimed to hold only one: `restoreLastActiveBook`'s
`progressInfo?.chapterIndex || 0` preserves a NEGATIVE stored index (`-1 || 0`
is `-1`), and `Math.min(-1, length - 1)` leaves it negative, so `usableIndex`
refuses it. The old `calculateAbsolutePosition` returned the bare
`progressSeconds` for a negative index — i.e. it silently treated the Book's
start as the chapter's. The new behaviour reports it and opens at `0:00`.
An improvement, but a change.

### The grep, as the ticket requires

```
$ grep -rn 'calculateAbsolutePosition\|calculateProgressWithinChapter\|findChapterIndexByPosition\|resolveCurrentChapterIndex' src/ --include=*.ts --include=*.tsx --include=*.js
src/helpers/chapterPlayback.ts:8:  * … because it held `resolveCurrentChapterIndex`
src/helpers/bookLocation.ts:13:  * It replaced an unguarded inverse pair …
src/helpers/bookLocation.ts:14:  * (`calculateAbsolutePosition` / `calculateProgressWithinChapter`) …
src/helpers/bookLocation.ts:157: * (`findChapterIndexByPosition`), which is how it came to be called from
src/helpers/__tests__/handleBookPlay.test.ts:89: * … instead of through `calculateAbsolutePosition`.
```

Five hits, all PROSE in comments explaining what is gone. No call, no import, no
declaration. `singleFileBook` likewise survives only in comments and as an unrelated
local `const singleFileBook` fixture in `clippedChapters.test.ts`.

The stronger grep — every non-test read of `startMs`, since a conversion has to touch a
chapter's start to happen at all — leaves exactly **three** sites outside `bookLocation.ts`
that do arithmetic with one:

| Site | Verdict |
| ---- | ------- |
| `store/library.tsx:61`, `db/bookQueries.ts:61` | SORT keys, not arithmetic on a position |
| `clippedChapters.ts:130` | builds the clip WINDOW; ms in, ms out, no position involved |
| `chapterSkip.ts` `nextBoundaryAfter` | reviewed and kept: a Position in, the next boundary's Position out, no index at either end. Genuinely one coordinate. |

⚠ **A NINTH CONVERSION, and this ticket got it wrong the first time.**
`resolvePreviousPress`'s one-item arm computed the previous chapter's seek target as
`chapters[index - 1].startMs / 1000`. The first draft of this Answer defended it as
"not a conversion — both sides are the same coordinate on this shape". **That is
false**, and the spec-axis review caught it: the INPUT is a chapter index and only
the OUTPUT is a Position, which is precisely what `calculateAbsolutePosition(chapters,
i, 0)` did. It calls `locateInBook` now, and the grep above is clean of it.

Worth carrying forward, because the bad defence was persuasive: **on a one-item Queue
the two coordinates coincide, so ANY conversion there looks like an identity.** That
is the shape where a hand-rolled conversion is hardest to see — and "it's the same
coordinate here" is the disease's own reasoning (*"correct only because every call
site branches before calling them"*) wearing a justification's clothes. ADR 0004's
closing count records it as the place to look first if a tenth appears.

### `chapterPlayback.ts` was NOT renamed

It is down to one function (`calculateRemainingBookTime`), but `chapterPlayback` is not a
special case's NAME — the checkbox is about `singleFileBook`, a module named after one of
the two shapes. Its header, which existed to explain what a Chapter index means under each
shape, is gone: the file no longer imports `queueShapeOf`.

### ADR 0004

Gained a `## Closing count` section. The addendum's outstanding obligation — *"count again
when `11` closes"* — is discharged: **`queueShapeOf` has no readers left**, only two
builders, three transports, three ownership reads in `service.ts`, and the translator
itself. Ruling 3 recounted at eight distinct `null` collapses, up from five.
`service.ts:246`'s "three callers" comment was stale and is corrected.

### Review findings applied

The two-axis review (Standards + Spec) ran before commit. Applied:

- **the ninth conversion** above (spec axis) — the substantive one;
- `absolutePosition` → `resumeBookPosition` in `restoreLastActiveBook`, and the
  breadcrumb `'Single-file position restored'` → `'One-item queue position restored'`.
  CONTEXT.md's **Book Position** entry lists "absolute position" under _Avoid_ and
  **Queue shape** lists "single-file"; the sibling builder had already been written the
  right way, so the two disagreed about the noun for one quantity;
- the unmeasurable and out-of-bounds branches split, per above;
- a stale ADR filename in `bookLocation.ts`'s header (`…-in-coordinates.md`, missing
  `-not-a-verdict`);
- `chapterMetadata.test.ts` — five cases. The predicate had NO direct test before:
  its module's old suite tested only the press-target calculator `08` deleted;
- ADR line references corrected (three were off by two) and the ruling-3 recount
  de-inflated: `handleBookPlay`'s decline-to-seek is unreachable defensive code, so
  the eight collapses count `restoreLastActiveBook`'s once, not both.

Declined, with reasons:

- **extract a shared `buildOneItemTrack` from the two queue builders** (standards axis,
  Duplicated Code). Real and pre-existing — the two builders have duplicated their
  one-item arm since long before this effort, and this ticket makes them *look* more
  alike only by pointing both at the same translator. Merging two queue builders is not
  a deletion ticket's work and would put an untested `restoreLastActiveBook` behind a
  shared abstraction. Same for the two differently-named stale-index clamps.
- **rename `hasValidChapterData` → `hasChapterBoundaries`.** The checkbox asks that a
  module left holding a special case's NAME be renamed; the module was. The function's
  name is referenced across `clippedChapters.ts`'s load-bearing-together argument and
  several docs, and churning it here buys nothing this ticket asked for.

### Tests

Two characterisation tests added to `handleBookPlay.test.ts` FIRST, pinning the one-item
resume through both arms with NON-ZERO chapter starts — the suite's existing one-item Book
has a single chapter starting at `0`, so its two coordinates coincide and the conversion
was invisible to it. Green before the change, green after.

`chapterMetadata.test.ts` is new — see above.

`tsc` 0 errors, eslint 0 errors, full suite green on a CLEARED jest cache (the warm-cache
trap in `docs/testing/jest-projects-and-rn-tests.md`), both lanes running.
