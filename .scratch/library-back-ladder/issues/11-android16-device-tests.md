# 11 — Run the Android 16 device tests the research could not settle

Type: task
Status: resolved
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
| DT-1 | **PASS** | Pixel 7 Pro / A16 | no peek; system chevron ≠ peek — see F-D |
| DT-2 | **PASS** | Pixel 7 Pro / A16 | cancelled gesture emits no event at all |
| DT-3 ⛔ | **PASS** | Pixel 7 Pro / A16 | 5 rounds, 1 process, latch never re-armed |
| DT-4 ⛔ | **PASS** | Pixel 7 Pro / A16 | drawer consumes upstream; guard never reached |
| DT-5 | **PASS** | Pixel 7 Pro / A16 | IME consumes upstream; offset untouched |
| DT-6 | **PASS** | Pixel 7 Pro / A16 | both halves; fresh SeriesHome read 0 |
| DT-7 | **PASS** | Pixel 7 Pro / A16 | all 3 routes; no `back` line, no jump |
| DT-8 | **PASS** | Pixel 7 Pro / A16 | 38 / 38 / **44** all exact; BooksList unmeasurable |
| DT-9 | **REFUTED** | Pixel 7 Pro / A16 | reads **0**, not `firstItemOffset` — see below |
| DT-10 | **PASS, amended** | Pixel 7 Pro / A16 | once when clean, **twice** when interrupting a fling |
| DT-11 | **PASS** | Pixel 7 Pro / A16 | both halves; driver confirmed visually |
| DT-12 | **PASS** | Pixel 7 Pro / A16 | gate proven load-bearing; see F-A |
| DT-13 | **PASS** | Pixel 7 Pro / A16, **preview build** | 41,226 px jump; driver: "that looked great" |
| DT-14 | **PASS** | Pixel 7 Pro / A16 | sweep still fires at scale 0 |
| DT-15 | **PASS** | Pixel 7 Pro / A16 | header lands clear of the search bar |

**Run 1 rig.** Pixel 7 Pro (`cheetah`), Android **16** / SDK **36**, build
`CP1A.260405.005`, **gesture navigation**, animator scales all `1.0`. Debug build
+ Metro on `proto/back-ladder-rung-ab` @ `49c54dc`, real library of **355 books**,
variant **A (3-rung)** + **animated**. Driver drove the device; the agent drove
`adb` and read the probe stream. Raw log: `dt.log` in the run's scratch dir.

### DT-3 — the latch, in detail

Five rounds alternating **gesture** and **button**, all in **one process**
(PID `21735` from first press to last, never changed — `moveTaskToBack`, not a
kill). Ten consume/decline transitions and five back-to-background cycles.
**Every press produced a `[DT] back` line**: `#17/18`, `#21/22`, `#27/28`,
`#31/32`, `#37/38`, `#41/42`, `#47/48`, `#51/52`.

The latch's signature (memory `android-back-latch-rn083`) is that back stops
reaching JS at all, so an unbroken run of `back` lines across interleaved
consume/decline **is** the test — sharper than the ticket's "back must pop"
phrasing, because it observes the mechanism rather than a navigation outcome.
Ticket 01's path-independence argument holds on device.

Gesture and button produced **identical** events, confirming ticket 01's
"gesture and button converge on one event".

### DT-9 — REFUTED, and what it costs

Ticket 03 F1 predicts an empty list reports `firstItemOffset` (38) **permanently**
while visually at top, because `modifyChildrenLayout` returns early on
`dataLength === 0` so `applyInitialScrollAdjustment` never runs.

**Three independent empty states all read `offset: 0`:**

| empty state | reading |
|---|---|
| no-results search (`zzzqqqxyz`) from a scrolled list | `{offset: 0, firstItemOffset: 38, atTop: true}` |
| search cleared (self-heal check) | `{offset: 0, firstItemOffset: 38, atTop: true}` |
| `Finished (0)` tab — genuinely empty data | `{offset: 0, firstItemOffset: 38, atTop: true}` |
| `Playing (0)` tab — genuinely empty data | `{offset: 0, firstItemOffset: 38, atTop: true}` |

**What this does and does not change.** It does **not** break the design: the
predicate is `offset <= firstItemOffset`, and `0 <= 38` is true, so the ladder
still correctly declines and back still backgrounds the app on an empty list.
DT-9 anticipated this outcome — "the `getFirstItemOffset()` threshold is still
correct and still free, but its main justification weakens to the mount-window
case alone."

