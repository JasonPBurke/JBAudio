# 05 — `reconcileSeries`: the write plan as a tested pure module

**Blocked by:** [03](03-detect-series-seam.md) — it consumes `ProposedSeries`.

**Status:** ready-for-agent

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

- [ ] `reconcileSeries` is pure and returns a plan; it performs no IO.
- [ ] Each line of the five-line contract is its own test, including the one that is easy
      to skip: a **still-valid detected row keeps its `position`**.
- [ ] A series with `origin = 'user'` is skipped **entirely** — no insert, no remove, no
      rename — including when detection proposes a series of the same name.
- [ ] `name_source = 'user'` keeps the name **and still reconciles membership**.
- [ ] An `'excluded'` row survives a reconcile and blocks re-derivation of that book.
- [ ] A suppressed name is never created; hand-creating that name clears the suppression.
- [ ] **Null-coalesce tests in both directions**: rows with null `origin` / `name_source` /
      `membership` behave exactly as `'user'`, and `canonical_source` null is not coerced.
- [ ] Rerunning reconcile on an already-reconciled state produces an **empty plan** —
      idempotence is what makes "scan again" safe.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Flagged, undecided, decide it here

**K16:** a series whose *every* membership row is `'excluded'` still has rows, so the
empty-series reaper keeps it, but it renders with no books. Excluding every book one at a
time is arguably a delete and should probably suppress. Pick a behaviour, test it, and
record the choice in the spec.
