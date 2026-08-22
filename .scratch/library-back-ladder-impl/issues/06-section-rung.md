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
**Read `docs/testing/jest-projects-and-rn-tests.md` first** — it holds seven traps that all fail
quietly.

Landed by `spike/rn-jest-testing` (`544ac8a`); merge that branch before starting if it has not
already landed. When this ticket was written, none of this existed and its acceptance criteria
assumed `tsc` plus a manual device check were the only tools available.

**Status:** resolved

- [x] ⚠ **`end` is INCLUSIVE — the index of the section's LAST ITEM, never the next section's
      `start`.** This is the trap of this ticket. The exclusive reading is tempting precisely
      because H4 stores `end` as deliberate redundancy rather than deriving it, and it fails in the
      quietest possible way: the viewport top resolves to the **previous** section, the rung lands
      on the wrong header, and every sanity check you would think to write still passes. Two
      boundary tests in `ladderDecisions.test.ts` are the executable statement of this contract —
      run them against your producer's output, not just against hand-written fixtures.
- [x] **Ranges do not overlap.** The rung uses a first-match containment lookup, so at most one
      range may contain a given index; overlapping ranges make it pick an arbitrary one. Ordering
      is not required — non-overlap is (spec §H4, amended 2026-08-21).
- [x] The sectioned view publishes its section ranges to the screen from a **layout effect**, before
      paint. The ranges are already computed during render, so this costs nothing.
- [x] Back from inside an expanded section lands on that section's header, clear of the search bar.
- [x] The rung targets the section that **contains** the viewport top — the nearest one, not the
      earliest expanded one in the list. The earliest reading is self-defeating: the Recently Added
      header is the first item on every non-empty sectioned list, so whenever it is expanded that
      reading targets index 0, which is master top, making the rung a guaranteed dead press.
- [x] The rung fires only when the header is meaningfully above the fold — the sub-pixel guard
      exists because an index-based test re-fires the rung when the landing offset settles a hair
      past the header's `y`.
- [x] A viewport top inside a **collapsed** region goes straight to master top; so does a viewport
      top inside an expanded section whose header is already on screen. A press never produces an
      invisible result.
- [x] After the rung lands, the next press goes to master top **with no state consulted** — the
      rung's own predicate is simply false at the new offset.
- [x] The rung is a plain `scrollToOffset`, never `scrollToIndex`. The header is above the viewport
      and therefore already measured, so its layout is exact and there is no data mutation to race.
- [x] At header index 0 the rung and master top become the same call — it degenerates correctly at
      the boundary rather than needing a special case.
- [x] The search bar is **not** hidden during auto-scrolls. That was considered and rejected: it
      only defers the occlusion, and it would give the ladder a second job — owning chrome
      visibility — with a new failure mode.
- [x] The two-rung behaviour on the other views is unchanged.
- [ ] ⚠ **Watch for a known unreproduced defect:** the rung was once observed landing a few rows
      past the header. If it recurs, the range-publication timing is the first place to look.
