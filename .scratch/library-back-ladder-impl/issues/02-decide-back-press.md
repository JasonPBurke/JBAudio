# 02 — The ladder's shared types and `decideBackPress`

**What to build:** The ladder's judgement about *where a back press should land*, as a pure
function of plain numbers and sets, plus the small type block the rest of the feature is written
against. No wiring, no hook, no component touched. When this ticket is done every rung-selection
rule in the spec is verified on every commit, off-device.

This shape is forced by the environment, not chosen for taste: jest here is jsdom with no React
Native preset and no `@testing-library/react-native`, so anything importing React Native, a native
module or a screen cannot be tested at all. The ladder's judgement is extracted so that it can be.

The type block and the decision signature come from the spec (§H1, §H4, §J4) and are reproduced
here because they encode decisions prose would blur:

```ts
export type LadderView = 'booksHome' | 'seriesHome' | 'booksGrid' | 'booksList';

export type SectionRange = {
  sectionId: string;
  /** index of the section's header item */
  start: number;
  /** index of the section's last item, INCLUSIVE */
  end: number;
};

type LadderSnapshot = {
  view: LadderView;
  drawerOpen: boolean;
  offset: number;
  firstItemOffset: number;
  expanded: Set<string>;
  ranges: SectionRange[];
  /** LAZY — must not be called before the offset predicate passes (B7). */
  visible: () => { startIndex: number; endIndex: number };
  layoutY: (index: number) => number | undefined;
};

decideBackPress(s: LadderSnapshot)
  -> { kind: 'decline'; reason: 'drawer' | 'no-list' | 'at-top' }
   | { kind: 'scrollTo'; offset: number; rung: 'section' | 'master' };
```

`visible` is a thunk and not a value so that the ordering rule (B7) lives *inside* the tested unit
and can be asserted directly.

Spec: B1–B7, C1–C4, D2–D4, H1, H2, H4, J4; Testing Decisions › `decideBackPress` — the cases; user story 35.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The view identity is a **name**, never a toggle ordinal.
- [ ] The arm predicate is `offset > firstItemOffset`, read live; no constant, no epsilon, no
      hardcoded per-view number.
- [ ] Declines are covered: drawer open; no mounted list; at rest at visual top; the boundary
      `offset === firstItemOffset` (the predicate is `>`, not `>=`); a **negative** offset such as
      `-978`; and an empty list reading `offset 0`.
- [ ] **Ordering test:** on every declining case, a `visible` thunk that **throws** must never be
      called. This pins the rule rather than leaving it to a comment.
- [ ] Master top is returned for: a non-sectioned view even when `expanded` and `ranges` are
      non-empty and would otherwise select a rung; a viewport top inside a *collapsed* section;
      a header at or within 1px of the fold; no range containing `startIndex`; `layoutY`
      undefined; a degenerate visible range; and a containing section whose header is index 0.
- [ ] **The exact-number regression test:** header `y = 4820`, `offset = 6421`,
      `firstItemOffset = 38` returns `scrollTo(4820, 'section')`. A result of `4858` is the
      `y + firstItemOffset` bug that put the header under the search bar on device.
- [ ] **Nearest, not earliest:** with an expanded section at index 0 also open, the rung targets
      the section **containing** the viewport top. Under the earliest reading this returns master
      and the rung is a dead press.
- [ ] **Re-derivation:** feeding back the snapshot that results from the section rung's landing
      returns master. The ladder holds no state and cannot get out of step.
- [ ] Assertions are on returned values, never on accessors having been called.
- [ ] `npm test`, tsc and eslint are green.
