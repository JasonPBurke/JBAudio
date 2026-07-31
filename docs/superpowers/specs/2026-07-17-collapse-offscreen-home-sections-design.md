# Collapse Off-Screen Home Sections — Design

**Branch:** `fix/collapse-offscreen-lists-onMomentumScrollEnd`
**Date:** 2026-07-17
**Status:** Design approved (pending spec review)

## Problem

`BooksHome` (`src/components/BooksHome.tsx`) is a single masonry FlashList of
collapsible sections (a recents row, then one per author). The shipped behavior
(commit `445dd8c`) is **unlimited multi-open**: expanding a section never
collapses another. That was the accepted workaround for the FlashList v2
"case 3" header-drift flash — see memory `flashlist-2.3.2-mvcp-header-anchor`.

Multi-open is fine for *visible* sections, but expanded long author lists that
have scrolled off-screen stay expanded and bloat the scroll extent, forcing
excessive scrolling. Goal: keep off-screen expansions from accumulating,
without reintroducing the case-3 flash.

## Key insight (why this is safe)

The case-3 flash only occurs when a section collapses **while still partly
visible above the pressed header** — MVCP re-anchors the top visible item and
everything below drifts up. The memory records the complementary fact,
device-verified: collapsing a section that is **fully off-screen is case 4**,
which MVCP compensates for with no visible movement. Therefore a collapse gated
on "this section is entirely off-screen" is, by construction, always the
no-flash case.

## Behavior

> Any expanded section that has scrolled **fully off-screen** collapses when
> scrolling settles.

- Visible multi-open is preserved: any number of sections that are on-screen
  (even partially) stay open simultaneously.
- A section counts as **on-screen** if *any* of its items (its header or any of
  its book/row items) is even partially viewable. So scrolling *into* a long
  author's books keeps that author open; it collapses only once you are
  entirely past it.
- A section that never leaves the viewport (short library, or two sections that
  both fit on screen) simply stays open — we never force-collapse a visible
  section, so there is never a flash. Worst case degrades to today's known-good
  multi-open.
- Re-expanding a tidied-away section is a normal header tap (unchanged).

## Non-goals

- **Not** single-open. No "primary" section, no press-time closing of others.
- **No change** to expansion/press behavior. `handleSectionPress` and the
  `activeGridSections` state shape (owned in
  `src/app/(drawer)/(library)/index.tsx`) are untouched.

## Mechanics (all within `BooksHome.tsx`)

1. **Track visible sections.** Add `onViewableItemsChanged` +
   `viewabilityConfig`. On each change, rebuild a `useRef<Set<string>>` of the
   `sectionId`s currently on-screen:
   `viewableItems.filter(t => t.isViewable).map(t => t.item.sectionId)`.
   Every `FlatListItem` already carries `sectionId`.
   - `viewabilityConfig`: `{ itemVisiblePercentThreshold: 1 }` (tunable) so an
     item counts as viewable when even a sliver shows — matching the
     conservative "collapse only when fully off-screen" rule. `waitForInteraction`
     left at default.

2. **Sweep on scroll-settle.** `onMomentumScrollEnd` (fling settle, velocity ≈ 0)
   sweeps directly. `onScrollEndDrag` fires at finger-lift and may be *followed
   by a fling*, so it is **velocity-gated**: it sweeps only when the drag stopped
   with no momentum (`|velocity.y| < 0.01`); flings are left to
   `onMomentumScrollEnd`. This preserves "tidy after any scroll gesture" without
   ever mutating the list mid-fling. Both call one collapse handler:
   ```
   setActiveGridSections(prev => {
     const next = computeRemainingOpen(prev, visibleSectionsRef.current);
     return next === prev ? prev : next; // no-op keeps identity, avoids re-render
   });
   ```

3. **Pure sweep helper (testable).** Extract the set logic so it can be unit
   tested without a running list:
   ```
   // returns prev unchanged when nothing collapses (referential stability)
   computeRemainingOpen(open: Set<string>, visible: Set<string>): Set<string>
   ```
   Rule: keep a section iff it is currently visible; drop the rest.

## Interaction with existing code

- `onScroll` is a Reanimated animated handler (`'use no memo'` at top of file).
  `onMomentumScrollEnd` / `onScrollEndDrag` / `onViewableItemsChanged` are plain
  JS callbacks forwarded to the underlying scroller and coexist with it.
- `keyExtractor` is already `sectionId`-scoped (`${sectionId}-${bookId}`), so no
  duplicate-key concern is introduced.
- MVCP stays default-on; collapsing above the viewport is the verified case-4
  path.

## Risks / verification (device A/B vs `main`)

`main` = never auto-collapse; this branch = collapse-when-off-screen. Same
expansion UX; one added behavior to compare on-device.

- **Fling stutter:** confirm collapsing a large off-screen section at
  `onMomentumScrollEnd` does not visibly hitch the settle. (At momentum end
  velocity is ~0, which is why this moment was chosen.)
- **No flash on collapse-above:** confirm the case-4 no-movement behavior holds
  when several sections collapse at once.
- **Viewability reliability in masonry mode:** confirm `onViewableItemsChanged`
  fires and reports `sectionId`s correctly with `masonry`/`numColumns`.
- **`onScrollEndDrag` correctness:** confirm the sweep after a no-momentum drag
  release does not fight a subsequent momentum phase (it should not fire one).

## Testing

- Unit (Jest): `computeRemainingOpen` pure helper — collapses off-screen,
  keeps visible, returns same reference on no-op.
- Manual/device: the A/B verification items above. Scroll behavior itself is not
  meaningfully unit-testable.
