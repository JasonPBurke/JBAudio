# Series implementation — pointer, not a spec

Effort: `series-implementation`
Branch: `feature/series-styling`
Opened: 2026-08-06

## The spec for this effort lives somewhere else

> **[`../series-ux-redesign/spec.md`](../series-ux-redesign/spec.md)**

That document is the **single source of truth** for what gets built. It is
driver-approved (2026-08-06, commit `23ae457`) and **amended in place — it is never
reissued and never copied.** If work here proves something in it wrong, **edit that file**
and say so; do not let a correction live only in a ticket.

Deliberately **not** duplicated here. Two copies of a 1,500-line spec is two answers to
every question within a week.

## What this directory is for

**Work**, not decisions. `.scratch/series-ux-redesign/` is the closed decision record —
a map plus twenty resolved tickets, each holding the argument behind one ruling. This
directory holds the tickets that build what those rulings describe.

The split exists because the map says so in its own words: *"the implementation itself"* is
**out of scope** for that effort, which *"ends at an approved spec"*.

## Numbering

`issues/01-*.md` onward, **numbered from `01` in dependency order (blockers first)**, per
`docs/agents/issue-tracker.md`. Numbering from `01` is safe **here** — it was not safe in
`series-ux-redesign/issues/`, which already holds `01`–`20` and is why this directory
exists.

## Three things a ticket-writer needs that the spec states but is easy to miss

1. **Most UI slices are verifiable only on a device.** Jest has no React Native preset and
   `@testing-library/react-native` is not installed — the spec defers it with a named
   trigger. Only the two pure seams (`detectSeries`, `reconcileSeries`) and the pure
   string/geometry helpers are unit-testable.
2. **Deleting the throwaway prototype harness is real work and belongs in a ticket.**
   `src/prototypes/README.md` holds the authoritative recipe — it is longer than a one-line
   `rm -rf`, and it carries one instruction that looks like harness fallout and is not.
3. **The spec's §K is sixteen traps**, every one of which fails silently if ignored. Read
   it before slicing, not while debugging.

## Status

**18 tickets, written 2026-08-06, all `ready-for-agent`.** Work the **frontier**: any
ticket whose blockers are all resolved. [01](issues/01-schema-v33.md) and
[03](issues/03-detect-series-seam.md) both have none and can start in parallel — 03 touches
no database, no React Native and no device.

```
01 schema v33 ──┬─ 02 capture tags ─┐
                │                   ├─ 04 units ─┐
03 detectSeries ┴───────────────────┘            ├─ 06 detection runs ─┬─ 07 detection card ─┐
                └─ 05 reconcile ──────────────────┘                    │                     ├─ 09 delete/restore ─┐
                                                                       └─ 17 titleDetails    │                     │
01 ─┬─ 08 backgrounds ─┬─ 10 browse row ─── 11 detail sheet ─── 12 editor route ─┬─ 13 picker │                     │
    └─────────────────-┘                                                         ├─ 14 numbers                      │
                                                                                 ├─ 15 artwork                      │
                                                                                 └─ 16 detection-aware save/delete ─┘

18 harness deletion ← blocked by 10, 11, 12, 13, 14, 15, 17
```

**Three amendments were made to the spec while these tickets were written**, all
driver-approved, all edited into `series-ux-redesign/spec.md` in place rather than recorded
only here:

- **§G1a** — the column list was **short by two**. The `Series Detection` card's own
  toggles had no columns: 09 decided the card's behaviour, 18 decided the column list, and
  the pair fell between them. Caught before the migration was written, which was the only
  time it was cheap — G3 lets this branch claim exactly one version number.
- **§G1b** — the scan **captures the tags it currently discards**. §A1's "already reachable
  from JS" is true of the turbomodule and false of the database; `extra.SERIES` and
  `Grouping` were never persisted by anything. Four columns plus a raw-tag side table.
- **§G6** — narrowed to "no new indexes *on the Series columns*", since `book_tags.book_id`
  is one, and satisfies G6's own stated rule rather than breaking it.

**No backfill ships** (driver ruling, §G1b). Existing books fill when their files are
scanned as new. That is safe rather than lucky: with the tag columns null, detection's
series count, coverage and 98.3% grouping purity are **byte-identical** and only
canonical-number accuracy moves, 96.4% → 93.5%. [03](issues/03-detect-series-seam.md)
asserts exactly that, so the property cannot silently rot.

Baseline at the time of writing, verified: `tsc` **0 errors** · jest **58 suites / 484
tests green**.
