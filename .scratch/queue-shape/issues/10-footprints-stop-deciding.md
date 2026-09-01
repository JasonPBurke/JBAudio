# 10 — Footprints stop deciding

**Spec:** `.scratch/queue-shape/spec.md` — decision 8.

**What to build:** Footprint recording stops working out what Position is measured against
from inside the persistence layer.

The persistence module currently asks the Player where it is, fetches the Book's chapters,
decides the Queue shape and branches — and carries a rule-shaped comment saying so:
*nothing under `db/` may decide what Position is measured against*. The adapter work left
that comment standing deliberately, because fixing it properly needed this module to exist.

The landing site already exists. The primitive that takes a Chapter Position and writes it
is already pure persistence; everything above it in that file is derivation that wandered
downstairs. Promote the primitive, and move the derivation up into the helper that already
owns the Active Book on behalf of all seven calling surfaces.

⚠ **The rule-shaped comment is DELETED, not reworded.** A comment describing a violation has
no correct rewrite once the violation is gone.

⚠ **Two live bugs are fixed here, and they are opposite.** Sibling functions each guard the
case the other one needs: one refuses to answer when the Queue index is unreadable *even
though the index is irrelevant for that shape*, and the other fabricates index zero *on the
shape where the index is the only source of truth* — silently recording a footprint at the
wrong chapter. The translator's contract fixes both; confirm both, don't assume.

Also drop the sort by chapter start offset. That offset is zero on every row of a multi-file
Book, so sorting by it is a no-op on the shape where order matters most. **Array position is
the ordering** — both queue builders map in order and neither filters nor sorts. Reading the
store's Book instead of re-fetching removes the sort and lands on the memo's stable array
reference at the same time.

⚠ **Do not mock the Active-Book footprint helper in this ticket's tests.** The existing
convention is to mock that helper rather than the persistence module — but this ticket moves
the code under test *into* it, so the usual mock would swallow exactly what is being
verified.

**Blocked by:** 07

**Status:** resolved

- [x] Nothing under `db/` imports the player adapter
- [x] The Chapter Position primitive is promoted; derivation lives in the Active-Book helper
- [x] The rule-shaped comment is deleted
- [x] An unreadable Queue index no longer records a footprint at chapter zero, and a
      one-item Book no longer refuses to record because of an index it does not need — both
      confirmed by test
- [x] The sort by chapter start offset is gone; ordering comes from array position
- [x] Tests do not mock the Active-Book footprint helper; the reason is noted where the mock
      used to be
- [x] `tsc` 0, eslint 0, full suite green

## Answer

`db/footprintQueries.ts` is now persistence and nothing else: **102 lines, four exports, no
Player import, no `queueShapeOf`, no branch.** `tsc` 0, eslint 0 errors, full suite green —
**97 suites / 1238 tests**, both projects.

### What moved

`getCurrentChapterInfo`, `recordFootprint` and `recordSeekFootprint` were derivation living
downstairs: they asked the Player where it was, fetched the Book's chapters, decided the Queue
shape and branched. All three are gone from `db/`. What is left is `addFootprint`, promoted to
the module's face and **taking a `ChapterPosition`** rather than two loose primitives — the
same correction `09` made to `resolveChapterJump`, and for the same reason (every caller
already holds the pair, and `positionMs`/`chapterIndex` side by side is the Data Clump the
type exists to name). Seconds in, milliseconds stored: the one unit conversion happens at the
write, so no caller can forget it.

The derivation landed in `helpers/activeBookFootprints.ts` as one private function,
`recordAtPlayerLocation(bookId, trigger, queueIndex, positionSeconds)`, which asks
`locateInBook` and **branches on nothing**. `recordFootprint` (the three surfaces that already
hold the Book) and `recordActiveBookSeekFootprint` (every Active-Book seek) are its only two
callers.

The rule-shaped comment is **deleted**, not reworded. `addFootprint`'s new header states its
own contract — it is told where the breadcrumb goes — and points at the module that resolves
it; it does not restate a violation that no longer exists.

### The two opposite bugs — both confirmed, neither assumed

| | Old code | Now |
| --- | --- | --- |
| **One-item Queue, unreadable index** | `getCurrentChapterInfo` returned `null` at `if (trackIndex == null)` — *before* it knew the shape. The index is not read at all on this shape (it can only ever be `0`), so a perfectly derivable breadcrumb was dropped. | Recorded, chapter scanned from the Position. |
| **Multi-item Queue, unreadable index** | `recordSeekFootprint` did `chapterIndex = trackIndex ?? 0` — on the one shape where the index *is* the Chapter. A footprint was silently filed under chapter one. | Nothing recorded. |

Both are pinned, and both were **mutation-checked**: re-inserting `if (queueIndex == null)
return` fails the one-item case and nothing else; re-inserting `queueIndex ?? 0` fails the two
multi-item cases and nothing else. Neither test passes for the other's reason.

⚠ **A precision the spec-axis review was right to insist on**: the `?? 0` bug lived only in
`recordSeekFootprint`, so of the two multi-item cases only the seek one is a REGRESSION pin.
The `recordFootprint` one pins the new contract — under the old code that path returned `null`
at the index guard and also wrote nothing, for the opposite reason. Both are worth keeping;
only one of them is a bug that shipped.

### The sort

Gone, with the re-fetch it belonged to. `recordFootprintAt` reads
`useLibraryStore.getState().books[bookId]?.chapters`, which is:

- **ordered by array position**, the ordering both queue builders actually produce (each maps
  in order and neither filters nor sorts) — the deleted `.sort((a, b) => a.startMs - b.startMs)`
  was a no-op on every multi-file Book, where every row's offset is `0`;