**So ticket 03's headline argument needs restating.** The spec must **not** claim
"a literal `> 0` cannot ship because an empty list reports 38 forever" — that did
not reproduce. `getFirstItemOffset()` is still the right predicate (free,
per-view, no constant), but it is now justified by the mount-window case and by
being structurally exact, not by the empty-list case.

⚠ **Residual.** None of the four states is strictly a *fresh mount* of an
already-empty list — the component stayed mounted and only its data changed. A
true cold mount with empty data (empty library at launch, or a `toggleView`
switch while a no-results search is active) is untested. If the spec wants to
lean on the empty-list case at all, that is the variant to run.

### DT-10 — PASS, amended: "at least once", not "exactly once"

Clean back press from a settled list, three contiguous sequence numbers:

    #8  back:master {"from":6421.14,"animated":true}
    #9  momentumEnd {"offset":0,"firstItemOffset":38}
    #10 sweep       {"offset":0,...}

Momentum-end fired **once**, at **exactly 0**, with no arrival machinery — ticket
04 F3's JS/native crossing confirmed, and with it ticket 06's "animated needs zero
arrival machinery".

**But when back interrupts an in-flight fling, it fires twice:**

    #61 momentumEnd {"offset":0} / #62 sweep
    #63 momentumEnd {"offset":0} / #64 sweep

One event is the interrupted fling's animator being **cancelled** (ticket 04
already noted `dispatchMomentumEndOnAnimationEnd` fires on cancel), the other is
the programmatic smooth-scroll completing. The sweep therefore **runs twice**.

At offset 0 with the same visible set the second run is idempotent, so this is
currently harmless — but the spec should say the sweep fires **at least once** on
arrival and must be **idempotent**, rather than asserting exactly-once. ✅ **CONFIRMED IDEMPOTENT (2026-08-20).** The double pair finally reproduced
repeatedly — `#463/#466`, `#473/#476`, `#539/#542` — and in **every** case the
second sweep reported `collapsed: []`. The sweep is safely idempotent; the spec
still needs to say **at least once**, not exactly once.

### DT-8 / DT-6b — all three measurable views, all exact

| view | predicted | measured | resting offset |
|---|---|---|---|
| BooksHome | 38 | **38** ✅ | 0 |
| SeriesHome | 38 | **38** ✅ | 0 |
| BooksGrid | 44 | **44** ✅ | 0 |
| BooksList | 50 | *unmeasurable — mounted nowhere* | — |

BooksGrid's **44** is the one that carried an argument, and it holds:
`styles.container`'s `paddingTop: 6` does land on the outer `CompatView` that
`firstItemOffset` is measured against, while BooksHome's and SeriesHome's
`paddingTop: 8` sit on wrapper `View`s outside FlashList and correctly do not
count.

⚠ **This partially rescues ticket 03 from DT-9.** DT-9 removed the *empty-list*
justification for `getFirstItemOffset()`, but the **per-view variation**
justification is now confirmed empirically: 38 / 38 / **44**. A fixed epsilon
tuned on BooksHome would be wrong for BooksGrid by 6 px. The predicate keeps its
two strongest legs — per-view self-adjustment and the mount window — and loses
only the leg DT-9 tested.

**DT-6b passes.** The driver switched to SeriesHome without scrolling; the
freshly-mounted populated view read `{offset: 0, atTop: true}`, so back
backgrounds the app rather than consuming the press. Ticket 02 decision 4 (the
ladder tracks no scroll state) stands — no revert to a tracked `scrollYRef`, and
the reset-on-toggle logic in F2 stays unnecessary.

**The 2-rung ladder works on both non-sectioned views.** SeriesHome
(`#111/#112`) and BooksGrid (`#116/#117`) each took `back:master` with variant A's
rung correctly skipped, and each landed at exactly 0.

- **F-E — on this build the sweep gate is not what protects BooksGrid/SeriesHome;
  the missing prop wiring is.** No `momentumEnd` or `sweep:skip` line ever fired on
  either view, because the prototype passes them only `externalListRef` and
  `onScroll` — not `onMomentumScrollEnd`/`onScrollEndDrag`. So the
  `SECTIONED_VIEWS` gate added for this run was never even reached.
  ⚠ **This makes ticket 09's F1 more urgent, not less.** Ticket 09's shipping
  design wires `LadderListProps` **uniformly across all four views**, and at that
  moment the gate becomes the *only* thing standing between "user arrives at the
  top of SeriesHome" and "every BooksHome expansion is silently wiped". The hazard
  is latent today and goes live the instant the uniform contract lands.

