# 03 — What exactly is "at the top", given the spacer header and MVCP?

Type: task
Status: resolved
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

**What numeric predicate means "scrolled down" (back is consumed) and "at the
top" (back backgrounds the app, and the collapse sweep fires)?**

Charting decision 2 fixed this as "any offset > 0". That is the *intent*; this
ticket produces the **implementable predicate**, because a literal `> 0` is very
likely wrong in practice on these lists:

- Every list renders a `ListHeaderComponent` spacer of `SEARCH_BAR_HEIGHT` to
  clear the absolutely-positioned overlay `SearchBar`. Establish whether the
  resting `contentOffset.y` at visual-top is `0` or offset by that spacer.
- **FlashList 2.3.2 runs `maintainVisibleContentPosition` by default** and
  re-anchors on data commits. `useResetScrollOnTabChange` already carries a
  `requestAnimationFrame` deferral specifically because MVCP fights a
  `scrollToOffset` call, with a comment warning not to remove it. Establish
  whether MVCP can leave a small non-zero resting offset after a collapse
  mutates the data.
- Android over-scroll / bounce can report transient negative or small positive
  offsets.

Deliver: a measured resting offset at visual-top for **each** of the four views
(BooksHome, BooksGrid, SeriesHome, and BooksList if mountable), and a recommended
predicate — a literal `> 0`, a small epsilon, or an offset relative to the spacer
height. State the reasoning, not just the number.

## Why it matters

Get this wrong in the "too sensitive" direction and back stops backgrounding the
app reliably, which is the single most annoying failure mode this feature can
have. Get it wrong in the other direction and a genuinely-scrolled list refuses
to jump. It also defines when the collapse sweep is allowed to fire (ticket 04).

## Input from ticket 01 (resolved 2026-08-18) — a constraint on the predicate

**RISK 2:** the predicate must be **synchronously readable from a ref** at the moment
the back handler runs. The handler cannot await state, and per RISK 1 it must not take
the offset as a `useFocusEffect` dependency.

The good news is it is nearly free: `index.tsx` already threads a **plain-JS**
`onScroll` (from `useScrollDirection`, deliberately not a worklet, for FlashList
compatibility) at `scrollEventThrottle={16}` into every list, and that hook already
keeps `previousScrollY` in a ref. A `scrollYRef` is an extension of existing plumbing,
not new machinery.

**The constraint on this ticket's answer:** do not land on a predicate that needs
sub-frame accuracy or a value only obtainable asynchronously. A simple `offset > 0`
(or `> epsilon`) read from a ref is well within budget; anything requiring a measured
layout at press time is not.

## Input from ticket 02 (resolved 2026-08-18) — read before deciding

- **The offset is read synchronously from the list, not tracked.** Ticket 01's
  RISK 2 (build a `scrollYRef` from `onScroll`) is **superseded**:
  `listRef.current.getAbsoluteLastScrollOffset()` is a plain synchronous field
  read (`RecyclerViewManager.ts:198`). Do not design a predicate around a
  tracked value.
- **That accessor already includes the first-item offset** —
  `engagedIndicesTracker.scrollOffset + firstItemOffset`. Since the screen puts a
  `SEARCH_BAR_HEIGHT` spacer in `ListHeaderComponent` (`index.tsx`, `ListSpacer`),
  this is exactly the ambiguity this ticket names. **`listRef.current.getFirstItemOffset()`
  returns that spacer offset**, so the predicate can be expressed against either
  origin explicitly rather than by trial and error.
- **`computeVisibleIndices()` / `getFirstVisibleIndex()` give index-level
  visibility synchronously**, so an index-based "at the top" test is available as
  an alternative to a pixel threshold.
- Whatever predicate is chosen must be answerable **from the ref alone**, since
  ticket 02 removed the ladder's scroll tracking.

## Answer

**Resolved 2026-08-18** (source investigation against `@shopify/flash-list@2.3.2`
and the four list components; no device required to settle the question, one
number set carried to ticket 11 for confirmation).

### Headline

```ts
const list = listRef.current;
const isScrolledDown =
  !!list && list.getAbsoluteLastScrollOffset() > list.getFirstItemOffset();
```

**Not a literal `> 0`, and not a hand-picked epsilon — the threshold is
`getFirstItemOffset()`, read from the same ref at the same moment.**

It is not a fudge factor. `firstItemOffset` is *exactly* the raw scroll offset at
which the first list item's top reaches the viewport top, so the predicate reads
literally as **"is any list item above the fold?"** — which is the definition of
"scrolled down" this feature actually wants.

