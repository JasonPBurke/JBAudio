# 13 — The editor's on-demand book picker

**Blocked by:** [12](12-editor-one-root-route.md).

**Status:** resolved

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

- [x] `+ Add books` opens a panel running Authors → Books; the ordered list stays on the
      editor surface beneath it.
- [x] Selections are **staged** until the step is committed. Nothing above the panel moves
      while picking. — **0 changed pixels above the panel** on both measured taps.
- [x] Selections are **kept when the author filter changes**, so building across ten authors
      does not mean starting over ten times. — true by construction: `pickerRows` is never
      told what is staged, and `toggleAuthor` cannot reach `selectedBookKeys`.
- [x] `X` closes the panel onto the editor and never abandons the series.
- [x] The empty state reads `Add books to get started.` — reachable for the first time under
      this `X` behaviour.
- [x] **E13 — shipping requirement the prototype does not meet:** the candidate pool must be
      **the list's own virtualized list with everything above it as a header component**.
      The prototype renders it unvirtualized inside the sortable's scroll view — fine at
      eight books, **not fine to ship** against 350. — **A/B'd on the real 355-book
      library: 917 → 480 views on an 81-book pool, and FLAT at 108 rows (462).**
- [x] **H7 — this surface is EXEMPT from the geometry rules.** Its radio buttons and drag
      grabbers are **targets** that want a predictable screen edge. Do not apply the 600dp
      content cap here.
- [x] The delete badge sits at the card's top-left carrying its own scrim; no book totals;
      no name prompt; `Order` stays in the main list. — unchanged from 12; nothing here
      reintroduces a count or a prompt.
- [x] Device-verified: build a cross-author playlist end to end, at font scale 2.0, in both
      themes. — `DEVICE-CHECK-13.md`; saved, verified in the DB, then deleted again.
- [x] `tsc` 0 errors · eslint 0 errors · jest green. — **48 suites / 587 tests**, eslint
      37 warnings = the pre-existing baseline (identical with these changes stashed).

## Closed — do not re-offer

**E10:** the A–Z rail · filter/search over authors · the bottom-sheet picker · variants A–D,
F and G. Seven create-flow shapes were built across three sessions. This is the survivor.

## Known consequence, flagged and deliberately not fixed

**E12:** `Books → Authors` has no direct affordance — getting back is `X` then
`+ Add books`, which loses the author selection. A chevron in the panel's own header
restores it (~5 lines) **if it reads wrong in use**. Ship without it; add it only on
evidence.

## Answer — built and device-verified 2026-08-10

**Three files changed, one added.** New pure module `src/helpers/seriesPickerRows.ts`
(`pickerRows` + `pickerSubtitle` + `PickerStep`, 17 tests, six mutations tried and all six
caught); `SeriesEditorPanel.tsx` rewritten as the surface's own `FlashList`;
`seriesEditor.tsx` swaps scroll containers on the panel state; two tests added to
`seriesDraftStore.test.ts`.

**The inversion is the ticket.** Closed, the ordered list is the screen and lives in the
`Animated.ScrollView` that `Sortable.Grid` needs for drag auto-scroll. Open, the *pool* is
the screen: the panel's `FlashList` takes over and the ordered list rides as
`ListHeaderComponent`. Both states show the same rows in the same place, and dragging works
in both (verified on device inside the header) — the only capability the open state gives
up is auto-scroll-while-dragging, which is a ScrollView feature the picker's list is not.

Three decisions the shape forced, each written into the file:

1. **The head (`Add books` + `X`) is DATA — row 0 — not part of the list header**, so it
   can be `stickyHeaderIndices: [0]`. `X` is the inverse of `+ Add books` and must stay
   reachable from the bottom of a 350-book pool; in the old build it scrolls away after
   ~8 rows. Same argument that already pinned the commit button in the footer.
2. **Horizontal padding lives on the ROWS, never on `contentContainerStyle`.** FlashList
   renders the pinned copy of a sticky row in an absolutely positioned overlay at
   `left: 0, right: 0`, *outside* the content container — padding there makes the head jump
   full-bleed the instant it pins.
3. **`maintainVisibleContentPosition` is off** (it is on by default in FlashList 2.x and
   anchors the topmost visible item). The data is replaced wholesale at the step commit,
   which is precisely where that anchor lands somewhere meaningless; `initialScrollIndex`
   plus a `scrollToIndex(0)` on step change puts you on the head deterministically instead.

**One thing was built, measured, and reverted:** swapping the selection tick to ticket 07's
accent-tint idiom. It measures *worse* than the shipped filled tick at every accent tried
(2.43 vs 2.82, 1.41 vs 1.53, 5.43 vs 6.91) and both numbers track the user's colour, not
the design — the reading the driver ruled on in 09. The measurement is pinned as a comment
above `AuthorRow`. See `DEVICE-CHECK-13.md` for that and three other findings, including
**K15's blank disabled button being a DARK-THEME-ONLY defect**, which is new detail for 14.

## Fixes go in the shared shell

The editor has one shell and the variants sit inside it. **Fix the shell, never one
variant** — that is how the prototype was organised and it is why the variants stayed
comparable.
