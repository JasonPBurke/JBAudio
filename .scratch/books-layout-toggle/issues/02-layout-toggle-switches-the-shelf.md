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

**Status:** ready-for-agent

- [ ] On the Books shelf, a layout control is present at the trailing edge of the search
      bar. It is absent on the sectioned home and on the Series shelf.
- [ ] Pressing it swaps which list is mounted. Both lists receive the same search-filtered
      and tab-filtered Books, the same recency mode, and the same header spacer.
- [ ] The icon names the layout you are **in**, not the one a press would give you —
      matching the header's control rather than contradicting it.
- [ ] The control carries a button role, a label naming the control, a value naming the
      current layout, and a hint naming what a press does.
- [ ] Its tap target is enlarged with hit-slop, not padding, so the search field is not
      pushed inward.
- [ ] The search bar overlay's published height is unchanged, and no list's spacer changes.
- [ ] The control hides and returns with the search bar, with no visibility handling of its
      own and no pointer-events guarding.
- [ ] After a flip the shelf is at the top and the search bar is still visible.
- [ ] The ladder's view mapping takes the shelf **and** the layout, and is the only place
      the two are collapsed into one named view. Both the back-to-top ladder and the
      scroll-direction hook's surface consume that derived value; neither receives the raw
      ordinal.
- [ ] An unrecognised shelf still never resolves to the sectioned view. The existing test
      asserting this is extended, not narrowed — it deliberately asserts the capability
      rather than naming a safe result.
- [ ] Back performs its two-step — scroll to top, then background — on the list layout, and
      a layout flip leaves the sectioned home's expanded sections untouched.
- [ ] The search bar component gains exactly one new optional prop, a generic trailing node.
      It learns nothing about layouts, shelves or the library.
- [ ] The screen's shared list-reference docblock says four views, not three. Its warning
      about a layout that mounts two lists at once is left intact.
- [ ] All four candidate icons are imported and both pairs sit behind a single swappable
      constant. The icon shim is regenerated **once**, and its drift test is green.
- [ ] The rn suite's search bar stub renders its trailing node — without this the control is
      passed as a prop and never mounted, and nothing can press it. A stub for the list
      layout is added alongside the grid one.
- [ ] The rn suite asserts the **reachable** sequence — scroll down, scroll back up, flip,
      assert the bar is still visible and the other list is mounted. The tempting sequence
      (scroll down, then flip) describes something a reader cannot do, because the control
      is inside the hidden bar; the test says so in a comment rather than asserting it.
- [ ] The layout is ordinary screen state in this ticket. Do not add a settings column.
- [ ] `tsc` and eslint clean, both lanes green.