The at-top test ticket 04 needs is its exact complement, from one comparison:

```ts
const isAtTop = !list || list.getAbsoluteLastScrollOffset() <= list.getFirstItemOffset();
```

No gap, no overlap, no second constant: nothing can be both "scrolled" and "at
top", or neither.

---

### 1. The spacer ambiguity does not exist — resting offset at visual top is `0`

The ticket's first bullet asked whether the resting `contentOffset.y` at visual
top is `0` or offset by `SEARCH_BAR_HEIGHT`. **It is `0`, on all four views.**
Traced, not assumed:

- The scroll handler feeds the manager the **raw** `event.nativeEvent.contentOffset.y`
  (`RecyclerView.tsx:270`, `:299`).
- The manager stores it spacer-relative: `updateScrollOffset` writes
  `offset - this.firstItemOffset` into the tracker (`RecyclerViewManager.ts:117`),
  and the tracker assigns it **without clamping** (`EngagedIndicesTracker.ts:100`)
  — so at visual top the tracker legitimately holds a *negative* number,
  `-firstItemOffset`.
- `getAbsoluteLastScrollOffset()` adds it straight back:
  `scrollOffset + firstItemOffset` (`RecyclerViewManager.ts:199`).

So the accessor **reconstructs the raw native offset exactly**. The spacer is
*content* inside the scrollable area, not a shift of the origin.

⚠ **The two doc comments in `RecyclerViewManager.ts` are the reverse of what they
say.** `getLastScrollOffset()` is commented *"Includes first item offset
correction"* and returns the **spacer-subtracted** value; `getAbsoluteLastScrollOffset()`
is commented *"Doesn't include first item offset correction"* and returns the
**raw** one. Read the arithmetic, not the comment. (Ticket 02's phrasing — "that
accessor already includes the first-item offset" — is right about the arithmetic
and easy to misread as an origin shift. It is not one.)

**The action shares the origin.** `scrollToTop()` → `scrollToOffset({offset: 0})`,
and `scrollToOffset`'s `skipFirstItemOffset` defaults to `true`, meaning
`adjustedOffset = offset + 0` (`useRecyclerViewController.tsx:255`) — a raw
`scrollTo(0)`. The predicate's zero and the ladder's landing spot are the same
number, so there is no round-trip drift. `useResetScrollOnTabChange` already
relies on this.

### 2. Why `> 0` is nonetheless wrong — three divergences, one of them permanent

`getAbsoluteLastScrollOffset()` mirrors the raw offset only once the list has
laid out **and has data**. Three states break the mirror, and all three read the
same wrong number: `firstItemOffset`.

**D1 — An empty list reads `firstItemOffset` forever. This is the one that
matters.**
`modifyChildrenLayout` returns early when `dataLength === 0`
(`RecyclerViewManager.ts:263`), so `renderProgressively()` — and therefore
`applyInitialScrollAdjustment()` — **never runs**. The tracker keeps its class
initializer `scrollOffset = 0` (`EngagedIndicesTracker.ts:62`), while
`firstItemOffset` *is* set, because the probe view it measures
(`viewToMeasureBoundedSize`, a 0-height `CompatView` at `RecyclerView.tsx:512`)
renders unconditionally, data or no data.

Result: **`getAbsoluteLastScrollOffset()` returns 38–50 on an empty list that is
visually at the top, permanently, with nothing to scroll that could correct it.**

This is not hypothetical. All four views ship a `ListEmptyComponent` and the
screen reaches empty routinely — a search with no matches, an empty tab
("No books found", `seriesEmptyText`). Under a `> 0` predicate **the ladder would
arm on every empty view and back would never background the app**: exactly the
failure this ticket's "Why it matters" names as the worst one, in the state where
the feature has nothing to offer.

It self-heals the moment data arrives (`dataLength > 0` → `renderProgressively` →
`applyInitialScrollAdjustment` sets `scrollOffset = layout(0).y - firstItemOffset
= -firstItemOffset` → accessor returns 0), which is precisely why it would never
show up in casual testing and would ship.

**D2 — a sub-frame mount window** between `updateLayoutParams` (which sets
`firstItemOffset`) and the first `renderProgressively`. Same reading, one or two
frames. Not reachable by human reaction time, but excluded for free.

**D3 — MVCP's 100 ms blind window.** After a data change that moves the anchor,
the controller applies `scrollAnchorRef.scrollBy(diff)`, then sets
`ignoreScrollEvents = true` for **100 ms** (`useRecyclerViewController.tsx:199–208`).
During that window `onScrollHandler` returns immediately (`RecyclerView.tsx:265`)
and the value is a **projection** (`lastOffset + diff`), not an observation.
Constraint for ticket 04 below.

