# 04 — Collapse before, during, or after the scroll settles — and does Recents survive?

Type: prototype
Status: resolved
Blocked by: 03
Parent: [map.md](../map.md)

## Question

**In what order do the scroll-to-top and the collapse sweep happen, and is the
visible set sampled before or after the list settles?**

This is one decision with two consequences, and it is the most load-bearing
prototype on the map.

The sweep is `computeRemainingOpen(open, visible)` from
`src/helpers/collapseOffscreenSections.ts` — it keeps a section iff it is
currently visible, and returns the same `Set` reference on a no-op so React
bails out. Which sections count as "visible" depends entirely on **when** the
set is sampled:

- **Sample after the list settles at the top.** The visible set is whatever is
  on screen at offset 0. `flatData[0]` is always the Recents section header
  (`sectionId: 'recentlyAdded'`), so **Recents is visible and survives the sweep
  for free** — no special case in the code. And "not visible" equals "below the
  fold", so the sweep can only ever collapse below-fold sections: the case the
  driver measured as clean.
- **Sample before the jump** (from wherever the user was). Recents is not in that
  set and **gets collapsed** — and that collapse lands *at* the viewport top,
  which is precisely the configuration that produced the newly-observed
  **blank-screen defect** (see ticket 08).

So: build and compare on device.

1. **Collapse after settle** (recommended by construction — see the map's
   invariant note).
2. **Collapse before the jump**, so the list shrinks first and the scroll travels
   less distance. Cheaper in principle, and the reason to test it rather than
   assume.
3. **Collapse during**, if any interleaving proves smoother.

Judge on **visual jank as the scroll settles** — that is the driver's stated
criterion. Note that the answer may differ between the animated and instant jump
variants (ticket 06), so coordinate with that ticket rather than deciding in
isolation.

## Also settle here

Whether **Recents should be explicitly exempt** from the sweep regardless of
sampling order, as belt-and-braces — or whether relying on the positional
property (topmost item is always visible at offset 0) is sound enough to assert
as an invariant in the spec.

## Starting point

`fix/collapse-offscreen-lists-onMomentumScrollEnd` already has the whole sweep
mechanism built: `computeRemainingOpen` with green jest tests, viewability
tracked via `onViewableItemsChanged` + `viewabilityConfig={{
itemVisiblePercentThreshold: 1 }}` into a ref, firing on `onMomentumScrollEnd`
and a velocity-gated `onScrollEndDrag` (`|velocity.y| < 0.01`). Resume from there;
do not rebuild it.

## Input from ticket 02 (resolved 2026-08-18) — read before deciding

- **The sweep lives in the ladder hook, not in `BooksHome`.** All three of
  charting decision 4's triggers (momentum-scroll-end, velocity-gated drag-end,
  the back jump) call **one** function; the hook returns `onMomentumScrollEnd` /
  `onScrollEndDrag` for the screen to thread down. Whatever this ticket decides
  about ordering is therefore applied in exactly one place.
- **The visible set is read synchronously at sweep time**, via
  `listRef.current.computeVisibleIndices()` — not accumulated from
  `onViewableItemsChanged`. That changes this ticket's "sampled before or after
  the list settles" question from a *subscription-timing* problem into a
  *call-ordering* one: sample simply means "call the accessor at the right
  moment".
- **`listRef.current.recomputeViewableItems()` exists** — "forces recalculation
  of viewable items after any operation that might affect item visibility but
  doesn't trigger a scroll event". That is precisely the collapse-then-sample
  case, and it is the tool for the map's structural invariant (sample *after* the
  list settles).
- **Section membership comes from `sectionRangesRef`** (`{sectionId, start, end}[]`,
  written by `BooksHome` from its `flatData` memo), so off-screen is a range/visible-range
  overlap test. `computeRemainingOpen()` from
  `fix/collapse-offscreen-lists-onMomentumScrollEnd` survives as the pure core.

## Answer

**Resolved 2026-08-18** (source investigation against `@shopify/flash-list@2.3.2`
and RN 0.83.2's `ReactScrollView.java` / `ReactScrollViewHelper.kt`, plus one
driver ruling. No device build was made — see *Why no A/B was built* below.)

### Headline

**Collapse strictly *after* the list has settled at the top. Never before the
jump, never during it. Recents is not exempt — it survives by position, and that
positional property is asserted as an invariant.**

Options 2 (collapse before the jump) and 3 (collapse during) are not "less good"
— they are **structurally unsafe on this list**, for reasons that are plain
control flow rather than taste. The A/B this ticket proposed has no surviving
second arm.

