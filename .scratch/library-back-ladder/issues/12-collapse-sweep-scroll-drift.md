# 12 — The collapse sweep drifts the scroll position off the top

Type: grilling
Status: open
Blocked by: —
Parent: [map.md](../map.md)

## Question

**When the collapse sweep runs, the list can come to rest off the top — and the
ladder then loses its terminal rung. What do we do about it?**

Discovered on device during [11](11-android16-device-tests.md) (finding **F-H**);
read that ticket's F-H section for the full evidence trail before starting.

## What is established

- **The defect is real and was reproduced twice.** After a back-jump whose sweep
  collapses sections, the resting offset was **+943.71** and **+213.71** instead of
  0. `atTop` goes false, so the next press **does not background the app** — it
  jumps to the top again. **Three presses to exit instead of two**, four under the
  3-rung ladder. Users experience "the app won't close".
- **The trigger is narrowed but not isolated.** Across ten master jumps with a real
  collapse, neither jump distance nor fling-interruption is sufficient alone. Only
  **deep (>29,000) AND mid-fling together** has ever drifted.
- **It is not variant-specific.** When the rung is skipped, variant A executes
  byte-identical code to variant B. A 2-rung-only defect is mechanically impossible.
- **Variant A is untested for the triggering cell, not immune.** It could not be
  driven into that cell with the test library's expansion pattern, because deep
  positions inside an expanded section take the rung and the deep *collapsed*
  territory sat at the list's end with no fling runway. A large section expanded
  **early**, with many collapsed authors after it, should make it reachable.
- **Ruled out:** a visible section staying expanded (`openAfter` non-empty) is not
  sufficient; jump distance alone is not sufficient; playback/tab-filter mutation
  is not the cause.

## What this ticket must decide

1. **Isolate the trigger**, or establish it cannot be isolated cheaply. First
   experiment: variant A, a large section expanded **early**, many collapsed
   authors after it, deep position with runway, hard fling, back mid-glide.
2. **Choose the fix.** Candidates, none evaluated:
   - re-assert `scrollToOffset({offset: 0, animated: false})` after the sweep —
     ⚠ ticket 04 warns about mutating while scrolled;
   - suppress MVCP for the sweep's mutation;
   - change what the sweep keeps open (ticket 04's "keep what's at the top" ruling
     is what produces the non-empty `openAfter` present in both drifts);
   - redefine the terminal rung so a drifted offset still backgrounds.
3. **Decide whether the spec ships without it.** The feature is unusable if back
   cannot reliably exit, so this likely gates [10](10-write-the-spec.md).

## Possibly the same family — ticket 11 F-I

The rung was observed once landing **a few cover rows past the header** instead of
at it, with independent numeric corroboration (the same header computed 1,368 px
apart across two runs). Neither driver nor agent could reproduce it. It may share a
root cause with the drift — both are "the list ends up somewhere other than where
the code asked for" — or it may be a separate softness in
`getLayout(headerIndex).y` for a header far above the viewport, which would
undermine ticket 05's "already measured, so exact" assertion. Worth holding both in
view while isolating.

## Notes

- ⚠ **The sweep consumes its own setup** — one master jump collapses the sections,
  so each trial needs the expansions rebuilt. Plan trials accordingly.
- Instrumented prototype and the `[DT]` probe are on `proto/back-ladder-rung-ab`;
  see ticket 11's "How to run".
- Related invariant from ticket 11 **F-F**: the resting offset can legitimately be
  **negative** (-59.48 observed). Any fix must not assume `offset === 0`.