### DT-15 — PASS. The corrected rung landing clears the search bar

Setup: 4 author sections expanded, Recents collapsed, scrolled mid-way into the
lowest expanded section (offset **30820**).

    #167 back:rung {"from":30820.29,"target":22445.95,"animated":true}
    #168 momentumEnd {"offset":22446}

The rung fired (**not** `back:master`), correctly detecting the viewport was
inside an expanded section. On the landing frame the "Terry Pratchett" header sits
**below** the search bar — search bar ≈ y 312–396, header ≈ y 466 — in the same
slot item 0 occupies at master-top. Ticket 05's fix (land on plain `y`, not
`y + firstItemOffset`) is confirmed on device; the occlusion the driver hit on the
first device run is gone.

⚠ **DT-15 does not need the preview build.** Whether a header is occluded is pure
layout, not frame cost, so the debug build answers it. Only DT-13 (smear) genuinely
requires `--profile preview`.

### DT-11 — the sweep is correct; visual silence still needs eyes

Second back press, from the rung's landing:

    #171 back:master {"from":22446,"animated":true}
    #172 momentumEnd {"offset":0}
    #173 sweep {"visible":["recentlyAdded","Agatha Christie","Andy Weir"],
                "openBefore":["Ben Aaronovitch","Bonnie Garmus","Brandon Sanderson","Terry Pratchett"],
                "collapsed":["Ben Aaronovitch","Bonnie Garmus","Brandon Sanderson","Terry Pratchett"],
                "openAfter":[]}

All four expanded sections collapsed; nothing visible was touched. **`visible` and
`openBefore` were disjoint** — every open section was below the fold — which is
ticket 04's structural invariant observed rather than argued. The post-jump frame
shows the list correctly at master-top with Recents directly below the search bar.

The full 3-rung ladder therefore works end to end on device: deep inside a section
→ section header → master-top + collapse-all → background.

- **F-F — the resting offset at the top can be NEGATIVE, so the predicate must stay
  an inequality.** Immediately after the sweep, `getAbsoluteLastScrollOffset()`
  read **`-59.476`** while the list was visually and correctly at the top (frame
  captured; no overscroll gap, Recents in its normal slot). The sweep mutates the
  list *at* offset 0 and MVCP's adjustment leaves the tracker slightly negative.
  The shipping predicate absorbs this — `-59.48 <= 38` is true, so back correctly
  backgrounds — but **the spec must not say "the resting offset at the top is 0"**.
  It is 0 on a settled list and can be negative after a sweep. Anyone later
  "tightening" the test to `offset === 0`, `Math.abs(offset) < eps`, or a
  strict-positive form would break the ladder in exactly the state the feature
  creates. State it as an invariant: **the at-top test is an inequality by
  necessity, not by style.**

### DT-11 — PASS, both halves, and two corrections to how it was written

Driver's run (`#224`–`#230`), 4 sections expanded, Recents collapsed:

    #225 back:rung   {"from":32388,"target":23032.90}
    #228 back:master {"from":23032.86}
    #229 momentumEnd {"offset":0}
    #230 sweep {"visible":["recentlyAdded","Agatha Christie","Andy Weir"],
                "openBefore":["Ben Aaronovitch","Brandon Sanderson","Dennis E. Taylor","Terry Pratchett"],
                "collapsed":[all four],"openAfter":[]}

