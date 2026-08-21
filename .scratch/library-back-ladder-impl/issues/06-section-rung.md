# 06 — Section ranges and the intermediate rung on the sectioned view

**What to build:** The third rung. On the sectioned books view, a back press taken from deep inside
an expanded author section scrolls up to that section's header and stops there — you land where
you entered the section you were reading, with the header sitting **clear of the search bar** so
you can read the name. The next press takes you to the top of the list; the press after that
backgrounds the app.

The rung earned its place on device against a real 355-book library: the driver's verdict was
*"the 3-rung is the clear winner."* The argument against it — that it puts an extra press in front
of the reset that is the whole point of the feature — did not survive contact with the device. It
reads as a ladder, not as an obstacle.

Two things this ticket must get exactly right.

**The landing offset is the header's plain `y`, with no conversion term.** This is the one number a
reasonable implementer gets wrong in the obvious direction, and the prototype did:

```
at raw offset S, item i's top sits at screen position (y_i + firstItemOffset) - S
we want the header at screen position firstItemOffset  ⇒  S = y_h
```

Landing at `y_h + firstItemOffset` aligns the header to the **viewport** top — which is exactly the
strip the dropped-down search bar occupies as an absolute overlay, so the header lands *underneath*
it. Plain `y_h` puts the header precisely where item 0 sits at master top: in the visual slot the
user already knows. Copy this arithmetic and its comment across from the prototype.

**The ranges must be published before paint, from a layout effect.** This is a contract
requirement, not an implementation detail. The ladder reads index information from two independent
clocks; a passive effect publishes after paint, leaving a window in which new rows are on screen
while the ranges still describe the previous array. The trigger is not a section tap — it is the
library store emitting mid-scan, and the window is widest exactly when the JS thread is busy. The
failure is silent and reads as a jump bug: a stale range resolves to the **correct section id**
with a **stale `start`**, so every sanity check one would think to write passes, and the rung lands
on a section the user was never in.

Spec: D1–D5, H4, H5, R3; user stories 1, 2, 3, 9, 10, 11.

**Blocked by:** 05.

## ⚠ Testing changed under this ticket — read before starting

Hooks and components are **now testable**. Jest runs two projects: pure TypeScript stays in the
fast `helpers` lane, and anything importing React Native goes in an `rn` lane
(`jest-expo/android` + `@testing-library/react-native`) by being named `*.rn.test.tsx`.
**Read `docs/testing/jest-projects-and-rn-tests.md` first** — it holds five traps that all fail
quietly.

Landed by `spike/rn-jest-testing` (`544ac8a`); merge that branch before starting if it has not
already landed. When this ticket was written, none of this existed and its acceptance criteria
assumed `tsc` plus a manual device check were the only tools available.

**Status:** ready-for-agent

- [ ] ⚠ **`end` is INCLUSIVE — the index of the section's LAST ITEM, never the next section's
      `start`.** This is the trap of this ticket. The exclusive reading is tempting precisely
      because H4 stores `end` as deliberate redundancy rather than deriving it, and it fails in the
      quietest possible way: the viewport top resolves to the **previous** section, the rung lands
      on the wrong header, and every sanity check you would think to write still passes. Two
      boundary tests in `ladderDecisions.test.ts` are the executable statement of this contract —
      run them against your producer's output, not just against hand-written fixtures.
- [ ] **Ranges do not overlap.** The rung uses a first-match containment lookup, so at most one
      range may contain a given index; overlapping ranges make it pick an arbitrary one. Ordering
      is not required — non-overlap is (spec §H4, amended 2026-08-21).
- [ ] The sectioned view publishes its section ranges to the screen from a **layout effect**, before
      paint. The ranges are already computed during render, so this costs nothing.
- [ ] Back from inside an expanded section lands on that section's header, clear of the search bar.
- [ ] The rung targets the section that **contains** the viewport top — the nearest one, not the
      earliest expanded one in the list. The earliest reading is self-defeating: the Recently Added
      header is the first item on every non-empty sectioned list, so whenever it is expanded that
      reading targets index 0, which is master top, making the rung a guaranteed dead press.
- [ ] The rung fires only when the header is meaningfully above the fold — the sub-pixel guard
      exists because an index-based test re-fires the rung when the landing offset settles a hair
      past the header's `y`.
- [ ] A viewport top inside a **collapsed** region goes straight to master top; so does a viewport
      top inside an expanded section whose header is already on screen. A press never produces an
      invisible result.
- [ ] After the rung lands, the next press goes to master top **with no state consulted** — the
      rung's own predicate is simply false at the new offset.
- [ ] The rung is a plain `scrollToOffset`, never `scrollToIndex`. The header is above the viewport
      and therefore already measured, so its layout is exact and there is no data mutation to race.
- [ ] At header index 0 the rung and master top become the same call — it degenerates correctly at
      the boundary rather than needing a special case.
- [ ] The search bar is **not** hidden during auto-scrolls. That was considered and rejected: it
      only defers the occlusion, and it would give the ladder a second job — owning chrome
      visibility — with a new failure mode.
- [ ] The two-rung behaviour on the other views is unchanged.
- [ ] ⚠ **Watch for a known unreproduced defect:** the rung was once observed landing a few rows
      past the header. If it recurs, the range-publication timing is the first place to look.
- [ ] `npm test`, tsc and eslint are green.
- [ ] **The range producer has a test.** Its output is pure data derived from the section array, not
      from layout, so it does not need the `rn` lane unless the producer lives inside a component —
      in which case use `*.rn.test.tsx`. Assert the two contract properties directly on real
      produced output, not on hand-written fixtures: **`end` is INCLUSIVE** (the last item's index,
      not the next section's `start`) and **ranges do not overlap**. These are the trap items above,
      and they were previously checkable only by reading.