### 3. Why `getFirstItemOffset()` is the threshold, and not a constant

D1 and D2 both produce **exactly** `firstItemOffset`, so comparing against
`getFirstItemOffset()` excludes both **by construction**, with no magic number
and no tuning. It also self-adjusts per view, which a constant cannot: the value
is not uniform.

| View | `ListHeaderComponent` | padding **inside** the measured box | predicted `firstItemOffset` |
|---|---|---|---|
| **BooksHome** | spacer 38 | — (`contentContainerStyle` is `paddingBottom: 58` only; the `paddingTop: 8` wrapper is a `View` **outside** FlashList) | **38** |
| **BooksGrid** | spacer 38 | `style={styles.container}` `paddingTop: 6` — lands on the **outer** `CompatView`, which is the view `firstItemOffset` is measured *relative to*, so it counts | **44** |
| **SeriesHome** | spacer 38 | — (`listContent` is `paddingBottom: 58`; the `paddingTop: 8` is again an outer `View`) | **38** |
| **BooksList** | spacer 38 | `contentContainerStyle.paddingTop: 12` | **50** |

`ScrollAnchor` is `position: absolute, height: 0` and contributes nothing.

A hardcoded epsilon of ~40 would look right, pass on three views, and **silently
under-cover `BooksList` at 50** — the one view the map explicitly says may
replace or join `BooksGrid`. Reading the value defeats that class of drift
entirely.

**`firstItemOffset` is stable.** `measureFirstChildLayout` uses
`view.measureLayout(relativeTo)` (`utils/measureLayout.ts:44`), which reads the
**layout** tree, not the visual scroll transform — so the `useLayoutEffect` that
re-measures on every render cannot corrupt it while the list is scrolled.

**The cost, stated plainly:** the ladder will not arm in the first 38–50 px of
genuine scroll. That is not a compromise, it is the intended boundary — within
that band no list item has left the viewport, and the spacer that *has* scrolled
sits underneath the absolutely-positioned `SearchBar` overlay, so the user has
seen nothing move. A press there under a `> 0` rule would produce a ≤50 px jump,
which charting decision 6 (no toast, the jump *is* the feedback) needs to be
visible to be feedback at all.

### 4. MVCP cannot leave a non-zero resting offset at the top

The ticket's second bullet. **It cannot — for the sweep's case — and the reason
is structural rather than empirical.**

MVCP's anchor is `Math.max(0, computeVisibleIndices().startIndex)`
(`useRecyclerViewController.tsx:100`). At the top the anchor is index 0. Removing
items *below* index 0 does not move `getLayout(0).y`, so `diff === 0`, so the
`scrollBy` branch is skipped entirely — no correction, no `ignoreScrollEvents`,
no perturbation.

MVCP is confirmed **live on all four views**: it is on unless explicitly disabled
(`!maintainVisibleContentPosition?.disabled`, `RecyclerViewManager.ts:343`) and
additionally requires `keyExtractor` (`hasStableDataKeys`) — every one of the
four lists supplies one, and none disable it.

`useResetScrollOnTabChange`'s `requestAnimationFrame` deferral is the *other*
case: a tab change swaps data **while scrolled**, the anchor moves, MVCP fights.
That comment remains correct and its warning still applies — it just does not
generalise to a top-anchored collapse.

### 5. Android over-scroll — neutralised by the predicate's shape

The ticket's third bullet. Android clamps `scrollY` and renders over-scroll as an
`EdgeEffect` glow rather than a rubber-band, so sustained negative offsets are not
expected here. More usefully, **the question does not need settling**: the
predicate is one-sided, so any negative value, any sub-pixel residue, and any
small transient all fall on the same side and read as "at top". The safe side.

### 6. A safety ordering that falls out for free

`computeVisibleIndices()` **throws** when `layoutManager` is undefined
(`RecyclerViewManager.ts:249`) — and ticket 02's seam calls it at press time,
inside a `hardwareBackPress` handler. `getAbsoluteLastScrollOffset()` and
`getFirstItemOffset()` are plain field reads and never throw.

**Evaluate the offset predicate first; call `computeVisibleIndices()` only after
it returns true.** That makes the throw unreachable: `updateLayoutParams` sets
`firstItemOffset` and assigns a `layoutManager` in the same synchronous call
(`:210–241`), so `layoutManager === undefined` implies `firstItemOffset === 0`,
which makes the predicate `0 > 0` — false. **Predicate true ⇒ `hasLayout()` true.**

