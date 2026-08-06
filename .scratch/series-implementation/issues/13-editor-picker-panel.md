# 13 — The editor's on-demand book picker

**Blocked by:** [12](12-editor-one-root-route.md).

**Status:** ready-for-agent

**Spec:** [§E3, E4, E6, E9, E10, E12, E13](../../series-ux-redesign/spec.md), §H7.

## What to build

`+ Add books` opens a panel over the editor that runs **Authors → Books**, while the
ordered list stays visible on the surface beneath it. Choosing books never moves the list
you are building.

Closes user stories 52–58 and 61.

## The flow

The author multi-select is a **non-modal volume reducer** — ten authors turns ~350 books
into ~50 rows — which is why it survives the ruling that closed filter/search. Selections
are **staged** until the step is committed, so **nothing above the panel moves while you
pick**.

That staging is not a nicety. It was chosen on a measurement: **547,334 changed pixels per
tap** in the rejected shape versus **28,488** in the chosen one, with **zero** above the
panel. The "screen jumps on every selection" problem is **structural, not cosmetic** — the
picker and the ordered list share one scroll container, so anything committed above the
panel *must* move it.

## `X` and `+ Add books` are inverses

| | |
| --- | --- |
| `X` | closes the panel, **keeps** the editor |
| back / chevron / `Cancel` | **leaves** the editor |

`X` never exits the flow. The editor keeps its own `Cancel`, `Save` and `+ Add books`.

## Acceptance criteria

- [ ] `+ Add books` opens a panel running Authors → Books; the ordered list stays on the
      editor surface beneath it.
- [ ] Selections are **staged** until the step is committed. Nothing above the panel moves
      while picking.
- [ ] Selections are **kept when the author filter changes**, so building across ten authors
      does not mean starting over ten times.
- [ ] `X` closes the panel onto the editor and never abandons the series.
- [ ] The empty state reads `Add books to get started.` — reachable for the first time under
      this `X` behaviour.
- [ ] **E13 — shipping requirement the prototype does not meet:** the candidate pool must be
      **the list's own virtualized list with everything above it as a header component**.
      The prototype renders it unvirtualized inside the sortable's scroll view — fine at
      eight books, **not fine to ship** against 350.
- [ ] **H7 — this surface is EXEMPT from the geometry rules.** Its radio buttons and drag
      grabbers are **targets** that want a predictable screen edge. Do not apply the 600dp
      content cap here.
- [ ] The delete badge sits at the card's top-left carrying its own scrim; no book totals;
      no name prompt; `Order` stays in the main list.
- [ ] Device-verified: build a cross-author playlist end to end, at font scale 2.0, in both
      themes.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Closed — do not re-offer

**E10:** the A–Z rail · filter/search over authors · the bottom-sheet picker · variants A–D,
F and G. Seven create-flow shapes were built across three sessions. This is the survivor.

## Known consequence, flagged and deliberately not fixed

**E12:** `Books → Authors` has no direct affordance — getting back is `X` then
`+ Add books`, which loses the author selection. A chevron in the panel's own header
restores it (~5 lines) **if it reads wrong in use**. Ship without it; add it only on
evidence.

## Fixes go in the shared shell

The editor has one shell and the variants sit inside it. **Fix the shell, never one
variant** — that is how the prototype was organised and it is why the variants stayed
comparable.
