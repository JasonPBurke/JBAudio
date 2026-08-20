# 08 — Blank screen when a 100+ book section collapses at or above the fold

Type: prototype
Status: resolved
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

**Characterise the blank-screen defect well enough to assert the invariant that
protects this feature from it.**

Observed by the driver on 2026-08-18, testing a build of
`fix/collapse-offscreen-lists-onMomentumScrollEnd`:

> auto-closing a 100+ book list caused the screen to lose all components (read
> blank) until I scrolled and they appeared. This doesn't happen when that big
> list is below the current view.

This is a **FlashList layout/recycling failure, not a fade artifact** — a
different animal from the flicker in ticket 07, and it should not be conflated
with it.

## Deliver

1. **Reproduce and bound it.** Is it size-dependent (does a 30-book section do
   it?), position-dependent (at the fold vs above it), or both? Does it depend on
   `numColumns`? Does the masonry layout with `optimizeItemArrangement` matter?
2. **Establish that this feature's design cannot reach it.** The map asserts:
   at offset 0, "not visible" and "below the fold" are the same set, so a sweep
   that only fires at the top can only collapse below-fold sections. Verify that
   holds — including the edge case where a single expanded section is taller
   than the screen, and the case where the sweep is triggered by the back jump
   rather than a manual scroll. **Coordinate with ticket 04**, whose sampling
   decision is what makes the invariant true or false.
3. **Decide whether it needs its own fix.** If unreachable by construction, the
   spec asserts the invariant and this becomes a separate defect ticket outside
   this map. If reachable in any path this feature takes, it is a blocker and the
   map is rewired.

## Answer

**Unreachable by construction — confirmed, not just argued. This map is safe;
the defect is a separate, pre-existing bug outside this map's scope.**

Driver confirms directly: the blank screen was only ever observed when an
**above** section was **auto-collapsed** — not merely scrolled past while
above the fold, but actually collapsed while above the fold. That is the
precise trigger, and it resolves deliverable 2 and the tension flagged against
ticket 07:

- Ticket 04 already established that this feature's sweep fires only at
  `offset <= firstItemOffset`, where nothing is above the fold — so it can
  **only ever collapse below-fold sections**. It never performs "auto-collapse
  an above section," the exact action the driver confirms triggers the blank.
- That also reconciles ticket 07's "almost flawless" above-fold read: that
  observation never exercised an above-section *auto-collapse* (only
  passive scroll-past), so it was never in a position to hit this bug in the
  first place. The two reports aren't in tension once "above" and
  "auto-collapsed above" are told apart.

**Deliverable 1 (full characterization — size/numColumns/masonry
dependence)** stays undone; it needs device reproduction this session can't
do, and per this ticket's own framing it's for a *separate* defect record, not
a prerequisite for this map's decision. Recorded as an OPEN defect in
`flashlist-blank-screen-collapse-above.md` (new memory topic) so it isn't
lost — main's current single-open-any-section behavior can already reach it.

**Deliverable 3 (needs its own fix?)** — no, not for this map. Unreachable by
construction, so the spec asserts the invariant (already stated on the map)
and moves on. The standalone defect is main-branch pre-existing, not
introduced by this feature, and stays out of this effort.

## Note

This bug exists on `main`'s behaviour too, in the sense that any future work that
collapses a visible section will hit it. Recording it properly is worth doing
regardless of what this map decides.

## Input from ticket 04 (resolved 2026-08-18) — this ticket is no longer load-bearing

Ticket 04 chose "collapse strictly after the list settles at the top", which
makes deliverable 2 (establish that this feature cannot reach the defect) true by
construction rather than by measurement:

> The sweep fires only when `offset <= firstItemOffset`. At that offset no list
> item is above the fold (ticket 03), so "not visible" and "below the fold" are
> the same set. Therefore the sweep can only ever collapse below-fold sections —
> the case the driver measured as clean.

The driver also ruled (2026-08-18) that the sweep keeps whatever is at the top,
rejecting both "collapse everything" and "keep Recents, collapse all others"
precisely because each would collapse a section at the fold. So no path this
feature takes reaches the reported configuration.

**Consequence:** this ticket is no longer a potential blocker on the map. It
remains worth doing as *characterisation* — deliverable 1 — for a defect ticket
outside this map, since any future work that collapses a visible section will hit
it.

⚠ **One tension to resolve while characterising it.** Ticket 07 records the
driver's 2026-08-18 observation that collapsing a list **above** the current view
was "almost flawless", while this ticket's quote says the blank occurs when the
big section is **"in or above"** the view. Those two statements disagree about the
above-the-fold case. Do not treat both as settled evidence — establish which is
right. This map is safe either way, because it collapses neither.

**A mechanism worth testing against.** Ticket 04 found that mutating data while
scrolled moves MVCP's anchor, producing `scrollAnchorRef.scrollBy(diff)` plus
`ignoreScrollEvents = true` for 100 ms — and `onScrollHandler` returns
immediately while that flag is set (`RecyclerView.tsx:265`), so **engaged indices
are never recomputed and `setRenderId` is never bumped for 100 ms.** A frozen
render stack that only recovers on the next scroll event is a strong candidate
for "lost all components until I scrolled". Whether 100 ms is enough to produce a
*persistent* blank (rather than a 100 ms one) is the thing to establish — if the
list is left with a render stack computed for a viewport it has left, and no
further scroll event arrives, the blank would persist exactly as reported.

Also available as a lever, recorded not recommended:
`listRef.current.prepareForLayoutAnimationRender()` suppresses the MVCP
correction for one commit (`useRecyclerViewController.tsx:181`, `:564`) — but it
also disables recycling.