`visible` and `openBefore` **disjoint** for the second independent time — no
visible section was ever collapsed. Driver's visual verdict: the list scrolls to
the top, cards settle with some fading in (ticket 07's known, approved cosmetic),
and the stable state is correct with all visible rows collapsed.

**Correction 1 — "only the scrollbar shrinks" is wrong and is struck.** All four
views set `showsVerticalScrollIndicator={false}`; this app has no scrollbar on any
list. The phrase entered in ticket 04 (`04-collapse-scroll-sequencing.md`) and was
copied into DT-11 unexamined. **The spec must not inherit it.**

**Correction 2 — "nothing on screen moves" needs its phase stated.** The driver
reasonably read it as covering the whole gesture, under which the feature's own
jump looks like a violation. The back press has two phases and DT-11 constrains
only the second:

1. **The jump** — the list visibly scrolls to the top. This *is* the feature.
2. **The sweep** — fires on arrival, strictly after the list settles (ticket 04).
   *This* is "the moment of the sweep", and the invariant is that already-visible
   content does not shift, because everything collapsed is below the fold.

The spec should phrase the invariant as **"the sweep never moves already-visible
content"**, not "nothing moves".

- **F-G — the at-top guard and the velocity gate are complementary, not
  belt-and-braces.** The driver's free scrolling produced finger-lifts as slow as
  `#176 {vy: -0.0147}` — only 1.5× the `0.01` threshold. A slightly slower lift
  would pass the gate mid-list; that is harmless **only** because `sweepIfAtTop`
  independently checks at-top and returns early. Conversely F-B/DT-12 showed the
  at-top guard alone admits a fling leaving the top. **At-top excludes mid-list
  lifts; velocity excludes leaving-the-top. Neither alone is sufficient**, and the
  spec should say so — a reader can easily mistake the velocity gate for a
  redundant safety net and drop it.

### DT-7 — PASS on all three modal routes

Driver opened and backed out of the **player** (`formSheet`), **titleDetails**
(`formSheet`) and **chapterList** (`transparentModal`) from a scrolled library.
Confirmed visually: all three opened, each dismissed on back, and the list stayed
put behind every one.

Log corroborates from the other side: across the whole modal sequence **no `back`
line was emitted at all**, and the offset stayed in the 24,955–27,042 band
(`#295`–`#310`). Had the ladder eaten a press meant for a sheet there would be a
`back` + `back:master` pair and the offset would drop to 0.

Ticket 01's INFERRED claim and ticket 02's sharpening are confirmed: these routes
are siblings of `(drawer)` on the **root** stack, the blur propagates down to
`index`, and `useFocusEffect` tears the handler down. **No additional guard is
needed at the installation site.**

⚠ Note on evidence shape: absence of a `back` line is on its own consistent with
"the sheets never opened", so this result rests on the driver's visual
confirmation *plus* the unchanged offset — not on the log alone.

**A second independent DT-6 confirmation** arrived unprompted in the same run:
`#293 back {"offset":31348}` when the last settled reading was `#291 {25795}` —
the handler read a live offset 5,553 px beyond the last momentum-end, mid-fling.

## ⛔ F-H — THE SWEEP MOVES THE LIST, AND THE LADDER LOSES ITS TERMINAL RUNG

**This is the one device finding that invalidates part of the design as specified.**
No DT asked for it; it surfaced because the driver noticed the screen "landed at an
offset" after a run and refused to accept it.

### The symptom

After a back-jump whose sweep actually collapses something, the list does **not
rest at the top**. It lands at 0, the sweep fires, and the offset then drifts:

    #350 back:master {"from":29145.14,"animated":true}
    #351 momentumEnd {"offset":0}                        <- landed correctly
    #352 sweep {"collapsed":["Brandon Sanderson","Jim Butcher",
                             "James Islington","Jonathan Stroud","Terry Pratchett"],
                "openAfter":["Agatha Christie"]}
    #353 rest  {"offset":213.71,"atTop":false}           <- drifted off the top

Visually: the search bar is gone, a clipped author header sits at the top of the
screen, and Recents is scrolled past.

### Why it breaks the design

`atTop` is now **false**, so the *next* press does not background the app —
it consumes the press and jumps to the top all over again:

    #354 back {"offset":213.71}
    #355 back:master        <- consumed; app stayed in the foreground
    #356 momentumEnd {"offset":0}
    #357 sweep {"collapsed":[]}   <- nothing left to collapse, so no drift
    #358 rest {"offset":0,"atTop":true}   <- only NOW is it at the top

| press | contract | actual |
|---|---|---|
| 1 | jump to top + collapse | lands at **213.71**, not 0 |
| 2 | **background the app** | jumps to top again |
| 3 | — | backgrounds |

**Three presses to exit instead of two — four under variant A's 3-rung ladder.**
Charting decision 2's "self-healing by construction" and the ladder's terminal
rung both fail here. The extra press is invisible to the user as anything but a
bug: the app "refuses" to close.

### Reproduction and scope

Reproduced **twice**, on separate runs, with playback stopped the second time.
⚠ The first run coincided with a book being in `Playing` — the driver confirmed
that book was started during the DT-7 modal test, **not** during this run, and the
clean repeat rules the confound out.