### 7. Alternatives considered and rejected

- **Literal `> 0`** — rejected: D1 arms the ladder permanently on every empty view.
- **Fixed epsilon constant (~40)** — rejected: a magic number that must silently
  track three `paddingTop` values across four components, and is already wrong for
  `BooksList` (50).
- **Index-based `computeVisibleIndices().startIndex > 0`** — rejected: too coarse
  (a BooksHome masonry row is ~200 px, so a full row of scroll still reports
  `startIndex === 0`), it throws before layout, and it does not resolve the empty
  case.
- **Tracking offset via `onScroll` into a `scrollYRef`** — already superseded by
  ticket 02, and D1 is a second, *permanent* instance of the same staleness class.
  Do not reintroduce.

---

### Findings

- **F1 — an empty list reports `firstItemOffset`, not 0, and never corrects.**
  The single most important fact on this ticket, and the reason `> 0` cannot ship.
  Reachable today via search-with-no-results on any of the four views.
- **F2 — `RecyclerViewManager`'s two offset doc comments are inverted.** Anyone
  re-deriving this from the comments will get the origin backwards.
- **F3 — `firstItemOffset` is not uniform across the four views** (38 / 44 / 38 /
  50), and one of the differences comes from `style` rather than
  `contentContainerStyle`, which is easy to miss by inspection.
- **F4 — MVCP goes blind for 100 ms after an anchor-moving data change**, during
  which the offset accessor returns a projection.
- **F5 — `computeVisibleIndices()` throws pre-layout**, unlike the two offset
  accessors; predicate ordering makes it unreachable.

### Handoffs

- **→ Ticket 04 (sequencing).** Two contributions. (a) The at-top test is
  `offset <= getFirstItemOffset()`, the exact complement above — one comparison
  serves both. (b) **F4 is a hard mechanical argument for "sample after the list
  settles":** if the sweep mutates data *while still scrolled*, the anchor moves,
  MVCP corrects, and `ignoreScrollEvents` blanks real scroll events for 100 ms —
  so the offset the ladder reads immediately afterwards is a prediction. Mutating
  only once at the top keeps `diff === 0` and the accessor honest. This is
  independent of, and agrees with, ticket 04's Recents-survives-for-free argument.
- **→ Ticket 08 (blank screen).** The invariant now has an exact pixel statement:
  `offset <= firstItemOffset` ⟺ **no list item is above the fold** (item 0's top
  sits at raw offset `firstItemOffset` by definition). The map's "at offset 0,
  not-visible and below-the-fold are the same set" holds on precisely this
  threshold, not merely at 0 — so the reported at-or-above-the-fold configuration
  is unreachable across the whole band the predicate treats as "top".
- **→ Ticket 09 (four views sharing).** No per-view constant is needed anywhere.
  The predicate is view-agnostic because it reads both operands from the mounted
  list's own ref; a 4th toggle or a revived `BooksList` needs no new entry
  anywhere. Whatever the list contract ends up being, it does **not** need to
  carry a header height.
- **→ Ticket 11 (device tests).** Two additions:
  - **DT-8** — confirm `getAbsoluteLastScrollOffset()` reads **0** at rest at
    visual top on each mounted view, and confirm the predicted `getFirstItemOffset()`
    values **38 / 44 / 38 / 50** (BooksHome / BooksGrid / SeriesHome / BooksList).
  - **DT-9** — confirm **F1 on device**: with a search that matches nothing, log
    `getAbsoluteLastScrollOffset()` and confirm it reads `firstItemOffset`, not 0.
    This is the finding the whole predicate turns on and it is worth one real
    observation.

### Honest limits

Everything above is read from `@shopify/flash-list@2.3.2` source and the four
call sites; **no value was observed on a device.** The repo's jest environment is
jsdom with `@testing-library/react` and has no native renderer, so
`measureLayout` returns nothing meaningful there — `firstItemOffset` would
measure 0 and F1 would be invisible. Jest cannot measure this; only a device can,
hence DT-8/DT-9 rather than a test.

The offset arithmetic (§1) and the empty-data early return (§2, D1) are plain
control flow and are asserted with high confidence. The predicted per-view
numbers in §3 depend on how RN resolves `style` vs `contentContainerStyle`
padding on the ScrollView, which is the one place a device could surprise us —
and is also the one place where being wrong costs nothing, because the
implementation reads the value rather than hardcoding it.
