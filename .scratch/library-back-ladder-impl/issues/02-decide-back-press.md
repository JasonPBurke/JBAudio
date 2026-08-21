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

**Status:** resolved

- [x] The view identity is a **name**, never a toggle ordinal.
- [x] The arm predicate is `offset > firstItemOffset`, read live; no constant, no epsilon, no
      hardcoded per-view number.
- [x] Declines are covered: drawer open; no mounted list; at rest at visual top; the boundary
      `offset === firstItemOffset` (the predicate is `>`, not `>=`); a **negative** offset such as
      `-978`; and an empty list reading `offset 0`.
- [x] **Ordering test:** on every declining case, a `visible` thunk that **throws** must never be
      called. This pins the rule rather than leaving it to a comment.
- [x] Master top is returned for: a non-sectioned view even when `expanded` and `ranges` are
      non-empty and would otherwise select a rung; a viewport top inside a *collapsed* section;
      a header at or within 1px of the fold; no range containing `startIndex`; `layoutY`
      undefined; a degenerate visible range; and a containing section whose header is index 0.
- [x] **The exact-number regression test:** header `y = 4820`, `offset = 6421`,
      `firstItemOffset = 38` returns `scrollTo(4820, 'section')`. A result of `4858` is the
      `y + firstItemOffset` bug that put the header under the search bar on device.
- [x] **Nearest, not earliest:** with an expanded section at index 0 also open, the rung targets
      the section **containing** the viewport top. Under the earliest reading this returns master
      and the rung is a dead press.
- [x] **Re-derivation:** feeding back the snapshot that results from the section rung's landing
      returns master. The ladder holds no state and cannot get out of step.
- [x] Assertions are on returned values, never on accessors having been called.
- [x] `npm test`, tsc and eslint are green.

---

## Answer

Built as `src/helpers/ladderDecisions.ts` + `src/helpers/__tests__/ladderDecisions.test.ts`
(`354413c`). Nothing imports it — `grep` confirms the only references are its own suite. The module
is named for **both** decisions, because ticket 03's `decideSweep` shares this snapshot and §J4 asks
for one helper module exporting two decisions; `SECTIONED_VIEWS` and the snapshot type are already
positioned for it to be added beside `decideBackPress` rather than duplicated.

All **17 enumerated spec cases** are covered by 18 tests — case 7 and case 10 each split in two, and
case 6 (B7 ordering) is carried by the fixture rather than by a test of its own. `npm test` 68
suites / 866 tests, tsc 0, eslint 0.

### Two contract decisions that were not in the ticket

**1. `decideBackPress` takes `LadderSnapshot | null`, widening §J4's signature.**

`decline('no-list')` is otherwise **unreachable**. The snapshot's `offset` and `firstItemOffset` are
non-nullable, and its `visible`/`layoutY` thunks can only be built from a live ref — so constructing
a snapshot at all already implies a mounted list, and no field is left to express "no list". The
prototype handled this with `offset === null` checks; porting that would push `| null` through every
arithmetic site. A `hasList: boolean` would be worse still: it admits the impossible state of
`hasList: false` sitting alongside a real offset and live thunks, and forces the hook to fabricate
numbers it does not have. **The absence of a snapshot IS the absence of a list.**

⚠ One behavioural consequence, stated plainly: the prototype checked the drawer *before* the list,
so drawer-open-and-no-list reported `'drawer'`; this reports `'no-list'`. Both decline, only the
diagnostic reason differs, and the combination is unreachable in practice — the library screen is
still mounted behind an open drawer. **Flagged as a spec-amendment candidate for §J4** rather than
decided silently.

**2. A header at index 0 needs no special case — and the "strictly between" framing is why.**

Case 14 wants `master` (not `scrollTo(0, 'section')`) *"by degeneration rather than by special
case"*. The obvious implementations both fail that: `if (headerIndex === 0)` is a special case, and
so is a `headerY > 0 ? 'section' : 'master'` label ternary. What actually removes the special case is
noticing an intermediate rung is **by definition a stop strictly between master top and where you
already are**:

```
0 < headerY                          it is below master's own target
headerY < offset - SUBPIXEL_EPSILON  it is meaningfully above you
```

Both halves are the same idea, and `y === 0` fails the lower bound and falls into the master branch
on its own. The ladder then reports what it actually did rather than claiming a section rung that
goes to the same place.

### The guards were mutation-checked, not assumed

Slices 2 and 3 largely passed against code already written, so "green" alone would not prove those
tests bite. Each guard was inverted and the suite re-run:

| mutation | tests killed |
|---|---|
| drop the `SECTIONED_VIEWS` gate | 1 |
| predicate `>=` instead of `>` | 2 |
| land on `y + firstItemOffset` | 2 |
| drop the `headerY <= 0` lower bound | 1 |
| sub-pixel epsilon `1 → 0` | 1 |
| earliest open section instead of containing | 3 |
| call `visible()` before the predicate | **6** |

The last row is the ordering checkbox. The fixture's **default `visible` thunk throws**, so every
decline case pins B7 for free and the assertion still lands on the returned value — no spy, nothing
asserting that an accessor was or was not called. Moving the `visible()` call one line earlier takes
down all six decline cases that use the default thunk.

### One repo fix that fell out

`npm test` did not exist — jest 30 and `jest.config.js` were both present but `package.json` had no
`test` script, so the command every ticket 01..09 names as an acceptance criterion errored with
*"Missing script: test"*. Added as `"test": "jest"` in a separate commit (`82ca506`); no config
change, same 866 tests. Ticket 01's identical checkbox was ticked against `npx jest` and is now
true as written.

### For ticket 05 (the hook)

The hook's whole job at press time is:

```ts
const list = listRef.current;
const decision = decideBackPress(list ? buildSnapshot(list) : null);
```

`buildSnapshot` must pass `visible` as a **thunk over `computeVisibleIndices()`**, never a
pre-computed value — evaluating it eagerly reintroduces the throw B7 exists to avoid, and no test in
this suite can catch that because the suite only ever sees the thunk it is handed.