**Condition, from all four observed sweeps:**

| run | `visible` ∩ `openBefore` | `collapsed` | `openAfter` | resulting offset |
|---|---|---|---|---|
| `#173` | disjoint | 4 sections | `[]` | **-59.48** — harmless, still `<= 38` |
| `#315` | **overlap** | 4 sections | `[Agatha Christie]` | **+943.71** |
| `#352` | **overlap** | 5 sections | `[Agatha Christie]` | **+213.71** |
| `#357` | overlap | **none** | `[Agatha Christie]` | **0** — no drift |

Drift requires **both** an actual collapse **and** a visible section staying
expanded. Magnitude does not track the number collapsed (4 → 943, 5 → 213), so it
is a re-anchor, not an accumulation.

### ⚠ CORRECTION 3 (final) — distance is not sufficient either; the trigger is
### deep + mid-fling TOGETHER, and variant A could not be made to reach it

Distance-alone was tested and **refuted**: variant A, master jump from **38,417**
— deeper than either drift — from a settled list, collapsed 3 sections, landed at
**0**. A further run from **34,571** collapsing the 100+ book Pratchett section
also landed at **0**.

**Complete matrix, all ten master jumps with a real collapse:**

| run | variant | from | fling state | collapsed | result |
|---|---|---|---|---|---|
| `#313` | B | **31,507** | **mid-fling** (`vy -14.16`) | 4 | **+943.71 DRIFT** |
| `#350` | B | **29,145** | **mid-fling** | 5 | **+213.71 DRIFT** |
| `#896` | A | **38,417** | settled | 3 | 0 clean |
| `#999` | A | **34,571** | settled (fling died at list end) | 1 (Pratchett, 100+) | 0 clean |
| `#630` | A | 16,076 | settled | 3 | 0 clean |
| `#777` | A | 12,454 | **mid-fling** (`vy -9.52`) | 3 | 0 clean |
| `#537` | B | 11,222 | mid-fling | 3 | 0 clean |
| `#461` | B | 10,287 | mid-fling | 2 | 0 clean |
| `#548` | A | 7,647 | settled | 1 | 0 clean |

**Neither factor is sufficient alone.** Deep+settled is clean (twice). Shallow+
mid-fling is clean (three times). **Only deep AND mid-fling together has ever
drifted** — twice, both variant B.

### Why variant A could not be driven into that cell — a geometry finding

In variant A a deep position **inside an expanded section takes the rung**, not
master (confirmed: `#970 back:rung {from:31582, target:18444}` — an upward fling
from the tail re-entered Pratchett and the rung fired). So variant A's deep master
jumps can only begin from **collapsed** territory. With Pratchett expanded near the
end of the alphabet, the only deep collapsed territory is the **tail**, which is
the bottom of the list: a downward fling has no runway (`#997 momentumEnd` fired
instantly at the unchanged offset, the list already at max scroll) and an upward
fling immediately re-enters Pratchett.

**That is exactly why both drifts were variant B.** With no rung, *any* deep
position yields a master jump — including from **inside** expanded Pratchett, where
there are thousands of pixels of runway in both directions. The driver identified
this independently: "the two large depth jumps came from within the expanded Terry
Pratchett list."

⚠ **This does NOT clear variant A.** It is a property of *this* expansion pattern,
not of the variant. Expand a large section **early** with many collapsed authors
after it and variant A has deep collapsed territory with runway both ways — the
triggering cell becomes reachable. Combined with the code argument (identical bytes
on a master jump), the correct status is **untested, not immune**.

### Status at end of ticket 11

**REAL, reproduced twice, trigger narrowed to `deep + mid-fling + master jump`,
variant A untested for that cell.** Handed to [12](12-collapse-sweep-scroll-drift.md).

### ⚠ CORRECTION 2 — variant is NOT the cause; JUMP DISTANCE is the correlate

The driver proposed the defect is specific to the 2-rung variant (which does not
ship). **Tested and rejected, on two independent grounds.**

**1. The code paths are identical.** In `useBackToTopLadderPrototype.ts` variant
A's rung is an early-return block sitting *above* the shared master-top code:

    if (variantRef.current === 'A' && toggleViewRef.current === 0) {
      if (target !== null) { ...; return true; }   // rung
    }
    // falls through -- IDENTICAL for both variants
    list.scrollToOffset({ offset: 0, animated });

