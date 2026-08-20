# 11 — Run the Android 16 device tests the research could not settle

Type: task
Status: claimed
Blocked by: 05
Parent: [map.md](../map.md)

## Question

**Confirm on a real targetSdk 36 / Android 16 device the five behaviours ticket 01
verified in source but could not observe.**

Ticket 01 answered the mechanism question with high confidence *from source*, and
was explicit about the line it would not cross: **no user-visible animation outcome
was asserted**, and IME back priority sits outside the app's dispatcher entirely.
Those are device facts. This ticket collects them.

Blocked by ticket 05 because DT-2/3/4 need a build with the ladder actually in it.
**DT-1 and DT-5 need no code change and run on today's build** — whoever is on a
device first should run them and record the result here rather than waiting.

## How to run

**Prototype branch: `proto/back-ladder-rung-ab`.** The ladder lives there and
nowhere else — `main` has no ladder in `src/`. The branch is level with `main` on
code; it is behind only on `.scratch/` docs.

⚠ **Findings are recorded on `main`, in this file.** The branch carries a stale
copy of this ticket from before tickets 07/08/09 resolved. Do not write results
into it — they would be lost when the throwaway branch is deleted.

    git checkout proto/back-ladder-rung-ab     # to build
    git checkout main                          # to record

### Reading the probe

Five tests (DT-2, DT-6, DT-8, DT-9, DT-10) are phrased as "log X and confirm".
The ticket-05/06 prototype logged nothing, so a probe was added
(`src/helpers/ladderProbe.ts`, commit `49c54dc`). Every event is one line:

    [DT] #<seq> <event> {json}

    adb logcat -c && adb logcat -s ReactNativeJS:V | grep --line-buffered DT

| event | fires when | carries |
|---|---|---|
| `back` | back handler entered, **before any guard** | `offset`, `firstItemOffset`, `drawer`, `toggleView`, `variant`, `jump` |
| `back:decline` | press handed to Android | `reason`: `drawer` / `no-list-ref` / `at-top` |
| `back:rung` | intermediate rung taken | `from`, `target`, `animated` |
| `back:master` | master-top jump taken | `from`, `animated` |
| `momentumEnd` | momentum/animator settle | `offset`, `firstItemOffset` |
| `dragEnd` | finger lift | `vy`, `gated` |
| `sweep` | collapse ran | `visible`, `openBefore`, `openAfter`, `collapsed` |
| `sweep:skip` | sweep gated off a non-sectioned view | `toggleView` |
| `rest` | **"11 · probe" chip tapped** | `view`, `offset`, `firstItemOffset`, `atTop` |

**The `#seq` counter is the point.** It makes "fires exactly once" (DT-10) and
"never fires" (DT-2) *observable* rather than inferred from an absence — a gap in
the numbers means logcat dropped a line, not that the event did not happen.

### The three on-screen chips (bottom left)

| chip | does |
|---|---|
| `11 · probe` | logs a `rest` line for the currently mounted view (DT-8/DT-9) |
| `05 · A/B` | flips 3-rung ↔ 2-rung |
| `06 · animated/instant` | flips jump style |

### Two builds, and why

- **Build A — debug + Metro.** Everything log-driven or purely behavioural. JS
  reload is instant, so a surprise can be re-probed without a rebuild.
- **Build B — `--profile preview`.** Only the three *visual-judgment* tests
  (DT-11, DT-13, DT-15). A debug build changes frame cost, so it is exactly the
  build that lies about smear and settle-jitter. Judging those on debug would
  produce a confident wrong answer.

## Run sheet

Ordered so the two **design-invalidating** tests run early: if DT-3 or DT-4 fails,
stop — the rest of the sheet is measuring a design that needs redrawing first.

### Build A — `proto/back-ladder-rung-ab`, debug + Metro

| # | test | why here |
|---|---|---|
| 1 | **DT-8** | cheapest, and calibrates every later reading |
| 2 | **DT-3** ⛔ | **design-invalidating** — the RN 0.83 latch. Fail = stop. |
| 3 | **DT-4** ⛔ | **design-invalidating** — drawer ordering. Fail = ticket 02 reopens. |
| 4 | **DT-1** | peek animation; independent of the ladder |
| 5 | **DT-2** | cancelled gesture must produce **no** `back` line |
| 6 | **DT-5** | IME must beat the ladder |
| 7 | **DT-7** | modal blur — player (`formSheet`), `titleDetails`, `chapterList` |
| 8 | **DT-6** | ref freshness mid-fling; run on a **populated** view (see the DT-9 refinement) |
| 9 | **DT-9** | empty-list reading, via a no-results search |
| 10 | **DT-10** | `momentumEnd` exactly once, `offset: 0` |
| 11 | **DT-12** | downward flick at top → `dragEnd {gated: false}`, no `sweep` |
| 12 | **DT-14** | `animator_duration_scale 0.0`, **then restore** |