- [x] `npm test`, tsc and eslint are green.
- [x] **The range producer has a test.** Its output is pure data derived from the section array, not
      from layout, so it does not need the `rn` lane unless the producer lives inside a component —
      in which case use `*.rn.test.tsx`. Assert the two contract properties directly on real
      produced output, not on hand-written fixtures: **`end` is INCLUSIVE** (the last item's index,
      not the next section's `start`) and **ranges do not overlap**. These are the trap items above,
      and they were previously checkable only by reading.

## Answer

The third rung is live. Commit `f9e9c13`; jest 903 → **923**, tsc 0, eslint 0.

**The rung's judgement was already correct and STARVED.** Ticket 05 shipped `sectionRungTarget`
whole — containment lookup, the expanded check, the plain-`y` landing, the sub-pixel guard, the
index-0 degeneracy — and then built every snapshot with `NO_RANGES`/`NO_EXPANDED` at module scope,
so `ranges.find(...)` could never match and every armed press fell through to master top. This
ticket is therefore not "build the rung"; it is **connecting two supply lines**, and that framing
is where its tests went: the decision already had 18 tests, so the new ones pin the producer's data
contract and the publication's timing — the two things nothing could previously observe.

**Three modules, one prop, one ref:**

- `src/helpers/sectionRanges.ts` — `computeSectionRanges(items)`, pure, `helpers` lane.
- `src/hooks/useSectionRanges.ts` — memo + **layout-effect** publication, `rn` lane.
- `BooksHome` calls the hook; the library screen owns a `sectionRangesRef` and hands it to
  `useBackToTopLadder`, which now also takes `expanded`.

### Three decisions this ticket took that the spec does not state

**1. Runs are derived from `sectionId` CHANGING, not from matching a `'sectionHeader'` type
string.** The prototype sniffed the type. That string is owned by the list component, and a rename
there fails in this ticket's characteristic way: zero ranges, no error, and a ladder that silently
loses its third rung. `sectionId` is the field both consumers already key on, and a run's first
index is a header index by construction of `flatData`. The precondition is stated in the module
docblock, since it is the one thing the type cannot express.

**2. The ranges reach the hook as a REF, and that is a deliberate exception to §J2's "callers pass
ordinary values".** §J1's own signature names `sectionRangesRef`, so this is sanctioned, but the
*reason* is worth writing down because the obvious tidy-up is to mirror it like every other input:
the publication path exists precisely so it does **not** re-render the screen — the trigger is the
library store emitting mid-scan — so a mirrored value would only refresh on some later unrelated
render, which may never come, and would sit stale for exactly as long as the ranges mattered. The
`rn`-lane test *"reads the ranges from the REF at press time, not from a render"* is what keeps it
that way: mirroring them at render time fails it.

**3. `onSectionRangesChange` is narrowed to REQUIRED on `BooksHome`.** It is the one optional member
of `LadderListProps` (§H8) — optional because only a sectioned view has ranges to publish. This
*is* the sectioned view, so a caller that forgets it must not compile. Verified by probe, not
assumed: deleting the prop from the screen is `TS2741`. This is §H6's philosophy applied one level
down — required is what makes the compiler do the work — and it closes half the one gap below.

**§D2's arithmetic lives with the DECISION, not with the accessor.** The ticket says to copy it
across from the prototype, where it sat beside the scroll call. Here the landing offset is decided
in `ladderDecisions.ts` and the hook merely reads a raw `y`, so putting it in both places would be
the duplicated-comment defect ticket 04's review already fixed once. `sectionRungTarget` carries it;
`buildSnapshot` carries a one-line pointer.

### Mutations run: 6, of which 5 killed and 1 is provably equivalent

| mutation | result |
|---|---|
| `end: i - 1` → `end: i` (the EXCLUSIVE reading, the trap of this ticket) | killed, 4 tests |
| loop stops at `length` (final run never closed) | killed, 5 tests |
| compare to `items[i - 1]` rather than `items[start]` | **survives — equivalent for every input**, since a run is maximal, so every item in it equals `items[start]` |
| `useLayoutEffect` → `useEffect` (publish after paint) | killed, 1 test — §H5 is now executable rather than a comment |
| snapshot's `expanded` starved to an empty set | killed, 3 tests |
| snapshot's `ranges` starved to an empty array | killed, 3 tests |
| ranges mirrored at render time instead of read at press time | killed, 1 test |

The §H5 mutation is the one worth keeping in mind: the probe records the publication against
React's own layout-then-passive ordering, by registering a passive effect *before* the hook runs.
A passive effect is the closest observable jest offers to "after paint".

### ⚠ One gap, and why it stays open

**Nothing proves `BooksHome` actually CALLS the publisher.** Removing that one line leaves all 923
tests green. I tried to close it with a render test and backed out: `@shopify/flash-list` is not in
`jest-expo`'s transform allowlist, and adding it just moved the parser error to `pressto`, then
onward — a cascade that would widen the shared `rn` lane's transform for one assertion. What guards
it instead: the compiler now **requires** the prop at the screen (decision 3), eslint warns the
import is unused if the call is deleted, and ticket 08 exercises it on device. Recorded rather than
papered over — this is exactly the silent-omission class this ticket is about.

**Device-owed** (ticket 08, unchanged in scope): the *visual* half of "clear of the search bar" —
the offset arithmetic is unit-pinned, that it reads correctly under the real search bar is not — and
the **§R3 watch**: the rung landing a few rows past the header. H5's layout effect closes the most
plausible route to it, which is why that box stays unticked rather than being claimed as fixed.

**One flake observed, not chased:** a full run mid-session reported `1 failed, 922 passed` and two
immediate re-runs of the same mutated tree were fully green. The failing suite was not captured. It
did not recur; noting it so a future flake is a second sighting rather than a first.

### Code review — two axes vs `b7c09cf`, opus

**Spec axis: 0 wrong implementations, 0 scope creep.** It re-derived every warned failure mode
independently and confirmed each: the produced-output round-trip *"is exactly the exclusive-reading
trap"*, non-overlap is a property over 41 produced sections, and the before-paint probe *"can only
hold if phase, not registration order, decides — genuinely discriminating"*. Its three partial items
were the ones already disclosed here (the `BooksHome` publish gap, story 2's visual half, §R3) plus
one new one, adopted below.

**Standards axis: 2 hard violations, 4 judgement calls.** ⚠ **The axes DISAGREED on §J2**, which is
the case the two-axis split exists for: Standards read the ranges-as-a-ref as an unrecorded
deviation from *"callers pass ordinary values"*; Spec read it as **sanctioned, because §J1's own
signature names `sectionRangesRef`**. Spec is right on the substance — the spec contains both
sentences and the more specific one governs — but Standards is right that a tension this load-bearing
should not live only in code comments. Resolved procedurally, not by picking a winner: recorded as a
spec-amendment candidate below, which is this effort's established route (tickets 02 and 03 raised
five that way and the driver settled them in a batch).

| # | Finding | Ruling |
|---|---|---|
| 1 | **`BooksHome` re-declared the contract member's signature** to narrow it to required — the exact drift §H8 forbids. | **Adopted.** Now `Omit<LadderListProps,'onSectionRangesChange'> & Required<Pick<…>>`: the signature lives in one file again and the extra `SectionRange` import is gone. Re-probed — omitting the prop is still `TS2741`. The *intent* survived review; the *mechanism* was the defect. |
| 2 | §J2 deviation not recorded as a dated spec amendment. | **Adopted procedurally** — raised as a candidate (below), not amended unilaterally: `spec.md` is on `main` and every prior amendment was driver-settled. |
| 3 | `header`/`row`/`book` fixtures byte-identical across two suites. | **Adopted.** Extracted to `src/helpers/__tests__/support/sectionedItems.ts`, which `jest.config.js` documents as the home for shared harnesses and which neither lane matches as a test. One home for the shape they claim to mirror. |
| 4 | The §H5 paragraph appears near-verbatim **four times**; §D2 twice. | **Adopted.** One canonical site each (`usePublishSectionRanges` for §H5, `sectionRungTarget` for §D2); the rest are pointers. Same defect ticket 04's review fixed once already. |
| 5 | Data clump: `buildSnapshot(list, inputs, ranges)`. | **DECLINED, and the reason is now in the code.** `LadderInputs` is the RENDER-TIME mirror; the ranges are the one input that must not be captured at render time. Folding them in is the precise mistake the ref exists to prevent, and a test fails if you do it. Expect this to be re-proposed. |
| 6 | `useSectionRanges` returns `void` but publishes upward — a mysterious name. | **Adopted.** Renamed **`usePublishSectionRanges`** (module and suite), so the direction of travel is in the name rather than only in the docblock. |
| 7 | *(Spec)* §J1 names the param `activeGridSections`; ticket 06 called it `expanded`, so ticket 07 would add `setActiveGridSections` beside it. | **Adopted as a decision, not a rename.** Keeping `expanded` and pairing it with `setExpanded` follows §H1's pattern — the screen maps its own state to the ladder's vocabulary at the mount site, so no view's UI word leaks in. ⚠ Written into **ticket 07's own file**, since that is the file its implementer will read. |

jest 923 → **923** (the refactors move code, they do not add cases), tsc 0, eslint 0.

### ⚠ Two spec-amendment candidates for the driver

1. **§J2 vs §J1.** §J2 says the hook mirrors EVERY input and callers pass ordinary values; §J1's
   signature names `sectionRangesRef`. Both are in the spec and they conflict. The resolution the
   code implements: **a ref is the exception, and only for data published without re-rendering the
   screen.** §J2 should say so, the way §H4 and §H8 carry their dated amendments.
2. **§J1's parameter names** — `activeGridSections`/`setActiveGridSections` → `expanded`/`setExpanded`,
   for the reason in ticket 07's handoff note.

### ⚠ One environment fact, worth having

`npm test` **crashes** on this machine when watchman is running at low priority — *"Watchman is
refusing to start"*, a Node fatal error, and **no test output at all**. `npx jest --watchman=false`
runs clean (923/923). Hit during this review; the spec-axis reviewer hit it too and worked around it
the same way. Related to [[metro-watchman-capability-gate]].

⚠ **This does NOT explain the flake recorded above, and the tempting inference is wrong.** The
watchman failure produces no counts whatsoever; the flake produced `1 failed, 922 passed, 923 total`
— a real test that really failed. Two different phenomena, and collapsing them would retire an open
question by coincidence of timing.
