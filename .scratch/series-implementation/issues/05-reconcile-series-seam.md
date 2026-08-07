# 05 — `reconcileSeries`: the write plan as a tested pure module

**Blocked by:** [03](03-detect-series-seam.md) — it consumes `ProposedSeries`.

**Status:** resolved

**Spec:** [§A10–A13, §G5](../../series-ux-redesign/spec.md) and §Testing Decisions.

## What to build

The guarantee the entire feature rests on, as a pure function:

> **Nothing you do by hand is ever overwritten.** Renamed series, books you've added or
> removed, custom ordering and hand-made series are all left alone when your library is
> scanned again.

Given fresh proposals, the rows that already exist, and the names the user has deliberately
deleted, decide **exactly what to write** — and prove that no input combination can produce
a plan that destroys user work.

```
reconcileSeries(proposals, existingRows, suppressedNames)
  -> { createSeries, insertRows, removeRows, skipped }
```

Pure. No query, no write, no React Native import.

## The contract, per row

```
row still detected + still valid  ->  LEAVE IT (position intact)
row detected but no longer valid  ->  remove
newly detected book               ->  insert, seed position from canonical
origin = 'user'                   ->  skip the series entirely
name_source = 'user'              ->  keep the name, reconcile membership
```

**Regeneration reconciles; it never rebuilds.** "Wipe-and-regenerate" does not ship. Note
what falls out for free: **hand-ordering survives with no ordering flag at all**, because
canonical seeds `position` only at create and at insert, and never re-seeds an existing
row.

Ownership is recorded **per aspect** — name, membership, number, existence — so disagreeing
with one part of a detected series never disowns the rest. Renaming a series must **not**
cost the user automatic membership; that is the commonest repair there is.

## Tombstones, and why they are not optional

- **A11 — removals need a tombstone.** `membership = 'excluded'` keeps the join row as a
  hidden marker that blocks re-derivation; display filters exclude it. Without it a user
  removes four books from a wrong merge, rescans, and **gets all four back** — the most
  trust-destroying outcome available.
- **A12 — delete always suppresses.** Deleting a *detected* series writes its name to
  `suppressed_series`; deleting a *hand-made* one writes nothing, because nothing would
  recreate it.
- **A13 — detection must consult both tombstones before creating**, and hand-creating a
  series whose name sits in `suppressed_series` must **clear that row** — otherwise the
  user's own new series is shadowed by an invisible veto.

## The null coalesce is live code from day one

§G5: `origin`, `name_source` and `membership` all coalesce **null → `'user'`**;
`canonical_source` does not coalesce, because null there means "no number is set".

This is not a migration nicety — append-only means **emulators are never wiped**, so rows
carrying null in every new column exist the moment v33 lands. A row wrongly read as
`'user'` is merely never auto-updated. A row wrongly read as `'detected'` is **eligible for
regeneration to clobber**. Test both directions.

## Acceptance criteria

- [x] `reconcileSeries` is pure and returns a plan; it performs no IO.
- [x] Each line of the five-line contract is its own test, including the one that is easy
      to skip: a **still-valid detected row keeps its `position`**.
- [x] A series with `origin = 'user'` is skipped **entirely** — no insert, no remove, no
      rename — including when detection proposes a series of the same name.
- [x] `name_source = 'user'` keeps the name **and still reconciles membership**.
- [x] An `'excluded'` row survives a reconcile and blocks re-derivation of that book.
- [x] A suppressed name is never created; hand-creating that name clears the suppression.
- [x] **Null-coalesce tests in both directions**: rows with null `origin` / `name_source` /
      `membership` behave exactly as `'user'`, and `canonical_source` null is not coerced.
- [x] Rerunning reconcile on an already-reconciled state produces an **empty plan** —
      idempotence is what makes "scan again" safe.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## Flagged, undecided, decide it here

**K16:** a series whose *every* membership row is `'excluded'` still has rows, so the
empty-series reaper keeps it, but it renders with no books. Excluding every book one at a
time is arguably a delete and should probably suppress. Pick a behaviour, test it, and
record the choice in the spec.

---

## Answer

`reconcileSeries(proposals, existingSeries, suppressedNames)` lives at
`src/db/seriesReconcile.ts`, beside `seriesMembershipDiff` and for the same stated reason.
It imports `normalizeSortName` and two types — nothing else, so it cannot reach the DB, a
screen or React Native. 33 tests in `src/db/__tests__/seriesReconcile.test.ts`.
`tsc` 0 · eslint 0 · **jest 388/388**.

The plan keeps the spec's shape exactly: `{ createSeries, insertRows, removeRows, skipped }`.
Its only verbs are **create, insert, and remove-a-detected-row** — every one of them either
additive or confined to rows detection itself owns. There is no verb that mutates something
the user can see.

### K16 — decided: all-excluded is a STABLE STATE