When the rung is skipped, variant A executes **byte-identical code** to variant B.
A variant-specific bug is mechanically impossible; the variant only changes *which
situations* reach a master jump.

**2. Variant A survived the full trigger condition.** Driven via adb with the
driver's hands off: variant A, hard fling (`dragEnd {vy:-9.52}`), back pressed
3,721 px into the glide, rung correctly skipped, 3 sections collapsed with
`openAfter:["Agatha Christie"]`:

    #777 back {variant:"A", offset:12454.86}   <- mid-fling
    #778 back:master
    #779 momentumEnd {"offset":0} / #780 sweep {collapsed:[3]}
    #781 momentumEnd {"offset":0} / #782 sweep {collapsed:[]}   <- double, idempotent
    #783 rest {"offset":0,"atTop":true}        <- NO DRIFT
    #784 back -> #785 back:decline {at-top}    <- app closed correctly

**The actual correlate is the distance of the master jump:**

| run | variant | jump from | collapsed | result |
|---|---|---|---|---|
| `#313` | B | **31,507** | 4 | **+943.71 DRIFT** |
| `#350` | B | **29,145** | 5 | **+213.71 DRIFT** |
| `#630` | A | 16,076 | 3 | 0 clean |
| `#777` | A | 12,454 | 3 | 0 clean |
| `#537` | **B** | 11,222 | 3 | 0 clean |
| `#461` | **B** | 10,287 | 2 | 0 clean |
| `#548` | A | 7,647 | 1 | 0 clean |

Both variants appear on the clean side; the split is **above ~29,000 drifts,
below ~17,000 clean**. Neither fling-interruption nor `openAfter` nor variant
survives as the discriminator — **distance does**, across all seven observations.

⚠ **This keeps the defect firmly in production scope.** Variant A reaches long
master jumps easily: a rung landing deep inside a large section followed by a
second press, or any deep scroll in a collapsed stretch. Offsets of **39,064**
were observed in this very session on the driver's 355-book library.

**Still to test: variant A, master jump from above ~29,000, with real collapses.**
That is the one gap between "reproduced twice" and "characterised". The band
between 17,000 and 29,000 is also unsampled.

### ⚠ CORRECTION (same session) — the first mechanism guess was REFUTED

The hypothesis below (drift requires a visible section to stay expanded) **was
tested and is wrong**. The driver ran variant A with exactly that condition and
the list did **not** drift:

    #630 back {variant:"A", offset:16076.57}  ->  #631 back:master
    #633 sweep {collapsed:["Ben Aaronovitch","Christopher Moore","Terry Pratchett"],
                openAfter:["Agatha Christie"]}
    #634 back {offset:0}  ->  #635 back:decline {at-top}   <- app closed correctly

    #548 back {variant:"A", offset:7647.14}
    #551 sweep {collapsed:["GraphicAudio"], openAfter:["Agatha Christie"]}
    #552 back {offset:0}  ->  #553 back:decline            <- app closed correctly

A non-empty `openAfter` alongside real collapses is therefore **not sufficient**.

**The surviving candidate is fling interruption, and it is not proven either.**
Both drifting runs interrupted a fling in progress; both clean variant A runs
pressed back from a fully settled list:

| run | variant | back pressed | drift |
|---|---|---|---|
| `#312` | B | **mid-fling** (31507 vs settled 27042), after `dragEnd {vy:-14.16}` | **+943.71** |
| `#349` | B | **mid-fling** (29145 vs settled 24053) | **+213.71** |
| `#548` | A | settled (7647.14 == `#547`) | none |
| `#630` | A | settled (16076.57 == `#629`) | none |

⚠ **But no single factor survives.** `#537` was variant B, mid-fling, collapsed 3
with `openAfter` non-empty — and did **not** drift (`#542 momentumEnd {0}`). And
`#560` was variant **A**, mid-fling, with a collapse — but the driver scrolled
before it could be probed, so its offset is **unknown**: the single most valuable
missing data point on the map.

`#312`'s fling was `vy -14.16`, roughly 3x the typical `-3`..`-5`, which raises a
**magnitude** explanation — how much momentum remains when the programmatic scroll
cancels it — rather than a mode. Untested.

**Status: the defect is REAL and REPRODUCED TWICE, but its trigger is NOT
characterised.** Do not record it as 2-rung-only; variant A has never been tested
under the condition that produces it, and pressing back while the list still
glides is an ordinary user action.