⚠ **DT-14 is last in Build A for a reason.** It sets the OS animator scale to 0.
Any motion judgement taken while it is still 0 is worthless — an animated jump is
indistinguishable from an instant one. Restore before Build B:

    adb shell settings put global animator_duration_scale 1.0
    adb shell settings get global animator_duration_scale   # must print 1.0

### Build B — same branch, `--profile preview`

Confirm the animator scale reads `1.0` before starting.

| # | test | why here |
|---|---|---|
| 13 | **DT-15** | rung landing must clear the search bar (the fix is unverified on device) |
| 14 | **DT-11** | sweep visually silent |
| 15 | **DT-13** | animated jump at the far end of the largest library |

### Not runnable, and why

- **DT-8's `BooksList` number (predicted 50).** `BooksList` is mounted **nowhere**
  in the app — zero references outside its own file — so there is no path on which
  to measure it. Ticket 09 already makes it uniform in the *implementation*; it
  cannot be measured from this prototype without mounting dead code. DT-8's own
  note says a wrong table "costs nothing structurally" because the predicate reads
  the value at runtime, so this is deferred, not lost. Expect **three** numbers
  from DT-8 (BooksHome / SeriesHome / BooksGrid), not four.

## Notes from instrumenting (2026-08-20)

Not device findings — these came out of preparing the build, and both are for
ticket 10 to carry into the spec.

- **Ticket 09's F1 has teeth, and it bites the moment a second view is wired.**
  DT-8/DT-9 need per-view numbers, so the shared `listRef` had to go on
  `SeriesHome` and `BooksGrid`. That alone activates the **sweep** on those views
  — and `sweepIfAtTop` matches `sectionRangesRef` (written only by `BooksHome`,
  and per ticket 09 **never cleared**) against the new view's indices. Because
  `computeRemainingOpen` iterates `open` rather than `visible`, the resulting
  mismatched set is a **collapse-everything**, not a no-op: arriving at the top of
  `SeriesHome` would silently wipe every `BooksHome` section the user had
  expanded. The prototype now carries ticket 09's `SECTIONED_VIEWS` gate for this
  reason. **The spec should state the gate as load-bearing, with this failure as
  its justification** — written as tidiness it is exactly the kind of guard a
  later refactor deletes.
- **`BooksList` cannot be measured from this prototype.** It is referenced
  nowhere in `src/`, so DT-8 returns three numbers, not four. See "Not runnable".

## Results

Fill in as they are run. `—` = not yet run.

| test | result | device / build | note |
|---|---|---|---|
| DT-1 | — | | |
| DT-2 | — | | |
| DT-3 ⛔ | — | | |
| DT-4 ⛔ | — | | |
| DT-5 | — | | |
| DT-6 | — | | |
| DT-7 | — | | |
| DT-8 | — | | expect 3 of 4 views |
| DT-9 | — | | |
| DT-10 | — | | |
| DT-11 | — | | Build B |
| DT-12 | — | | |
| DT-13 | — | | Build B |
| DT-14 | — | | restore scale after |
| DT-15 | — | | Build B |

## The tests

- **DT-1** — Edge-swipe and *hold* at ~50% on the library screen. Confirm **no
  back-to-home peek animation** plays. Ticket 01 predicts none ever plays, on any
  press, because RN's callback is registered at androidx priority `0` and RN
  overrides neither `handleOnBackStarted` nor `handleOnBackProgressed`. *(Runnable
  now, no code change.)*
- **DT-2** — Instrumented build: **start a back gesture, then cancel it.** Confirm
  **no `hardwareBackPress` event fires**. Ticket 01 predicts RN no-ops
  `onBackCancelled`, so JS never sees an abandoned swipe — if it does, the ladder
  would fire on a gesture the user deliberately aborted.
- **DT-3 — the latch test.** Scroll down → back (list jumps to top) → back
  (app backgrounds) → reopen → open the player screen → **back must POP, not
  background.** Run **five rounds in one process**, alternating gesture and button.
  This is the sharp confirmation that consume/decline interleaving never re-arms the
  RN 0.83 latch. Note the memory topic `android-back-latch-rn083` records the
  distinguishing signature: backgrounding via HOME never breaks back; backgrounding
  via BACK is what used to break it.
- **DT-4 — drawer ordering.** Open the drawer with the list scrolled down and press
  back: the **drawer must close and the list must not move**. Then force a re-render
  while the drawer is open and repeat — this is the case RISK 1 predicts can break if
  the handler re-registers above the drawer's.
