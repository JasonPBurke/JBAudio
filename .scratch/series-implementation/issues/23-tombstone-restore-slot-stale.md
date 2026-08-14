# 23 — A restored tombstone must land in the right slot after two removals

**Status:** resolved — jest 721/721, tsc 0, eslint 0. Not yet device-verified.

**Source:** [Code review `d2195ed..HEAD`](../CODE-REVIEW-d2195ed.md), Finding 3 — CONFIRMED.

**⚠ Do this in the same pass as [21](21-editor-save-tombstones-dangling-rows.md).** Both live
in `planEditorSave` and both turn on what "removed" means. This ticket's fix is only correct
once 21's rule is in place.

## The defect

The ticket-17 device fix at `src/db/seriesJoin.ts:82` is **incomplete**. It handles one
tombstone and reopens the original bug with two.

`planEditorSave` compacts **visible** rows to `0..n-1` but never repositions tombstones, so
tombstone positions decay into a stale coordinate space.

## Hand-simulated, both cases

```
ONE removal — correct
  A,B,C,D,E → remove D
  visible A,B,C,E compact to 0,1,2,3 ; D tombstone keeps 3
  re-join D: visible.filter(pos < 3) = A,B,C = 3 → slot 3 → A,B,C,D,E   ✓

TWO removals — wrong
  ...then remove B
  visible A,C,E compact to 0,1,2 ; B tombstone 1, D tombstone STILL 3
  re-join D: visible.filter(pos < 3) counts all three → slot 3 → A,C,E,D  ✗
                                                        expected  A,C,D,E
```

`seriesJoin.ts:48` records the device finding this code was written to fix — *"Appending
unconditionally left a 1,2,3,5 series reading 1,2,3,5,4"*. Two tombstones reintroduce exactly
that: the restored book is **appended**, not put back.

## ⚠ Why the device check missed it, and how to check it properly

The repro needs **two** removals of books that were not adjacent at the end. Repeating a
single remove→re-join — which is what was checked on device — **cannot** surface it. The
book must have sat somewhere other than the end, and a second book before it must also have
been removed.

## What to build

Keep tombstone positions in the same coordinate space as the compacted visible list.

The invariant to encode: **a tombstone's position always means "index into the current
visible list where I belong."** Concretely, when `planEditorSave` tombstones a row at
position `q`, the stored position of every existing tombstone with position `> q` must come
down by one.

Weigh this against the alternative of repositioning tombstones inline with visible rows in a
single shared position space — that keeps one coordinate system but breaks the `0..n-1`
contiguity of visible rows, so check what relies on contiguity (`seedInsertPositions` and
auto-numbering are the candidates) before choosing.

## Acceptance criteria

- [x] **Test first.** A failing test reproducing the two-removal case above — remove a
      middle book, remove an earlier book, re-join the first — and asserting the restored
      book lands in its original relative slot, not at the end. Watch it fail.
- [x] The one-removal case still restores correctly (it does today — do not regress it).
- [x] A book that was **never** a member still goes on the **end**. §D3 gives `position`
      sole sort authority and a join carries no opinion about reading order; guessing a slot
      from a number would be "blank beats misleading" broken from the other side.
- [x] The remembered **number** still comes back with the restored row — tombstones remember
      numbers, and a join that blanks them is a separate device-found defect that must not
      return.
- [x] The existing numbers of every other book are **carried**, not blanked. `planSeriesJoin`
      expresses a join as an editor `Save`, and `planEditorSave` writes the numbers it is
      given — passing a short or empty array blanks every number in the series.
- [x] Both doors agree: the same user action through `Add to series…` and through the editor
      lands the book in the same place.
- [x] jest green (**711/711** at review time — adds tests, loses none).
- [x] `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- `planSeriesJoin` deliberately expresses a join as an editor `Save` (`planSeriesJoin` →
  `planEditorSave`), which is what makes the tombstone restore and the remembered number come
  free. Keep that shape.
- Never run a formatter over this repo — there is no config file.

---

## Resolution

`planEditorSave` now maintains tombstone positions in the visible coordinate space. A tombstone's
new position is `survivingPositions.filter(p => p < row.position).length` — how many of the rows
that are still visible after this save sat in front of it — applied identically to rows being
tombstoned now and to tombstones that were already there, because they mean the same thing.

This is a generalisation of the ticket's "decrement every tombstone with position `> q`": it is
computed from the surviving rows rather than from the removals, so it is also correct when a
tombstone's stored position is fractional (`seedInsertPositions` writes those) or otherwise not a
contiguous index.

### The design that was weighed and rejected

Interleaving tombstones with visible rows in one shared position space was rejected: it breaks the
`0..n-1` contiguity of the visible rows, which `seedInsertPositions` leans on (it appends at
`max(position) + 1` and bisects between anchors), and it would fight `computeMembershipDiff`, which
assigns desired positions as array indices unconditionally. Two spaces kept in step is cheaper.

### ⚠ An absent row sits STRICTLY BETWEEN its neighbours, never on top of one

The integer slot alone is not enough, because it is the index *of* a visible row and so ties with
it. Two things go wrong on that tie, and **a code review caught both** after a first attempt shipped
the weaker rule:

- **Two books removed in the same save claim one index.** `a,b,c,d` losing `b` and `c` leaves `a,d`
  and both belong between them. A first attempt left contested claimants where they were, which
  merely chose the other half of the same coin: restoring `b` worked and restoring `c` still
  appended it past `d` — the 1,2,3,5,4 defect through a third door.
- **A dangling row rejoins the visible list with NO SAVE AT ALL**, the moment its file resolves.
  `assembleDerivedSeries` sorts purely by `position`, so a tie there is broken by the DB's row
  emission order and can flip between runs. A row preserved in the wrong place has still lost its
  place.

So every absent row — tombstone **and** dangling — takes a fraction inside the open interval
`(slot - 1, slot)`, ordered among rows sharing a slot by where they already sat. Every value in that
interval counts the same visible predecessors, so `planSeriesJoin`'s slot is untouched while the
sort order becomes total. `seedInsertPositions` already writes fractional positions, so nothing new
is being asked of the column.

It converges: a row already at its fraction is written again by nobody, so an unchanged save still
writes nothing. The one-time cost is the first save after this ships, which normalises the integer
tombstones already on disk.

### Known and accepted

A book **inserted** by the same save has no pre-save position, so it cannot count as a predecessor
of an absent row. That leaves a restored book one place out, in a list the user is looking at and
can drag.

### Tests

The two-removal sequence is driven through the real planners with an in-memory applier standing in
for `updateSeries` (`seriesJoin.test.ts`), because the defect is not a property of any one plan —
it is what happens to a tombstone across **consecutive** saves, so no hand-written fixture could
reach it. All three new integration tests were confirmed to fail against the pre-fix planner while
the one-removal and never-a-member cases stayed green. Both restore ORDERS of a
double removal are pinned, because the user picks one and neither is rarer.