The sweep, in full:

```ts
// One function. All three of charting decision 4's triggers call it.
const sweepIfAtTop = useCallback(() => {
  const list = listRef.current;
  if (!list) return;
  // Ticket 03's predicate, complement form. Cheap field reads, never throws.
  if (list.getAbsoluteLastScrollOffset() > list.getFirstItemOffset()) return;
  // Predicate true => hasLayout() true (ticket 03 §6), so this cannot throw.
  const { startIndex, endIndex } = list.computeVisibleIndices();
  const visible = sectionIdsOverlapping(sectionRangesRef.current, startIndex, endIndex);
  setActiveGridSections((prev) => computeRemainingOpen(prev, visible));
}, []);
```

| Trigger | Wiring |
|---|---|
| momentum-scroll-end | `onMomentumScrollEnd={sweepIfAtTop}` |
| velocity-gated drag-end | `onScrollEndDrag` → `if (Math.abs(vy) < 0.01) sweepIfAtTop()` |
| **the back jump, animated** | **nothing.** The programmatic scroll fires `onMomentumScrollEnd` itself (§3). |
| the back jump, instant | a one-shot armed flag consumed by the next at-top scroll event (§3) |

---

### 1. The real question was call-ordering, and the obvious code gets it wrong

Ticket 02 reframed "sampled before or after the list settles" from a
subscription-timing problem into a call-ordering one. Correct — but it is
sharper than that, and in a direction that matters:

`computeVisibleIndices()` is a **pure function of the last _observed_ scroll
offset**. It reads `engagedIndicesTracker.scrollOffset`
(`EngagedIndicesTracker.ts:259`) and intersects the viewport against the layout
array. That field is written **only** by `updateScrollOffset`, which is called
from the scroll-event handler.

So:

```ts
list.scrollToOffset({ offset: 0, animated: false });
const visible = list.computeVisibleIndices();  // ⚠ the PRE-JUMP viewport
```

**Option 2 is not a design you would choose. It is what you get by accident.**
"Collapse before the jump" and "sample synchronously after issuing the jump"
produce the *identical* visible set, because the tracker has not heard about the
scroll yet. The distinction this ticket set out to A/B collapses into a single
trap with two entrances.

That reframes the deliverable: the decision is not "which of three orderings
looks nicer", it is **"which mechanism guarantees we never sample the pre-jump
viewport"**. The answer is: sample only on an event that *proves* we are at the
top — which is exactly the at-top guard on the sweep, and exactly what the three
triggers already are.

### 2. Why option 2 is unsafe, not merely suboptimal — MVCP's 100 ms render freeze

Ticket 03's F4 flagged the blind window as a "mechanical argument". Traced to its
end, it is stronger than that.

Collapsing while scrolled mutates `data`. MVCP's anchor is
`Math.max(0, computeVisibleIndices().startIndex)` — **not** index 0, because we
are scrolled. Items are removed above that anchor, so `getLayout(anchor).y`
moves, so `diff !== 0`, so `useRecyclerViewController.tsx:180–208` runs:

```
scrollAnchorRef.scrollBy(diff);
recyclerViewManager.ignoreScrollEvents = true;
setTimeout(() => { ignoreScrollEvents = false; }, 100);
```

And `onScrollHandler` **returns immediately** while that flag is set
(`RecyclerView.tsx:265`). Not just the offset accessor goes stale — the whole
handler is skipped, so `updateScrollOffset` never runs, so **engaged indices are
never recomputed and `setRenderId` is never bumped**.

The render stack is frozen for 100 ms **while the view is scrolling**. Android's
smooth scroll is ~250 ms (§4), so option 2 spends roughly the **first 40 % of the
jump animation rendering cells for a viewport the list has already left.** That
is not a theoretical concern — it is precisely the "cells missing until you
scroll" failure class the driver observed on 2026-08-18 (ticket 08), reached by a
different road.

Option 1 never touches this branch. At the top the anchor **is** index 0;
removing items below index 0 cannot move `getLayout(0).y`; `diff === 0`; the
`scrollBy` branch is skipped entirely. No correction, no blind window, no frozen
render stack. Ticket 03 §4 proved this for the resting offset; the same fact
protects the render path.

Option 3 ("during") is option 2 with a running animation on top. Rejected without
further argument.

### 3. Arrival is free for animated, and needs one flag for instant

The load-bearing mechanical discovery of this ticket, and it was not anticipated
by the map.

**`scrollToOffset({ animated: true })` fires `onMomentumScrollEnd` by itself.**
FlashList's `scrollToOffset` is a thin wrapper over
`scrollViewRef.current.scrollTo({ y, animated })`
(`useRecyclerViewController.tsx:255–265`), and on Android:

- `animated: true` → `reactSmoothScrollTo` → `ReactScrollViewHelper.smoothScrollTo`
  → `startFlingAnimator` (`ReactScrollView.java:1538`), which — when
  `mSendMomentumEvents` is set — emits `emitScrollMomentumBeginEvent` **and**
  registers `dispatchMomentumEndOnAnimationEnd` (`:1559–1560`).
- `mSendMomentumEvents` **is** set: FlashList spreads `{...rest}` straight onto
  the `CompatScrollView` (`RecyclerView.tsx:566`), so our `onMomentumScrollEnd`
  reaches the native view and RN turns momentum events on.
- `animated: false` → `super.scrollTo` (`:1328`) → an `onScroll` event, and **no
  momentum events at all**.

Consequences:

- **Animated variant: the back handler is `scrollToOffset({offset:0, animated:true});
  return true;` and nothing else.** The sweep fires on its own when the animation
  lands, through trigger #1, which already exists. No callback, no timer, no rAF,
  no "arrival" concept in the code at all.
- **Interruption is handled for free.** `dispatchMomentumEndOnAnimationEnd`
  registers `onAnimationCancel` as well as `onAnimationEnd`
  (`ReactScrollViewHelper.kt:483–491`), so a user touch mid-flight still emits
  momentum-end — at a non-top offset, where the at-top guard makes the sweep a
  no-op. **This answers ticket 06's "Interruption" bullet outright.**
- **Instant variant needs explicit plumbing**, and it must not be a synchronous
  post-scroll sample (§1) nor a bare `requestAnimationFrame` (the Fabric scroll
  event is not guaranteed to have been dispatched to JS within one frame). Use a
  one-shot armed flag — `pendingSweepRef.current = true` before the scroll,
  consumed by the first subsequent at-top scroll/momentum event. One extra ref,
  no new event source.

**This is a cost line for ticket 06 that did not exist before:** the driver's
preferred variant (animated) is the one that needs *zero* arrival machinery, and
the instant variant is the one that needs a flag. That is the reverse of the
usual "instant is simpler" intuition.

### 4. Option 2's claimed benefit is smaller than it looks

The ticket offered "the list shrinks first, so the scroll travels less distance.
Cheaper in principle." It is cheaper, but not in the way that phrasing suggests.

Android's smooth scroll duration is **distance-independent**: `startFlingAnimator`
sets `DEFAULT_FLING_ANIMATOR.setDuration(getDefaultScrollAnimationDuration(context))`,
a value read once from an `OverScroller` probe and cached
(`ReactScrollViewHelper.kt:219–228`). RN's own comment is explicit: *"ScrollView
can only scroll for 250ms when using smoothScrollTo and there's no way to
customize the scroll duration"* (`:507`).

So collapsing first does not shorten the animation — it makes it **traverse fewer
pixels in the same 250 ms**, i.e. fewer intervening cells to render. That is a
real mitigation for ticket 06's smear concern. It is simply not worth buying with
§2's frozen render stack, which attacks the same symptom from the other side and
wins.

**Handed to ticket 06 as a live constraint:** with option 1 settled, the animated
jump traverses the **fully expanded** list, and pre-collapsing to shorten it is
off the table. If the smear proves unacceptable at real library scale, the
remaining levers are a two-stage jump (instant to within a screenful of the top,
then animate the last leg) or the instant variant — *not* a pre-collapse.

### 5. Recents — the positional property holds, and is now the ruling

**Driver ruling, 2026-08-18: "keep what's at the top".** No explicit exemption.
The sweep stays a visible-set sweep and Recents survives because it is visible,
not because it is special-cased.

The premise was verified rather than assumed, because it is load-bearing:

- `flatData[0]` is the Recents `sectionHeader` whenever `recentBooks.length > 0`
  (`BooksHome.tsx:125–131`).
- `recentBooks` is derived from `sortedAuthors.flatMap(a => a.books)` and
  `sortBooksByRecency` **filters nothing** — it only orders, placing unstamped
  books last (`bookRecency.ts:31–48`). There is no tab or recency mode on which
  authors exist but recents do not.
- Therefore `recentBooks.length === 0` ⟺ there are no books at all ⟺
  `flatData` is `[]` and the sweep is vacuous.

**`flatData[0]` is the Recents header on every non-empty BooksHome, in every
recency mode.** At the top it is visible by construction, so it survives.

