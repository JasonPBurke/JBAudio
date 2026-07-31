# Lazy Single-Open Home Sections — Design (Variation B)

**Branch:** `fix/collapse-offscreen-lists-onMomentumScrollEnd` (same branch; A/B
alternative to the self-tidying design)
**Date:** 2026-07-17
**Status:** Design draft (to be tested after the self-tidying variation)
**Sibling spec:** `2026-07-17-collapse-offscreen-home-sections-design.md`

## Relationship to the self-tidying spec

This is the **second** behavior to trial on the same branch, compared on-device
against both `main` (never auto-collapse) and the self-tidying variation.

- **Self-tidying (A):** a section collapses purely because it scrolled
  off-screen. Pressing a section changes nothing about others. If you open A and
  B and never scroll, both stay open indefinitely; if you scroll past both, both
  collapse.
- **Lazy single-open (B, this spec):** pressing a section expresses "this is the
  one I want open." Every *other* open section is marked to close — **lazily**
  when it scrolls off-screen (case 4, no flash), or **immediately** if it is
  already off-screen at press time. The just-pressed section is the **protected
  primary** and is never auto-collapsed by scrolling.

Both variations share the same no-flash guarantee: a section is only ever
collapsed while fully off-screen (verified case-4 path — see memory
`flashlist-2.3.2-mvcp-header-anchor`). Neither ever collapses a visible section.

## Why "lazy"

True press-time single-open (collapse the previous section the instant you tap a
new one) reintroduces the case-3 flash whenever the previous section is still
visible above the pressed header. Deferring that collapse until the previous
section is off-screen keeps single-open *intent* while only ever collapsing in
the no-flash case. Confirmed by the earlier single-open experiment: closing the
previous section was flash-free specifically when it was already off-screen.

## Behavior

- Opening a section makes it the sole **primary**; all other open sections
  become **non-primary** (eligible to collapse).
- A non-primary section collapses when it is fully off-screen — swept on scroll
  settle, or immediately at press time if already off-screen.
- The primary section stays open. It is **protected**: scrolling past it does
  *not* collapse it. It closes only when (a) the user taps it to toggle it shut,
  or (b) the user opens a different section (which demotes it to non-primary).
- Because visible sections are never force-collapsed, opening A then B while both
  fit on screen leaves both open until one scrolls off. At rest after scrolling
  away, at most the primary remains — the "one list open at a time" feel without
  a flash.

### Key behavioral fork (please confirm in review)

The primary is protected **even when off-screen** (the user's word:
"protected"). Consequence: exactly one expanded section — the primary — may
remain expanded off-screen and contribute to scroll extent, until another
section is opened. This is the accepted single-open tradeoff. (If instead the
primary should *also* tidy away when off-screen, variation B collapses toward
variation A plus press-time closing; flag this if that is preferred.)

## State

Owned in `src/app/(drawer)/(library)/index.tsx` alongside the existing Set,
same session lifetime, passed down to `BooksHome`:

- `activeGridSections: Set<string>` — unchanged; open sections.
- `primarySection: string | null` — the protected, most-recently-opened section.
  `null` when none (fresh load, or after the primary is toggled shut).

## Mechanics (in `BooksHome.tsx`)

Reuses all shared infrastructure from the self-tidying spec:

- Viewability ref (`useRef<Set<string>>`) of on-screen `sectionId`s, updated by
  `onViewableItemsChanged` with `viewabilityConfig = { itemVisiblePercentThreshold: 1 }`.
- Sweep wired to **both** `onMomentumScrollEnd` and `onScrollEndDrag`.

Changes specific to variation B:

1. **Press handler rewrite (`handleSectionPress(sectionId)`):**
   - Section currently **closed** → open it (`add` to set), set
     `primarySection = sectionId`. Then run the immediate case-4 shortcut
     (below): collapse any now-non-primary open section already off-screen.
   - Section currently **open and IS primary** → toggle shut (`delete` from
     set), set `primarySection = null`.
   - Section currently **open and NOT primary** → promote:
     `primarySection = sectionId` (stays open; the previous primary becomes
     non-primary and thus collapse-eligible).

2. **Immediate case-4 shortcut (press time):** using the current viewability
   ref, delete from `activeGridSections` any open, non-primary section that is
   already fully off-screen. (These are the exact clean collapses observed in the
   single-open experiment.)

3. **Lazy sweep (scroll settle):** collapse every open, **non-primary** section
   that is off-screen. The primary is excluded from the sweep — this is the only
   difference in the sweep predicate versus the self-tidying variation.

### Pure helper (testable)

```
computeRemainingOpen(
  open: Set<string>,
  visible: Set<string>,
  primary: string | null,
): Set<string>
```
Rule: keep a section iff it is `primary` OR currently visible; drop the rest.
Returns `open` unchanged (same reference) when nothing collapses. The
self-tidying helper is the `primary = null` case of this same function, so the
two variations can share one helper (primary passed as `null` in variation A).

## Non-goals

- No true press-time collapse of visible sections (that is the case-3 flash).
- No change to rendering, `keyExtractor`, masonry layout, or MVCP config.

## Risks / verification

Superset of the self-tidying spec's verification, plus:

- **Primary demotion timing:** confirm that opening B while A is visible keeps
  both open (no flash), and A collapses only once scrolled off — not at press.
- **Immediate shortcut:** confirm collapsing an already-off-screen A at the
  moment B is pressed produces no visible movement (it is above/below the
  viewport, case 4).
- **Promotion path:** re-tapping a still-open non-primary section promotes it to
  primary without collapsing anything visible.
- **Toggle-shut primary:** tapping the primary closes it and leaves
  `primarySection = null` with no orphaned protection.

## Testing

- Unit (Jest): `computeRemainingOpen` with a non-null `primary` — primary always
  retained even when not visible; non-primary off-screen dropped; visible
  retained; no-op returns same reference. (Same helper also covers variation A
  via `primary = null`.)
- Manual/device: the A/B/C comparison (main vs self-tidying vs lazy single-open)
  and the variation-B-specific items above.
