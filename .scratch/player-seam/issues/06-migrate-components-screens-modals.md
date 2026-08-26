# 06 — Migrate components, screens and modals onto the adapter

**What to build:** List rows, player surfaces, screens and modals stop importing
a native module. A grid card's dependencies start describing a grid card.

**Blocked by:** 02, 04

**Status:** ready-for-agent

## Scope

Every imperative Player call under components, app screens and modals.

⚠ **Hook usage is NOT in this ticket.** Files here that also call the library's
React hooks keep doing so for now — the hooks are still permitted until ticket
10 closes the ban, and moving them is ticket 09's job, with its own device pass.
A file can and often will appear in both tickets; migrate only its imperative
calls here.

⚠ Ticket 02 should already have collapsed the four duplicated play handlers into
one. If those four sites still each hold their own copy, stop and finish 02
first — migrating four copies and then deleting three is wasted review.

## The change

Same two mechanical edits as ticket 05: direct library calls become adapter
imports, and fetch-item-then-take-bookId becomes a single active-Book read. Mind
the `undefined` → `null` change on that read.

## Acceptance criteria

- [ ] No component, screen or modal makes a direct imperative call to the
      Player library
- [ ] Hook imports are left alone, untouched, in every file
- [ ] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline
- [ ] No behaviour change: play from every surface that offers it still works
