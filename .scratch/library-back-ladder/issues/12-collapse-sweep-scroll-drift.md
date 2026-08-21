# 12 — The collapse sweep drifts the scroll position off the top

Type: grilling
Status: resolved
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

---

## Session 1 (2026-08-20) — source trace + device instrumentation

Driver ruling this session: **reproduce on device before choosing a fix.** No fix
is selected yet; this section records the trace that produced the probe, and the
probe itself.

### The one code path that can move the list without a scroll call

`node_modules/@shopify/flash-list/dist/recyclerview/hooks/useRecyclerViewController.js`
(src: `src/recyclerview/hooks/useRecyclerViewController.tsx:171-186`).

MVCP keeps `firstVisibleItemKey` + `firstVisibleItemLayout`. On a data change it
re-finds that item and applies:

    diff = getLayout(newIndex).y - firstVisibleItemLayout.current.y
    if (diff !== 0 && !pauseOffsetCorrection && !animationOptimizationsEnabled)
        scrollAnchorRef.current.scrollBy(diff)

`scrollBy` moves an absolutely-positioned invisible anchor view, which the native
`maintainVisibleContentPosition` prop turns into a scroll adjustment
(`components/ScrollAnchor.tsx`). **Nothing else in FlashList can change the
resting offset without a `scrollTo`/`scrollToOffset` call**, so this is where the
+943.71 and +213.71 came from. That much is structural, not hypothesis.

### Why ticket 03's "at the top, diff === 0" exemption does not hold

Ticket 03 argued the sweep is safe at the top because the anchor is index 0, whose
`y` cannot move. That is true **only once the anchor has been recomputed at the
landing position**. It has not been, because the sweep's trigger and FlashList's
re-anchor are **two different signals**:

| | signal | when it fires |
|---|---|---|
| the sweep | native `onMomentumScrollEnd` (`dispatchMomentumEndOnAnimationEnd`) | immediately at animator end |
| FlashList's re-anchor | `VelocityTracker`'s `isMomentumEnd` | **100 ms after the last scroll event** (`helpers/VelocityTracker.ts:59-65`) |

Every scroll event during the jump clears that 100 ms timer, so it cannot have
fired during the jump. The only other refresh path is `applyOffsetCorrection()`
on a committed layout — and `RecyclerView.tsx:238-246` **skips it entirely**
whenever `modifyChildrenLayout()` returns true, which is what a long jump full of
newly-measured cells causes.

So the sweep mutates `data` against **whatever anchor the last commit during the
jump left behind**, ~100 ms before FlashList would have corrected it.

### What this explains, and what it does NOT

Explains, without further assumption:

- **needs a real collapse** — it is the data-change branch;
- **needs `openAfter` non-empty** — the stale anchor key must still resolve to an
  index; if its section collapsed, `findIndex` returns `-1` and no correction runs;
- **magnitude does not track sections collapsed** — it is one item's `Δy`. The
  ticket's "re-anchor, not accumulation" reading was right;
- **not variant-specific** — nothing here reads the variant.

⚠ **Does NOT yet explain the sign.** Both drifts were **positive** (`newY > oldY`),
and the sections collapsed (Sanderson, Butcher, Islington, Stroud, Pratchett) all
sit *after* the surviving `Agatha Christie` alphabetically. Removing content
*below* an anchor cannot push that anchor down. So either the anchor is not where
the staleness story puts it, or `getLayout` for a far-away item was **estimated**
and converged upward on re-measure — which would put **F-I** (the rung landing a
few rows past the header) in the same family and undermine ticket 05's "already
measured, so exact". **This is the open question the device run settles.**

### The probe

Two throwaway changes on `proto/back-ladder-rung-ab`:

1. `patches/@shopify+flash-list+2.3.2.patch` — one log at the correction site,
   emitted on **every** correction attempt (drift or not, so a clean run is
   evidence too), plus an `mvcp:lost` line for the anchor-vanished path:

       [DT] mvcp {"key","idx","oldY","newY","diff","dataChanged","offsetBefore","applied"}
       [DT] mvcp:lost {"key","offsetBefore"}

2. `useBackToTopLadderPrototype.ts` — a `rest:postSweep` line 400 ms after each
   sweep, so a trial reads end-to-end with no chip tap mid-repro.

`key` is BooksHome's `keyExtractor` output, `${sectionId}-${bookId}`, so it
**names the section the anchor sits in** — the field that settles which item the
anchor actually is, which source reading could not.

### How to run

JS-only change, but it touches `node_modules`, so Metro's cache must be cleared:

    npx expo start --clear        # debug build is enough; release strips console.log
    adb logcat -c && adb logcat -s ReactNativeJS:V | grep --line-buffered '\[DT\]'

Expected line order for one back press that collapses something:

    back → back:master → momentumEnd → sweep → mvcp → rest:postSweep

### Falsifiable predictions

**Confirms the diagnosis** — on a drifting run:
- exactly one `mvcp` line between `sweep` and `rest:postSweep`;
- `applied: true`, `dataChanged: true`;
- **`diff` equals the drift in `rest:postSweep.offset`**, within a pixel;
- `key` names something other than the Recents header (`flatData[0]`).