Reconcile neither deletes such a series nor suppresses it; it emits an **empty plan**. Full
reasoning is now in the spec at K16. The short version:

- Emptying a series one book at a time is not a delete the user made. A14's rule is *bulk
  creates, per-item destroys*, and this would be the one place the app inverts it.
- `Delete Series` (D8) is one tap away, confirms in a dialog, and already suppresses per
  A12. An empty series is visible and self-correcting; one that vanished on its own is not.
- Emptying is a legitimate step in **rebuilding** a series by hand — the only repair for a
  wrong merge now that split/merge are out (09).
- Delete-on-empty already lives in `updateSeries` (`seriesQueries.ts:81`), and D9.1 already
  requires that path to suppress. Reconcile must not duplicate it by inference.

⚠ **The one trap this leaves:** `deleteEmptySeries()` counts *every* `series_books` row, so
an all-excluded series survives. **That is correct and must not be "fixed"** to ignore
tombstones — doing so deletes the series, deletes its tombstones with it, and the next
detection run re-creates it with every removed book back inside. A11's failure, amplified.

### Three things designed here, because the criteria could not be met without them

1. **Continuity matching, now A10a in the spec.** *"`name_source = 'user'` keeps the name
   and still reconciles membership"* is unsatisfiable under name-only matching: once the
   user renames a series nothing matches it again, so the next scan re-creates the old name
   from the same books and every book lands in two series. Matching falls back to **book
   overlap** against `origin = 'detected'` series — ≥ 2 books in common and more than half
   the series' rows. It is not a second identity: nothing is displayed, nothing merges.

   **This caught a real defect mid-build.** Overlap first counted only *visible* rows, so a
   renamed series carrying tombstones was missed, and the duplicate it created carried the
   excluded books **back in** — walking straight through A11. Tombstones now count, and
   detection keeps proposing excluded books anyway (exclusions never reach the detector),
   which is exactly what makes them good evidence. The first version of the idempotence
   test asserted only the *second* pass and sailed past it; asserting the first pass is
   what exposed it.

2. **No rename verb and no number-update verb (A10b).** A detected series keeps the name it
   was created with even when detection would now elect another — a series that quietly
   renames itself between scans is more alarming than a slightly stale name, and it makes
   `name_source = 'user'` hold *a fortiori*. A blank `canonical_number` on an existing row
   is likewise never back-filled by a later scan: A10 says LEAVE IT and D5 already ruled
   blank beats misleading. **Consequence worth knowing:** reconcile therefore never *reads*
   `name_source` or `canonical_source` — it only writes them. Both remain load-bearing for
   the editor (16). Both rulings are cheap to reverse if the real library argues otherwise.

3. **Insert positions interpolate; they never renumber.** A10 says "seed position from
   canonical" while forbidding any re-seeding of existing rows, which rules out shifting
   rows to open a gap — so a new row takes a position *between* its neighbours, fractional
   when it must be. Anchors are read in **position** order, not number order, so a
   hand-ordered series is read as the sequence the user sees. The fractions are not
   load-bearing: the editor's save path renumbers every row to its index, preserving the
   order they produced. `'excluded'` rows never anchor — a hidden row must not steer a
   visible decision.

Also decided, smaller: **`'14b'` and `'1-3'` become `canonicalNumber: null`**, not `14` and
`1`. `canonical_number` is a NUMBER column (D3) and `parseFloat('14b')` would file an
omnibus as if it were book 14.

### For 06, which consumes this

- `applyPlan` must be a **dumb writer**. Every field it needs is on the plan, including
  `origin` / `nameSource` / `membership` as literals — it never has to decide one. The test
  file contains an in-memory `applyPlan` that is the reference semantics; the idempotence
  tests run reconcile → apply → reconcile and assert the second plan is empty.
- `skipped` is a **report, not a write**. It recurs on every pass by design — idempotence
  is asserted on the three write arrays, not on `skipped`. It is the natural thing to log.
- Call `suppressionsClearedByCreating(name, suppressedNames)` from the hand-create path
  (09/16). It returns **every** match, because G7 records that this DB library has no
  unique constraints and a double-delete really can leave two rows.
- Proposals must be `ProposedSeries<DetectionUnit & { bookKey: string }>` — 03 made
  `detectSeries` generic precisely so 04 can pass book keys through type-safely.

### Found on the way, real, and not fixed here

**`pruneOrphanedSeriesBooks` destroys tombstones.** It deletes every `series_books` row
whose `bookKey` has no live book — including `'excluded'` ones. So if a book leaves the
library and later returns (an unmounted SD card, a library path removed and re-added), its
tombstone is gone and the next scan re-derives it back into the series. It is a genuine
A11 leak, it is upstream of this seam, and 06 owns the scan ordering — flagging it rather
than widening this ticket.
