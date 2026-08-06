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

No tickets yet. Next step is `/to-tickets` against the spec path above — which the driver
must type (`disable-model-invocation: true`).