### Original mechanism guess (kept for the record — REFUTED above)

This fits `flashlist-2.3.2-mvcp-header-anchor`: with a visible section still open,
MVCP's anchor sits on an item whose **index** shifts when other sections collapse,
so MVCP issues a compensating `scrollBy` — moving the viewport it was trying to
preserve. When nothing visible stays open, the anchor is index 0 and `diff === 0`
— **exactly the case ticket 03 analysed and correctly declared safe**. Ticket 03's
reasoning was not wrong; it only ever covered the disjoint case, and nothing on
the map asked what happens when the sweep keeps a visible section open.

⚠ Note the interaction with ticket 04's driver ruling. "Keep what's at the top" is
what *creates* the non-empty `openAfter` that this defect depends on. The ruling
is not wrong, but it is load-bearing for the bug.

### What this does NOT invalidate

The jump, the rung, the collapse selection and the guards are all correct. DT-11
still passes: the sweep never collapsed a visible section, and every `collapsed`
list contains only below-fold sections. The defect is entirely in **where the list
comes to rest afterwards**.

### Hands off to a new decision

This needs a ticket of its own — the fix is a design choice, not a repair:
re-assert `offset 0` after the sweep (and ticket 04 has warnings about mutating
while scrolled), suppress MVCP for the sweep's mutation, change what the sweep
keeps open, or redefine the terminal rung. **Not decided here.**

### F-I — the rung can land a few rows PAST the header (observed once, not reproduced)

**Driver observation.** With Terry Pratchett (100+ books) expanded, scrolled to the
bottom of that section, settled, then back: the rung landed **partway through the
book cards, a few rows below the header** — not a sub-pixel offset, a real scroll
past a couple of cover rows.

**Not reproduced.** A subsequent attempt by the agent from the same position landed
**correctly**: `#1040 back:rung {from:33191.43, target:19812.571}` →
`#1041 momentumEnd {19812.572}`, with the header sitting below the search bar in
item 0's slot, search bar present. The driver also could not reproduce it.

⚠ **But there is an independent numeric corroboration.** With the *same* Terry +
Agatha expansion, Pratchett's header was computed as:

    #970  back:rung  target = 18,444.28
    #1040 back:rung  target = 19,812.57     <- same header, +1,368.29 px

Some of that gap is legitimate — Pratchett was collapsed and re-expanded in
between, and "(#9) Eric" left the Unplayed set when it started playing. But
**1,368 px is about two cover rows on this masonry grid**, which is a magnitude
match for what the driver saw. Two independent signals, one visual and one numeric,
pointing the same way.

**Why it matters.** Ticket 05's rung rests on the assertion that the header is
"ABOVE us and therefore already measured, so its layout is exact and a plain
`scrollToOffset` reaches it". If `getLayout(headerIndex).y` is **estimated rather
than measured** for a header 100+ items above the viewport, the rung lands
somewhere plausible but wrong — exactly this symptom. That assumption has never
been tested for a very long section.

**Status: open quirk, low frequency, not blocking.** Recorded so it is not
rediscovered from scratch. Folded into [12](12-collapse-sweep-scroll-drift.md),
which already owns the scroll-position family and may share a root cause.

### DT-13 — PASS on a real preview build, with the smear question answered by frames

Run on a **`--profile preview` release build** (versionCode **111**), real 355-book
library, **5 sections expanded including Terry Pratchett**, scrolled to
**41,226 px** — the deepest position reached in the entire effort and the literal
far end of the largest list. Driver watched live: **"that looked great."**

**Duration is distance-independent, confirmed on the shipping build:**

| jump | distance | `back:master` → `momentumEnd` |
|---|---|---|
| baseline | 20,818 px | **319 ms** |
| DT-13 | **41,226 px** | **288 ms** |

Twice the distance, **faster**. Exactly ticket 06's prediction: the jump is a
platform `ObjectAnimator` running a device-constant ~250 ms regardless of distance,
so a longer jump is not a longer smear window. **The two-stage jump fallback ticket
06 left unbuilt is confirmed unnecessary.**

**Frame analysis** (screen recording, 25 fps sample across the glide):