The accepted consequence, stated plainly for the spec: **if Recents is expanded
it fills the viewport, so back compacts every other section and leaves Recents
open.** The user closes it with one tap on a header that is already on screen —
which is not the "hunting down every header" cost the feature exists to remove.

Both alternatives were rejected on the same ground: "collapse everything" and
"keep Recents, collapse all others" each collapse a section that is *at or above
the fold*, which is exactly ticket 08's observed configuration. Option 1 is the
only rule under which that configuration is unreachable.

**The invariant for the spec:** *the sweep fires only when
`offset <= firstItemOffset`; at that offset no list item is above the fold
(ticket 03), so "not visible" and "below the fold" are the same set; therefore
the sweep can only ever collapse below-fold sections.* Ticket 08's defect is
unreachable by construction, not by care.

### 6. Two consequences for the branch being resumed

`fix/collapse-offscreen-lists-onMomentumScrollEnd` is the starting point, but two
things change and one is easy to miss.

**(a) `computeRemainingOpen` survives untouched; the viewability plumbing is
deleted.** The branch feeds the sweep from `onViewableItemsChanged` +
`viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}` into
`viewableSectionsRef`. Ticket 02 replaces that with a synchronous
`computeVisibleIndices()` call — and the swap is **behaviour-preserving**, which
is worth knowing before deleting working code. `getVisibleLayouts` bounds the
range with `position + size > threshold` at the head and `position <= threshold`
at the tail (`findVisibleIndex.ts:37`, `:45`) — **any sliver counts as visible**,
the same semantics `itemVisiblePercentThreshold: 1` was chosen for. The `Set` the
branch built and the range this computes agree.

Note `computeVisibleIndices()` returns a `ConsecutiveNumbers` — an inclusive
`{startIndex, endIndex}` pair, `EMPTY` being `(-1, -2)`
(`ConsecutiveNumbers.ts:11`). Section visibility is therefore a range-overlap
test against `sectionRangesRef`, not a set membership test.

**(b) The trigger predicate narrows, and this is a real behaviour change.** The
branch sweeps at **every** scroll stop, wherever the user is. Charting decision 4
restricts the sweep to arrivals **at the top**. Adding the at-top guard is
therefore a *reduction* of the branch's behaviour — and it is the guard that
makes §5's invariant true. Do not resume that branch's semantics wholesale.

**The velocity gate on `onScrollEndDrag` is still required, for a sharper reason
than the branch's comment gives.** The branch reasons "a fling will follow, don't
mutate mid-fling". Under the at-top guard the surviving case is more specific:
the predicate is true at the **start** of a *downward* fling from the top — you
are at offset 0, you flick down, and at finger-lift the offset still reads
`<= firstItemOffset` while a 250 ms fling is about to run. Without the gate the
sweep would mutate the list at the moment the user begins scrolling away. The
gate, not the guard, is what excludes this.

### 7. Why no A/B was built

This ticket is typed `prototype` and asked for a device comparison judged on
visual jank. No build was made, deliberately:

Option 2's arm is now known to freeze the render stack for the first ~40 % of the
jump (§2) and to collapse a section at the fold (§5) — the two defect classes
this map is already tracking. Building it would spend a device cycle
demonstrating a failure whose mechanism is already read off the source, and would
risk the driver judging *jank* on an arm that is broken for structural reasons
rather than stylistic ones.

What genuinely needs a device is **confirmation of the surviving arm**, and that
is ticket 11's job. Three tests handed over below.

---

### Findings

- **F1 — sampling `computeVisibleIndices()` right after `scrollToOffset` returns
  the pre-jump viewport.** The accessor is a pure function of the last observed
  offset. Option 2 and "the obvious synchronous code" are the same bug.
- **F2 — collapsing while scrolled freezes the render stack for 100 ms.**
  `ignoreScrollEvents` short-circuits the entire scroll handler, not just the
  offset field, so engaged indices and `setRenderId` stall mid-animation.
  Strengthens ticket 03's F4 from "the value is a projection" to "nothing
  renders".
- **F3 — an animated programmatic scroll emits `onMomentumScrollEnd`; an instant
  one does not.** The back jump's arrival signal already exists for the driver's
  preferred variant, and momentum-end also fires on `onAnimationCancel`, so
  interruption is a no-op via the at-top guard.
- **F4 — Android's smooth scroll duration is distance-independent** (~250 ms,
  cached from an `OverScroller` probe). "Collapse first so the scroll is shorter"
  buys fewer traversed cells, not less time.
- **F5 — `flatData[0]` is the Recents header on every non-empty BooksHome, in
  every recency mode**, because `sortBooksByRecency` orders without filtering.
  The map's "Recents survives for free" is verified, not assumed.
