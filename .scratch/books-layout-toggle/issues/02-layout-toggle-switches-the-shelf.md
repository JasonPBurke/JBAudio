# 02 — The layout toggle switches the Books shelf

**What to build:** The feature, minus its memory.

A control appears at the right-hand end of the search bar, on the Books shelf and nowhere
else. Pressing it switches that shelf between the cover grid it has today and the compact
list that already exists in the codebase and is mounted by nothing. The same Books, the
same search results, the same progress tabs, the same ordering — only the presentation
changes. The control travels with the search bar: scrolling down takes both away, scrolling
back up brings both back, exactly as the Series shelf's create button already behaves.

**The choice does not survive a restart yet.** That is ticket 03.

Read the spec's D1, D2, D3, D6, D7, D8, D10 and D11 before starting, and
`docs/adr/0006` before touching the ladder's view mapping — the union it maps into already
has a member for the list, and the comments around it describe a design that was
**considered and rejected**. Do not finish them.

**Blocked by:** 01 — Rename the shelf ordinal.

**Status:** resolved

- [x] On the Books shelf, a layout control is present at the trailing edge of the search
      bar. It is absent on the sectioned home and on the Series shelf.
- [x] Pressing it swaps which list is mounted. Both lists receive the same search-filtered
      and tab-filtered Books, the same recency mode, and the same header spacer.
- [x] The icon names the layout you are **in**, not the one a press would give you —
      matching the header's control rather than contradicting it.
- [x] The control carries a button role, a label naming the control, a value naming the
      current layout, and a hint naming what a press does.
- [x] Its tap target is enlarged with hit-slop, not padding, so the search field is not
      pushed inward.
- [x] The search bar overlay's published height is unchanged, and no list's spacer changes.
- [x] The control hides and returns with the search bar, with no visibility handling of its
      own and no pointer-events guarding.
- [x] After a flip the shelf is at the top and the search bar is still visible.
- [x] The ladder's view mapping takes the shelf **and** the layout, and is the only place
      the two are collapsed into one named view. Both the back-to-top ladder and the
      scroll-direction hook's surface consume that derived value; neither receives the raw
      ordinal.
- [x] An unrecognised shelf still never resolves to the sectioned view. The existing test
      asserting this is extended, not narrowed — it deliberately asserts the capability
      rather than naming a safe result.
- [x] Back performs its two-step — scroll to top, then background — on the list layout, and
      a layout flip leaves the sectioned home's expanded sections untouched.
- [x] The search bar component gains exactly one new optional prop, a generic trailing node.
      It learns nothing about layouts, shelves or the library.
- [x] The screen's shared list-reference docblock says four views, not three. Its warning
      about a layout that mounts two lists at once is left intact.
- [x] All four candidate icons are imported and both pairs sit behind a single swappable
      constant. The icon shim is regenerated **once**, and its drift test is green.
- [x] The rn suite's search bar stub renders its trailing node — without this the control is
      passed as a prop and never mounted, and nothing can press it. A stub for the list
      layout is added alongside the grid one.
- [x] The rn suite asserts the **reachable** sequence — scroll down, scroll back up, flip,
      assert the bar is still visible and the other list is mounted. The tempting sequence
      (scroll down, then flip) describes something a reader cannot do, because the control
      is inside the hidden bar; the test says so in a comment rather than asserting it.
- [x] The layout is ordinary screen state in this ticket. Do not add a settings column.
- [x] `tsc` and eslint clean, both lanes green.

## Comments

Resolved on `add-bookList-toggle`. `tsc` 0 errors; `eslint .` 0 errors (36 warnings, the
same pre-existing set ticket 01 recorded, none in a touched file); `jest --clearCache &&
jest` **102 suites / 1276 tests** green across both lanes from a cold cache, up from the
1269 ticket 01 left.

**Where the two axes meet.** `ladderViewFor(shelf, layout)` is the only place they are
collapsed, and `ladderView` is computed once on the screen and handed to BOTH
`useBackToTopLadder`'s `view` and `useScrollDirection`'s `surface`. Neither receives the
ordinal. The layout is `useState` on the screen -- no settings column, as this ticket
requires; that is ticket 03.

**The ladder needed nothing.** `SECTIONED_VIEWS` is `{ booksHome }` and both
`sectionRungTarget` and `decideSweep` gate on set membership, so `booksList` going live
makes them return early and the never-emptied ranges ref is never consulted. D3 holds as
written.

**Back's two-step on the list layout was already pinned**, by a test the ladder's author
wrote before this feature existed: `ladderDecisions.test.ts:137` runs `booksList` through
the rung gate and gets `scrollTo offset 0, rung master` (step one), and the `at-top`
decline that lets the system back background the app (step two) is checked ahead of any
view gating, covered at lines 66-96. No new test was needed and none was added.

**Two of ADR 0006's four artefacts were corrected, not finished.** `helpers/ladderView.ts`
and its test are rewritten around the two axes. Beyond this checklist, two more were still
describing a design the code has now settled differently, and were corrected in the same
spirit: `ladderDecisions.ts`'s `LadderView` docblock claimed the two plausible futures for
`booksList` were "replacing the grid, or joining it as a fourth option ... exactly the
changes that renumber it" -- it arrived as neither, and a flip renumbers nothing; and
`BooksList.tsx`'s §H7 advertised a revival in the future tense that has now happened. Both
edits are comment-only. Neither adds the fourth ordinal.

⚠ The ⚠ in `ladderView.ts` was **rewritten rather than left byte-identical**, which is a
departure from D2's "the existing ⚠ on that helper is unchanged". Its warning is unchanged
in force and now covers both axes; what was removed was one clause -- that §H7 made the
fourth ordinal "a matter of when, not if" -- which ADR 0006 had made false. Flagged rather
than done quietly.

**Reviewed** on both axes (Standards + Spec) before commit. Spec found no correctness
defects. Acted on: the two stale comments above; `PRESENTATION` renamed to `ANNOUNCEMENT`
(the glossary's name-after-the-question rule, and "presentation" already means the layout
itself in this effort); the new rn helpers moved up beside the existing ones; the repeated
`'Book layout'` literal folded into one constant; `scrollList(list, y)` extracted under the
two intent-carrying names. The recency-mode case needed a Started book, and the fixture is
**additive** -- a third author, `Bob Reader` -- rather than flipping one of the two authors
the six pre-existing tests assert against.

One review finding went to ticket 04 instead of being fixed here: roughly the top 8 points
of the control's `hitSlop={15}` fall outside the overlay, whose parent is
`overflow: 'hidden'`. It matches the header's own controls and cannot be fixed with padding
without moving the overlay's published height, so it is a finger-on-glass question.

**The shim is transient and must not ship.** 67 -> 71 icons: `LayoutGrid`, `List`,
`ListChevronsUpDown`, `ListChevronsDownUp`, all four verified to resolve to real deep paths.
Ticket 04 deletes the losing pair and regenerates a second time.