1. **~240 ms blank interval DURING the glide.** Roughly six consecutive frames show
   an essentially empty viewport. The jump is 288 ms, so the viewport is largely
   empty for most of it — FlashList does not render 41,226 px of intermediate
   content at that speed and draws nothing rather than stale cells. ⚠ **This is not
   smear in DT-13's sense** — smear means placeholder cells persisting *after*
   arrival. It is the glide itself, and the driver judged it good live.
2. **Brief cover fade-in AFTER landing** — the last transitional frames show the
   top row's covers still dark. This is ticket 07's known FastImage fade, already
   assessed and accepted.
3. **Nothing after that.** 24 frames spanning 800 ms post-landing are pixel-identical
   with fully-loaded covers: **no settle-jitter, no late re-layout.**

**This resolves the driver's "late re-layout" suspicion.** It is not a re-layout.
It is (1) the blank glide plus (2) the cover fade, both bounded, both complete
within ~500 ms of the press. Nothing re-lays-out after the list settles.

**Also confirmed on the release build:** `firstItemOffset` is still **38**; the
sweep collapsed six sections and the list rested at **`offset: 0, atTop: true`** —
**no drift**, in the `openAfter: []` disjoint case, matching the debug findings.

⚠ **Build note.** `metro.config.js` sets `drop_console: true`, which strips the
`[DT]` probe from release builds. It was **temporarily disabled** on
`proto/back-ladder-rung-ab` (commit `6bb4e24`) so this run could be measured rather
than only watched, then reverted. **That line must never reach `main`.**

## New findings (no DT asked for these)

- **F-A — an overscroll bounce at the top fires the sweep.** At offset 0, dragging
  *downwards* (finger down, overscrolling past the top) reports
  `dragEnd {vy: 0, gated: true}` — because the list cannot scroll past 0, so there
  is no velocity to report — and the sweep **runs**. A user who is already at the
  top and idly pulls down will collapse every off-screen expanded section. Whether
  that is wanted is a **product** call for the spec, not a bug: charting decision 4
  says the sweep fires on "any user-driven arrival at the top", and a bounce is
  arguably not an arrival.

- **F-B — DT-12's premise is direction-dependent, and only one reading is the real
  case.** "Flick downwards" was ambiguous. The *finger*-down reading is F-A above
  (vy 0, gated, sweeps). The *list*-direction reading is the real one and it
  **passes**: at `offset: 0` (`#72 rest {atTop: true}`), a fling that scrolls down
  into the list gave `#73 dragEnd {vy: -4.76, gated: false}` and **no sweep**. At
  finger-lift the at-top predicate was TRUE, so the at-top guard alone would have
  collapsed everything as the user flung away — **only the velocity gate prevented
  it**. The gate is confirmed load-bearing. The spec should state the direction
  explicitly.

- **F-C — neither the drawer guard nor any IME handling is ever exercised.** With
  the drawer open, back produced **zero** `[DT]` lines: React Navigation's drawer
  consumes it before RN's `BackHandler` chain reaches the ladder, so the ladder's
  own `drawerStatus === 'open'` guard is **never reached**. Same for the IME. Both
  guards are defence-in-depth, not the mechanism. Keep them (cheap, and they make
  the module self-contained per ticket 02 decision 5) but do not describe them in
  the spec as what makes the drawer/IME cases work.

  This also disposes of **DT-4's re-render half structurally**: `useDrawerStatus()`
  is consumed inside the ladder hook, so opening the drawer *necessarily*
  re-renders `LibraryScreen` — DT-4a already **was** the re-render case. With the
  mirror-ref design the handler can only re-register on **focus** change, never on
  re-render, so RISK 1's "re-registers above the drawer's" cannot fire.

- **F-D — DT-1 has a false-failure mode worth writing down.** The system's circular
  back **chevron** *does* appear at the left edge during the gesture (SystemUI's
  edge affordance, drawn on every gesture-nav app). What is absent is the
  **app-scaling peek** revealing the home screen behind — the held-at-50% capture
  shows the app full-screen, unscaled, unshifted. A re-run could see the chevron
  and wrongly record a fail.


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
  on screen moves at the moment of the sweep, then
  scroll down to confirm those sections are in fact collapsed.
  ⚠ **Corrected 2026-08-20:** this originally read "(only the scrollbar shrinks)".
  **There is no scrollbar** — all four list views set
  `showsVerticalScrollIndicator={false}`. The clause described something that does
  not exist in this app and has been struck. See the DT-11 result for the
  two-phase timing the test actually means. This is the
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