- **F6 — the branch's viewability plumbing is redundant, not merely superseded.**
  `getVisibleLayouts` uses any-sliver bounds, matching
  `itemVisiblePercentThreshold: 1` exactly, so deleting
  `onViewableItemsChanged`/`viewabilityConfig` changes no behaviour.
- **F7 — `prepareForLayoutAnimationRender()` suppresses MVCP's correction for one
  commit** (`useRecyclerViewController.tsx:181`, `:564`). Recorded as an
  available lever if any future work *must* mutate while scrolled. This feature
  does not need it, and it also disables recycling — do not reach for it
  speculatively.

### Handoffs

- **→ Ticket 06 (animated vs instant).** Three inputs, one of them a reversal.
  (a) **Animated needs zero arrival machinery; instant needs a one-shot flag** —
  the reverse of the usual simplicity argument (F3). (b) **Interruption is
  already solved** for animated, by momentum-end-on-cancel plus the at-top guard.
  (c) **The smear concern is now unmitigated by ordering**: the animated jump
  traverses the fully-expanded list and pre-collapsing is ruled out, so if it
  fails at real scale the fallbacks are a two-stage jump or the instant variant.
  Also: `getDefaultScrollAnimationDuration` derives from the device's
  `OverScroller`, which is the natural hook for the `ReducedMotionConfig`
  question in that ticket.
- **→ Ticket 08 (blank screen).** The invariant this ticket's ordering
  establishes is the one 08 was asked to verify: the sweep fires only at
  `offset <= firstItemOffset`, so it can only collapse below-fold sections — the
  case the driver measured as clean. 08 can now be scoped to *characterising* the
  defect for a separate ticket rather than gating this map. ⚠ **One tension for
  08 to resolve:** ticket 07 records "collapsing a list *above* the current view
  was almost flawless" while 08's quote says the blank occurs when the section is
  "in or above the current view". Those disagree about the above-the-fold case.
  This map is safe either way — it collapses neither — but 08 should not treat
  both statements as settled.
- **→ Ticket 09 (four views sharing).** The sweep is BooksHome-only in effect
  (it is the only view with expandable sections), but it lives in the shared hook
  and is guarded by `sectionRangesRef` being empty on the other three — where
  `computeRemainingOpen` returns the same `Set` reference and React bails out. No
  per-view branching is needed. Confirms 09 does not need a "does this view
  collapse?" capability in the list contract.
- **→ Ticket 10 (the spec).** Assert §5's invariant verbatim; it is the sentence
  that keeps ticket 08's defect out of this feature. Record §6(b) as a migration
  note — the resumed branch's "sweep anywhere" semantics must narrow to "sweep at
  the top".
- **→ Ticket 11 (device tests).** Three additions:
  - **DT-10** — confirm F3: with `animated: true`, log inside
    `onMomentumScrollEnd` and verify it fires once at the end of a programmatic
    back jump, with `getAbsoluteLastScrollOffset()` reading `0`.
  - **DT-11** — confirm the sweep's *visible* effect is nil: with several author
    sections expanded and Recents collapsed, jump from deep in the list and
    verify nothing on screen moves at the moment of the sweep (only the scrollbar
    shrinks), then scroll down to confirm the sections are collapsed.
  - **DT-12** — confirm the velocity gate (§6): at the top, flick **downwards**
    and verify no collapse fires at finger-lift.

### Honest limits

Everything above is read from `@shopify/flash-list@2.3.2`,
`react-native@0.83.2`'s `ReactScrollView.java` / `ReactScrollViewHelper.kt`, and
`BooksHome.tsx` / `bookRecency.ts`. **No device build was made** — see §7 for why,
and DT-10/11/12 for what a device still owes this decision.

The strongest claims (§1 the pure-function accessor, §2 the `ignoreScrollEvents`
short-circuit, §5 the `flatData[0]` derivation) are plain control flow and are
asserted with high confidence. §3 depends on `mSendMomentumEvents` being enabled
by RN when `onMomentumScrollEnd` is present on the ScrollView — traced through
FlashList's `{...rest}` spread, but it is the one link in the chain that crosses
the JS/native boundary, and DT-10 exists to observe it directly.

§4's ~250 ms is RN's own documented figure; the actual cached value is probed
from the device's `OverScroller` and may differ, including reaching 0 under a
system animation scale of 0 — which would make the "animated" variant silently
instant on such a device. That is ticket 06's problem, flagged here because it
also means DT-10 could fail for a reason unrelated to F3.