- the **memoised array reference** `queueShapeOf`'s `WeakMap` is keyed on, so the shape verdict
  is a map lookup instead of a re-derivation per footprint;
- **free** — it replaces a `database.get('books').find()` plus a relation fetch on every play,
  seek and chapter press.

⚠ **The spec-axis review is right that this RELOCATED the sort rather than eliminating it.**
`store/library.tsx:60` still sorts by `startMs` inside `convertBookModelToBook`, so the array
this reads is sorted — the ordering is unchanged and nothing here depends on the change. What
is gone is the *second, private* copy of that sort, the one that ran per footprint on a
freshly fetched array and made this file's answer independently deniable. Ordering now comes
from array position at this site because the array arrives already being the order every other
consumer sees. Collapsing the store's own sort is a different question and a different ticket;
it is the one place that establishes the order for the whole app.

### Behavioural deltas

1. **A Book absent from the library store records no footprint** (was: a fresh DB fetch). The
   store holds the whole library after `init()`; the window is cold start, the same one
   `remotePlayBook` covers with a restoration fetch. Established pattern — `chapterSkip` and
   `remainingChapterCount` already read chapters this way and neither falls back.
2. The two bug fixes above.
3. **Two new refusals inherited from `locateInBook`, both honest.** On a one-item Queue whose
   Position precedes every boundary (a Book with a preamble), and on one whose rows all sit at
   `startMs: 0` (no boundaries at all, so the backwards scan would confidently answer the LAST
   row), no footprint is written where chapter `0` used to be. `null` means "I could not tell".
4. **`recordSeekFootprint` no longer exists as a name.** `PlayerProgressBar`'s scrub handler
   was a verbatim copy of `recordActiveBookSeekFootprint` — same two parallel reads, same
   guard, same swallow, same `* 1000` — so it now calls that. Not scope creep: the ticket
   requires the derivation to leave `db/`, and once it has, the copy and the original are one
   function. It also removes the last `db/footprintQueries` import from a component.
5. `recordActiveBookSeekFootprint` reads the Queue index in the **same `Promise.all`**, so the
   breadcrumb still costs one round trip in front of the seek, not two.
6. **An index past the last chapter now records nothing.** `locateInBook`'s `usableIndex`
   demands `index < chapters.length`; the deleted multi-file arm had no bounds check and would
   file a breadcrumb under a chapter that does not exist. Found by the spec-axis review, which
   noted it was tested but undeclared.
7. **`recordFootprint` no longer swallows a Player-read failure.** It swallowed one before, via
   `getCurrentChapterInfo`'s `catch`. Every one of its three callers already wraps the call in
   its own try/catch, and the `recordActiveBook*` family swallows for everyone else, so the
   guarantee at each call site is unchanged — but the swallow now lives at one boundary instead
   of two.

### Two review findings taken, and one disputed

**Taken.** ADR 0003's `## Known incompleteness` named this exact violation
(*"Persistence still asks the Player where it is"*) and was left asserting something no longer
true; it is now struck through with a `RESOLVED 2026-09-01 by queue-shape ticket 10` note in
the file's own established form, recording both that the comment was deleted rather than
relocated and what the duplicated decision actually cost. The derivation's two loose
parameters were also bundled into `locateInBook`'s own `PositionReading` — the same Data Clump
correction `09` made to `resolveChapterJump`, and it renamed the function honestly:
`recordFootprintAt` is TOLD the reading, where `recordAtPlayerLocation` implied it read the
Player.

**Disputed, and recorded so it is not re-raised.** The spec axis called `addFootprint`'s new
`ChapterPosition` argument unrequested redesign. The ticket names that function *"the Chapter
Position primitive"* and asks for it to be promoted; a primitive named for the type it takes,
still taking `(chapterIndex, positionMs)` as two loose numbers, would be promoted in position
only. `09`'s review made the identical correction to `resolveChapterJump` for the identical
reason. The seconds→ms conversion moving inside is what makes the type safe to pass: every
caller holds seconds and the column is ms, so leaving the multiply outside would invite the
one bug the type exists to prevent.

### Tests

`helpers/__tests__/activeBookFootprints.test.ts` gained a `where the footprint lands` describe
(9 cases — the last two added by the spec-axis review, which caught that delta 3 declared two
new refusals and pinned neither) and re-points every existing assertion at `addFootprint` — 33 cases total.

⚠ **It does not mock `@/helpers/activeBookFootprints`,** and says so at the top where the
convention would put the mock: the code under test now lives *inside* that module, so the
usual mock would swallow it. The mock moved one layer down to `addFootprint`, which is all
`db/footprintQueries` still does, and the real `locateInBook` runs — half of what is pinned is
that the two modules compose on both shapes.

Two other suites followed the boundary:

- `relativeSeek.test.ts` — its "30-second jumps never record a footprint" regression asserted
  against two DB writers; there is one now, and its comment already said that asserting
  against the writer rather than a helper was the point. **Stronger**, not weaker: every route
  in lands on `addFootprint`.
- `playBookFromRow.test.ts` — mocks `@/helpers/activeBookFootprints`, matching `nextPress.test`.
  It pins WHICH presses record; where the breadcrumb lands is the other file's subject.

### For `11`

`bookLocation`'s `null` is now collapsed one more way — "record nothing" — which is a third
answer alongside `09`'s "whole Book duration" and "do nothing". ADR 0004 ruling 3's recount
should include it. Note it is a `locateInBook` (exact) site, not an approximate one: a
breadcrumb filed at a Book Position summed from a damaged chapter would send the user back to
the wrong place, and the multi-item arm reads only `.chapter` anyway.