- **DT-5** — Keyboard up (search focused) with the list scrolled down: back must
  **dismiss the IME only**, leaving scroll position untouched. *(Runnable now, no
  code change — the current build has no ladder, so this establishes the baseline.)*

## Why it is a ticket and not a checklist item

DT-3 and DT-4 can each independently invalidate the design. DT-3 failing means the
latch argument is wrong and the feature is not implementable as specified. DT-4
failing means the drawer guard from RISK 1 is insufficient and ticket 02's answer
needs revisiting. Both outcomes redraw parts of the map, so they are decisions, not
verification chores.

## Deliver

Per test: pass/fail, the device and Android build, and — for any failure — what it
implies for the tickets it feeds back into (01's conclusion, 02's guard, 06's
feedback constraint). Record the results in the Answer here; the spec's risk section
(ticket 10) reads from it.

## Added by ticket 02 (resolved 2026-08-18)

Two more tests, both arising from ticket 02's ownership answer. Neither can
invalidate the design the way DT-3/DT-4 can — they verify assumptions ticket 02
made from source but could not observe.

- **DT-6 — FlashList ref freshness at press time.** Ticket 02 decided the ladder
  **tracks no scroll state** and instead reads
  `listRef.current.getAbsoluteLastScrollOffset()` synchronously in the back
  handler. The implementation is a plain field read
  (`RecyclerViewManager.ts:198`), but it was never observed under New
  Architecture. Fling the list, and **press back while momentum is still
  running**; confirm the value read is the live offset, not a stale one from
  before the fling. Then repeat immediately after a `toggleView` switch (no
  scrolling at all) and confirm the freshly-mounted list reports **0**, so back
  backgrounds the app rather than consuming the press. *If DT-6 fails, ticket
  02's decision 4 reverts to the tracked `scrollYRef` — and the reset-on-toggle
  logic in F2 becomes mandatory.*
- **DT-7 — modal blur releases the handler.** Ticket 01 flagged as INFERRED, and
  ticket 02 sharpened from the router tree, that pushing a `formSheet` /
  `transparentModal` blurs the library screen and so removes the ladder's
  handler. All such routes are siblings of `(drawer)` on the **root** stack
  (`src/app/_layout.tsx`), so the blur propagates down to `index`. **Verify by
  behaviour:** with the library scrolled down, open the player (`formSheet`) and
  press back — the sheet must dismiss and the list must **not** jump to the top.
  Repeat with `titleDetails` and one `transparentModal` route (`chapterList`).
  *If DT-7 fails, the ladder is eating a press meant for the sheet, and ticket
  02's installation site needs an additional guard.*

## Added by ticket 03 (resolved 2026-08-18)

Two more, both confirming numbers ticket 03 derived from FlashList 2.3.2 source
but could not observe — the repo's jest environment is jsdom with no native
renderer, so `measureLayout` returns nothing meaningful and neither value is
testable off-device.

- **DT-8 — the resting offset and the per-view `firstItemOffset`.** With each view
  mounted and settled at visual top, log `listRef.current.getAbsoluteLastScrollOffset()`
  and confirm it reads **0** — ticket 03 establishes that the `SEARCH_BAR_HEIGHT`
  spacer is content, not an origin shift. Then log
  `listRef.current.getFirstItemOffset()` on each and confirm the predicted
  **38 / 44 / 38 / 50** for BooksHome / BooksGrid / SeriesHome / BooksList. The
  BooksGrid **44** is the interesting one: it predicts that `style={styles.container}`'s
  `paddingTop: 6` lands on the outer `CompatView` that `firstItemOffset` is measured
  relative to, and so counts — unlike BooksHome's and SeriesHome's `paddingTop: 8`,
  which sit on wrapper `View`s outside FlashList and must not. *Failing DT-8 costs
  nothing structurally: the predicate reads the value at runtime rather than
  hardcoding it. It would only mean the table in ticket 03 is wrong, not the design.*