**Refutes it** — drift with **no** `mvcp` line, or `applied: false`, or a `diff`
that does not match the drift. Then something other than MVCP is moving the list
and this whole trace is wrong.

**Also decides the sign question** — `key` + `oldY` + `newY` say whether the
anchor is a stale deep item (staleness story) or a near-top item whose layout
re-measured upward (the F-I / estimated-layout family).

### Fix candidates as they stand after the trace

Not chosen; recorded so the device run can be read against them.

| # | candidate | note |
|---|---|---|
| 1 | `listRef.prepareForLayoutAnimationRender()` immediately before the sweep's `setState` | Public FlashList method; sets `animationOptimizationsEnabled`, which is checked at the `scrollBy` guard, and `onCommitEffect` clears it automatically (`RecyclerView.tsx:627`). One-commit, self-clearing, **no timer and no constant**. Cost: recycling off for that one commit. Leaves ticket 04's "keep what's at the top" and charting decision 2 intact. |
| 2 | delay the sweep past the 100 ms debounce | Makes ticket 03's invariant true rather than assumed, but hard-couples to a private FlashList constant and adds the timer charting decision 2 avoided. |
| 3 | `maintainVisibleContentPosition={{ disabled: true }}` on BooksHome | Precedent in `BooksHorizontal.tsx:77` and `SeriesEditorPanel.tsx:194`. Under today's unlimited-open, MVCP does nothing on a header tap. ⚠ But it also stops compensating for background library-store mutations (scan, Recents reorder) while scrolled, and forecloses the documented single-open future. ⚠ Memory `flashlist-2-3-2-mvcp-header-anchor` lists "disabling MVCP" among **rejected** attempts — for a different configuration (single-open + `scrollToIndex` pin), so it needs re-judging, not automatic rejection. |
| 4 | redefine the terminal rung so a drifted offset still backgrounds | ⚠ Contradicts **charting decision 2** ("no counter, no timer, self-healing by construction") and leaves the list visually wrong. |
| 5 | change what the sweep keeps open | Overturns ticket 04's driver ruling. Mechanically it would work only if it removes the anchor's section, which the device run can confirm or rule out. |

⚠ One more, surfaced by the trace and not in the original candidate list:
`scrollToIndex` internally sets `pauseOffsetCorrection` for 200/300 ms
(`useRecyclerViewController.tsx:478-492`) while `scrollToOffset` does **not** —
so a jump via `scrollToIndex(0)` would suppress the correction for free. Ticket 09
ruled `scrollToIndex` never needed and ticket 05 rejected it for the rung; noted
only so the asymmetry is on the record.

---

## Answer

**Root cause confirmed on device, fix chosen and A/B-verified: call
`prepareForLayoutAnimationRender()` immediately before the sweep's `setState`.**

Run on the Pixel 7 Pro / Android 16 / SDK 36, debug build on
`proto/back-ladder-rung-ab`, real 355-book library, driven entirely over adb.

### 1. The trigger IS isolated — and it is deterministic, not flaky

The drift is MVCP's offset correction firing against a **stale anchor**:

    #681 mvcp {"key":"row-Michael Kramer / Brandon Sanderson","idx":101,
               "oldY":19345.05,"newY":18366.50,"diff":-978.5485714285714,
               "dataChanged":true,"offsetBefore":0,"applied":true}
    #688 rest:postSweep {"offset":-978.5485714285714,"atTop":true}

    #720 mvcp {"key":"header-Bonnie Garmus","idx":12,
               "oldY":3974.46,"newY":2170.57,"diff":-1803.8857142857128,...}
    #727 rest:postSweep {"offset":-1803.8857142857128,...}

    #<AB> mvcp {"key":"row-Stephen King","diff":-617.1999999999971,"applied":true}
          rest:postSweep {"offset":-617.1999999999971,...}

**`mvcp.diff` equals the resting drift exactly, every time.** The session-1
prediction is confirmed to the pixel: the sweep mutates `data` while MVCP's
anchor is still the pre-jump item, MVCP re-finds it, and `scrollBy(diff)` moves
the list off the top.

**The staleness is directly observable even when it does NOT drift.** In the very
first trial, resting at offset 0, the anchor key was
`Book 4 - The Creeping Shadow-emrmjGigusLQvpVb` — a deep, pre-jump section, not
`header-recentlyAdded` / index 0. Ticket 03's "at the top the anchor is index 0"
is therefore **false at sweep time**; it becomes true ~100 ms later.

### 2. The real precondition, which ticket 11 could not see

Ticket 11 correlated the drift with `openAfter` non-empty. That is a **proxy**.
The actual requirement is:

> the stale anchor must **survive the mutation**, and **content above it must
> change**.

Three configurations were run:

| config | anchor at sweep | outcome |
|---|---|---|
| all sections expanded | deep item in a section the sweep collapses | `mvcp:lost` — key stops resolving, **no correction**, no drift |
| head collapsed, rest expanded | `row-` item near the top | anchor survives but **`oldY === newY` exactly** — nothing above it changed, `diff 0`, no drift |
| **early band expanded, late sections collapsed** | `row-`/`header-` item **deep**, in an already-collapsed section | anchor survives **and** the expanded band above it is swept away → **`diff ≠ 0` → DRIFT** |

⚠ This is why the bug is hard to hit in practice and why ticket 11's matrix could
not isolate it. At offset 0 the sections *above* a near-top anchor are visible by
definition, so the sweep **keeps them open** and content above the anchor cannot
shrink. The drift needs the anchor to be **deep and surviving** — which only
happens when there is expanded content above a collapsed region.

Reproduction rate in the third configuration: **4 of 6** master jumps.
In the other two configurations: **0 of 14**.

### 3. ⚠ Two consequences, not one

- **Positive drift** → `atTop` false → back stops backgrounding. Ticket 11's F-H.
- **Negative drift** (all three reproductions here) → `atTop` stays *true*
  (`offset <= firstItemOffset`, and −978 ≤ 38), so the ladder still exits — **but
  the follow-up sweep then runs at a negative offset with an empty visible set**:

      #684 sweep {"offset":-978.5,"visible":[],"openAfter":[],...}

  which by `computeRemainingOpen`'s `open`-iterating shape (ticket 09 F1) is a
  **collapse-EVERYTHING** — it wiped the Agatha Christie / Andy Weir that ticket
  04's "keep what's at the top" ruling exists to protect. **Ticket 09's hazard is
  reachable in production, via this drift.** Ticket 11 F-F's "the resting offset
  can legitimately be negative" is now load-bearing for a second reason.

⚠ **Honest limit:** both of ticket 11's drifts were **positive**; all three
reproduced here were **negative**. Same `scrollBy(diff)` correction, opposite
sign, and the positive case's exact geometry was **not** reproduced. The fix
suppresses the correction outright, so it covers both signs — but the sign
asymmetry is not explained, and **F-I is therefore neither confirmed nor
refuted**: no evidence of `getLayout` estimation error appeared (`oldY === newY`
to full float precision in every non-drifting correction).

### 4. The fix, and the device A/B

    // in sweepIfAtTop, immediately before setActiveGridSections:
    list.prepareForLayoutAnimationRender();

Sets `animationOptimizationsEnabled`, which is checked at the `scrollBy` guard
(`useRecyclerViewController.tsx:181`); FlashList clears it itself in
`onCommitEffect` (`RecyclerView.tsx:627`). **One commit, self-clearing, public
API, no timer, no constant, no coupling to the 100 ms debounce.** Cost: recycling
is disabled for that single commit — a handful of extra cell mounts, at the top
of the list, once per back press.

| | trials | drifted | corrections applied |
|---|---|---|---|
| fix **off** | 6 (reproducing config) | **4** (−978.55, −1803.89, −617.20, −1812.34) | yes, `diff` == drift |
| fix **on** | 16 (variant B) + 4 (variant A) | **0** | **0** |

Verified on **both variants**; the shipping variant A is clean 4/4.

### 5. Does the spec ship without it?

**No — and it does not have to.** The driver raised the fair question of whether a
hard-to-reproduce, low-severity bug justifies significant overhead. It does not,
and this fix does not ask for any: it is **one line and one type member**, uses a
documented FlashList method, adds no state, no timer and no ordering assumption,
and leaves every prior ruling intact — ticket 04's "keep what's at the top",
charting decision 2's "no counter, no timer", and ticket 03's predicate all stand
unchanged. Ticket 03's invariant stops being an assumption and becomes enforced.

Candidates 2–5 from session 1 are all **rejected**: 2 couples to a private
constant, 3 gives up MVCP for background library mutations, 4 contradicts
charting decision 2, 5 overturns ticket 04.

### 6. What the spec must carry

1. The one-line call, **with the comment explaining why** — it is a no-op to a
   reader who does not know about the anchor race, and is exactly the kind of
   line a future cleanup deletes.
2. Ticket 03's invariant restated: *"at the top the anchor is index 0 and
   `diff === 0`" holds only because the sweep suppresses the correction* — it is
   **not** true of the raw arrival.
3. Ticket 09's `computeRemainingOpen` hazard is **live**, not theoretical: a
   sweep at a negative offset has an empty visible set and collapses everything.
   The spec should either gate the sweep on `offset >= 0` or make
   `computeRemainingOpen` iterate `visible`.
4. ⚠ The FlashList probe patch (`patches/@shopify+flash-list+2.3.2.patch`) and
   the `12 · seed` chip are **throwaway** and must die with this branch. They must
   never reach `main`.

### 7. Reproduction recipe (for whoever needs it again)

Config: **Recents collapsed, sections 1–8 expanded, everything after collapsed.**
Fling into the deep *collapsed* territory (~16 hard flings, `input swipe 720 2900
720 300 50`), then a final hard fling with back pressed ~200 ms into the glide.
Harness: `.scratch/library-back-ladder/` ticket 12 notes + `12 · seed` chip.