- **DT-9 — the empty-list reading (F1), the finding the predicate turns on.** Type a
  search that matches nothing, so the list renders its `ListEmptyComponent` ("No books
  found" / `seriesEmptyText`). With the view visually at the top, log
  `getAbsoluteLastScrollOffset()` and confirm it reads **`firstItemOffset` (38–50), not
  0** — ticket 03 traces this to `modifyChildrenLayout` returning early on
  `dataLength === 0`, so `applyInitialScrollAdjustment` never runs and the tracker
  keeps its initializer. Then clear the search and confirm it self-heals to 0.
  *This is the case that makes a literal `> 0` predicate unshippable — under it the
  ladder would arm on every no-results search and back would never background the
  app. Worth one real observation. If DT-9 shows 0 instead, the `getFirstItemOffset()`
  threshold is still correct and still free, but its main justification weakens to the
  mount-window case alone.*

⚠ **Refines DT-6.** DT-6 asks that a freshly-mounted list report **0** after a
`toggleView` switch. Per DT-9 that holds only when the new view has **data** — a
freshly-mounted *empty* view reports `firstItemOffset` and is still correctly "at
top" under ticket 03's predicate. Run DT-6 on a populated view, or it will read as
a false failure.

## Added by ticket 04 (resolved 2026-08-18)

- **DT-10 — confirm the animated jump self-signals arrival.** With
  `scrollToOffset({offset: 0, animated: true})` as the back action, log inside
  `onMomentumScrollEnd` and verify it fires exactly once at the end of the
  programmatic jump, with `getAbsoluteLastScrollOffset()` reading `0`. This is the
  one link in ticket 04's §3 chain that crosses the JS/native boundary
  (`mSendMomentumEvents` being enabled by RN because FlashList spreads
  `onMomentumScrollEnd` onto the ScrollView), and the whole "animated needs zero
  arrival machinery" conclusion rests on it. ⚠ If it fails, check the device's
  system animation scale first — a scale of 0 makes the smooth-scroll duration 0
  and would explain a missing momentum event without disproving the mechanism.
- **DT-11 — confirm the sweep is visually silent.** With several author sections
  expanded and Recents collapsed, back-jump from deep in the list; verify nothing
  on screen moves at the moment of the sweep (only the scrollbar shrinks), then
  scroll down to confirm those sections are in fact collapsed. This is the
  observable form of ticket 04's invariant.
- **DT-12 — confirm the drag-end velocity gate.** At the top, flick **downwards**
  and verify no collapse fires at finger-lift. The at-top predicate is true at the
  *start* of a downward fling, so the `|velocity.y| < 0.01` gate — not the at-top
  guard — is what excludes this case.

## Added by ticket 06 (resolved 2026-08-18)

Ticket 06 chose the **animated** jump on device evidence (preview build, real library,
`BooksHome`). Neither item below is a decision — both are confirmations of a settled
choice, and DT-14 covers a path the driver's test could not have exercised.

- **DT-13 — the animated jump at the extreme end of library scale.** The smear was
  ticket 06's central risk and did not decide against animated, but it was judged on one
  library. Android's smooth scroll runs for a device-constant ~250 ms *regardless of
  distance*, so a longer jump is **faster**, not longer — consecutive frames share no
  visible cells and FlashList's recycling buys nothing. Scroll to the **far end** of the
  largest available library with several sections expanded, then press back. Confirm no
  sustained placeholder smear, no settle-jitter, and no late re-layout after the jump
  lands. A failure here does **not** reopen ticket 06; it promotes the **two-stage jump**
  (instant to within a screenful, then animate the last leg), which ticket 06 left
  unbuilt as the only surviving lever.

- **DT-14 — reduced motion, which is handled by *not* handling it.** Ticket 06 traced the
  jump to a platform `ObjectAnimator` (`ReactScrollView.java:100`), so the OS animator
  scale governs it and the ladder consults nothing. Verify:

        adb shell settings put global animator_duration_scale 0.0

  The back jump must become **instant**, and the collapse sweep must **still fire** on
  arrival — `onAnimationEnd` fires at duration 0, so `dispatchMomentumEndOnAnimationEnd`
  still emits momentum-end, which is the sweep's trigger. If collapse fails here, the
  ladder is silently broken for every user who has "Remove animations" enabled in
  Accessibility, which is a real accessibility defect and not an edge case. Restore with
  `... animator_duration_scale 1.0` afterwards.

  ⚠ **This also gates any future A/B on this axis**: at scale `0.0` an animated arm is
  indistinguishable from an instant one, so always read the scale before trusting a
  motion comparison on a device.

## Added by ticket 05 (2026-08-18)

> ⚠ **Renumbered 2026-08-20.** Ticket 05 appended this as "DT-13", but ticket 06
> had already taken that name for the library-scale smear test. Two different
> tests, one name, in an append-only file. This one is **DT-15**; ticket 06's
> DT-13 is unchanged. Nothing else moves.

- **DT-15** — **confirm the corrected rung landing clears the search bar.** Scroll
  deep inside a large expanded author section and press back. The section header
  must settle **below** the search bar, in the same slot the first item occupies at
  master-top — not underneath it. The first device run hit exactly this occlusion,
  caused by the rung landing at `y + firstItemOffset` (viewport top) instead of
  plain `y` (content top). Fixed on `proto/back-ladder-rung-ab`; unverified on device.
