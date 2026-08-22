# 08 — Device verification of the shipped ladder on a preview build

**What to build:** Confidence, not code. Everything in this feature that jest can never touch —
real layout measurements, whether an animated programmatic scroll really emits its arrival event,
the anchor correction, the animator scale, and every user-visible motion outcome — was passed on a
**throwaway prototype**, not on shipping code. The spec requires those checks re-run on the real
build before this feature is considered done.

Two notes on running them. **A preview build is mandatory for anything visual** — a debug build
serves assets over Metro, so asset behaviour is invisible. And **the sweep is visually silent by
design**, so "nothing happened" is the expected observation: confirm it by scrolling down
afterwards to find the sections collapsed, not by watching the moment of the sweep.

The original evidence rig, for comparability: Pixel 7 Pro, Android 16 / SDK 36, gesture navigation,
animator scales 1.0, against a real 355-book library.

This ticket is marked for a human because it needs a physical device, a preview build against a
real library, and judgement calls about how motion *feels* that no automated check can stand in
for.

⚠ **The new `rn` jest lane does NOT shrink this list.** Hooks and components became testable
(`docs/testing/jest-projects-and-rn-tests.md`), and tickets 05/06/07 now carry suites for their
wiring — but every item below needs real layout, a real fling animator, real momentum events or a
real 355-book library. In particular **FlashList has no layout manager under jest**, so nothing
here about visible ranges, offsets or drift can be pre-checked off-device. Treat a green suite as
a reason to *expect* these to pass, never as a substitute for running them.

Spec: Testing Decisions › "What jest will never cover here, and how it is accepted instead";
Risks R1, R3, R4, R6; user story 25.

**Blocked by:** 07.

**Status:** ready-for-human

---

## ⚠ Read before making the build — from ticket [10](10-branch-review-disposition.md)

**1. Leftover `[DT]` instrumentation in `node_modules` will contaminate the §E5 smear measurement
(F-11).** `node_modules/@shopify/flash-list/dist/recyclerview/hooks/useRecyclerViewController.js`
still carries the prototype's MVCP probe at lines ~121–128 and ~175–180 — a `console.log` +
`JSON.stringify` **on every MVCP correction attempt**. `patches/` is clean (seven patches, none for
FlashList), so **nothing ships to testers**. But `npm run android` and EAS preview builds bundle
from the local `node_modules`, so a build made on this machine right now carries it and a build made
after `npm ci` does not.

⚠ **Decide keep-or-remove BEFORE the deep-jump run, and record which state each measurement was
taken in.** The probe is genuinely the right tool for the drift A/B two boxes below — that is what
it was written for — so this is not automatically "delete it". What is not acceptable is
discovering mid-run that two measurements came from different binaries. To restore the pristine
file without a full `npm ci`: `npm pack @shopify/flash-list@<version>` into a temp dir and copy the
single file back.

**Driver decision, 2026-08-22: KEEP.** The probe stays in `node_modules` for this device pass — it
is the intended tool for the §G1–G4 drift A/B below, and `patches/` is clean so nothing ships to
testers regardless. **Every measurement in this ticket must therefore be taken WITH the probe
present** (i.e. against the current local `node_modules`, not a post-`npm ci` tree), so the whole
run is against one binary. Note the probe's `console.log` noise in any timing-sensitive
measurement's writeup, since it runs on every MVCP correction attempt.

**2. One new observation to make (F-7): does a slow drag DOWN into the list sweep?** The sweep's
at-top gate is `offset <= firstItemOffset` — a **38 px band, not a point**. In principle a
deliberate slow drag *down into* the list that stops inside that band and releases at ~0 velocity
passes both the at-top gate and the velocity gate, and sweeps — collapsing every below-fold
expansion at the moment the reader starts browsing downward.

This is **not** the bounce §F5 ruled on (that drag goes the other way, off the top), and §F5's
recorded lever — *"require the drag to have begun below the top"* — does not cover it, because this
drag begins at the top. §I2 is not violated, so the failure is **invisible** until the reader
scrolls down and finds their sections shut.

- [ ] **Slow-drag-down probe.** From rest at the top with several below-fold sections expanded, drag
      down ~20–30 px very slowly and release without flicking. Then scroll down and check whether
      those sections are still open. **A ruling of "unreachable by a human hand, accepted" is a fine
      outcome** — but make it a ruling, not an omission.

- [ ] **The latch test.** Scroll, back, back, reopen, push a screen, back must pop — five rounds in
      one process, alternating gesture and 3-button. Every press reaches JS. The signature of
      failure is back going dead entirely.
- [ ] **Momentum-end counts.** Once on a clean back press; twice on a press that interrupts a
      fling. Both harmless, because the sweep is idempotent.
- [ ] **Per-view first-item offsets, read not assumed.** Expect roughly 38 / 38 / 44 on the three
      mountable views. The fourth list's predicted value has never been measured by any device —
      measure it if it now mounts.
- [ ] **The rung landing against the search bar.** The header must be readable, not tucked under
      the overlay.
- [ ] **A deep jump on a preview build against a real library.** The open question is the smear —
      consecutive frames sharing no cells, so recycling buys nothing. It was not judged
      objectionable at real library scale; confirm that still holds on shipping code.
- [ ] **The overscroll bounce sweeps (F5).** At the top, pull down and release without dragging
      into the list, then scroll down to confirm the below-fold sections collapsed. This is the one
      observable that distinguishes "the platform reports velocity `0` for a bounce" from "it
      reports nothing at all" — an unreported velocity counts as **flinging** by design (spec §F5,
      amended 2026-08-21), so if it reports nothing the bounce-sweep silently never happens. A
      failure here is expected-and-harmless, not a defect: record it, do not weaken the gate.
- [ ] **Animator duration scale set to 0.** The jump is instant **and the sweep still fires.**
- [ ] **The drift recipe, fix on and fix off.** The reproducing configuration is: Recents
      collapsed, the first several sections expanded, everything after collapsed; fling deep into
      the collapsed region, then press back mid-fling. Expect drift with the fix removed and none
      with it in.
- [ ] **Drawer open, keyboard up, and each modal route.** Back does that thing and only that thing.
- [ ] Watch for the once-observed, never-reproduced rung overshoot (landing a few rows past the
      header). If it appears, the range-publication timing is the first suspect.
- [ ] Note the card reload after a collapse if it appears. It is **known, accepted and cosmetic** —
      do not fix it speculatively; the card component is used by every library list, so a change
      there has app-wide blast radius.
- [ ] Results recorded in this file under a `## Comments` heading, pass or fail, with the device
      and build profile named.

---

## Comments

### Session 1 — 2026-08-22, partial run; ABORTED EARLY BY A DEFECT

**Rig:** Pixel 7 Pro (`29131FDH3009SZ`), Android 16 / SDK 36, gesture navigation
(`navigation_mode=2`), animator/transition/window scales all `1.0`, real 355-book library.
Matches the original evidence rig exactly.

**Binary:** preview build, `versionCode=111`, installed 2026-08-22 02:33, built from branch head
`cb01b82` (01:38). **Probe present** in `node_modules/@shopify/flash-list`, per F-11's KEEP ruling.

⚠ **This binary is now STALE.** The defect below changes `src/helpers/ladderDecisions.ts`, so every
remaining checklist item must be re-run against a NEW preview build. Under F-11's ruling the whole
run must be against ONE binary, so the two items observed below are recorded as **provisional** and
re-run rather than banked.

#### D-1 — DEFECT, FOUND AND FIXED: back climbs one section per press

**Reported by the driver, then reproduced under `adb` and root-caused.** With several
**consecutive** sections expanded, the second back press landed on the next open section header
*above* instead of going to master top.

Observed chain (Agatha Christie, Andy Weir, Ben Aaronovitch all expanded; viewport mid-Aaronovitch):

| Press | Landed on | Expected |
|---|---|---|
| 1 | Ben Aaronovitch header | ✅ correct rung |
| 2 | **Andy Weir header** | ❌ master top |
| 3 | **Agatha Christie header** | ❌ master top |
| 4 | master top | ✅ |

**Root cause — a 38 px coordinate mismatch between the rung's question and its answer.**
`computeVisibleIndices()` samples from `offset - firstItemOffset`: `RecyclerViewManager.ts:117`
hands `EngagedIndicesTracker` the SUBTRACTED value, which it uses as `viewportStart`. §D2 lands the
rung at the header's PLAIN `y`. Those differ by exactly the list-header spacer — 38 px on BooksHome.
So the instant a rung lands, the sample window opens 38 px above that header, inside the PREVIOUS
section's last item, and `findVisibleIndex`'s any-sliver bounds (`position + size > threshold`)
report that item's index.

**Why it hid for the whole build-out.** When the previous section is COLLAPSED, `expanded.has()`
fails and the press falls through to master top — correct behaviour by accident. Only consecutive
expansions keep the lookup alive. It terminates at the first collapsed predecessor (press 4 above),
which is the observation that discriminates this mechanism from a generic wrong-target bug.

**Why no test could catch it.** Every unit test supplies the `visible()` thunk itself, so the suite
encoded the same assumption the implementation made. Only FlashList's source or a device can settle
a coordinate space. 943 tests and three reviewers passed over it.

**Fix (driver ruling: "one coordinate").** `containingSection()` in `ladderDecisions.ts` now
resolves the containing section in OFFSET space — the nearest section header at or above
`s.offset`, the same number the landing is expressed in. Consequences:

- The rung is **self-terminating by construction**: after a landing `offset === headerY`, the same
  section resolves, and the existing sub-pixel guard declines to master top. No new state, so
  §C3/§I6 hold.
- **`computeVisibleIndices()` leaves the back-press path entirely.** Ticket 05's throw-containment
  hazard is closed at source rather than ordered around by §B7. The hook's `try/catch` is KEPT
  (an uncaught throw in a `BackHandler` callback is a crash on back) and its test re-pointed at
  `getLayout`, the accessor the rung now calls. The ruling is unchanged; only its subject moved.
- Order-independent (§H4 promises no ordering), and a section whose header has no resolved layout is
  skipped rather than fatal.

jest 943 → **948**; tsc 0, eslint 0. **9 mutations run, 8 killed**; the survivor (`>` → `>=` on the
maximum) is *provably equivalent* — ties need two headers at one `y`, whose only real source is
FlashList synthesising `y: 0` for a missing layout, and both variants then decline via `headerY <= 0`.
Recorded in the code so it is a known quantity, not a gap.

⚠ **SPEC AMENDMENT CANDIDATE (for the driver — not applied).** **§D4 is wrong as written**:
*"Find the range containing `computeVisibleIndices().startIndex`"* does not implement **§D3**
(*"the section that CONTAINS the viewport top"*), because that index is sampled 38 px above the
viewport top the landing targets. §D3 is correct and unchanged; §D4's mechanism needs replacing with
the offset-space rule. §B7 and §J4's `visible` contract also narrow to the sweep alone.

#### Provisional observations from build 111 (re-run against the new build)

- [x] **The rung landing against the search bar — PASS (provisional).** Press 1 landed the
      Aaronovitch header clearly BELOW the dropped-down search bar, fully readable. §D2's plain-`y`
      landing is doing its job.
- **Recorded for the F-7 / search-bar discussion:** the back jump is a large UPWARD scroll, and
      `useScrollDirection.ts:38-48` re-shows the bar on any upward delta > 5 px. Confirmed
      visually — the bar is absent while scrolled deep and present immediately after the press.
      This is why "hide the search bar instead" is not a viable alternative to the D-1 fix: the
      jump itself re-shows the bar, so the ladder would have to own chrome visibility.
- The collapse sweep behaved correctly at the end of the chain: arriving at master top left the
      visible Agatha Christie section open and collapsed the off-screen ones.

### Session 2 — 2026-08-22, the D-1 fix re-tested; a SECOND defect found and fixed

**Rig:** unchanged (Pixel 7 Pro `29131FDH3009SZ`, Android 16 / SDK 36, gesture nav, scales 1.0).

**Binary:** fresh preview build, `versionCode=111`, **clean install** 16:40:24
(`firstInstallTime == lastUpdateTime`, so app data was wiped and the 355-book library rescanned —
3464 files, 154 s, per logcat). **Fix presence VERIFIED IN THE BINARY, not assumed**: the APK was
pulled off the device at 16:43 and `assets/index.android.bundle` (Hermes bytecode, which retains
function names) contains `containingSection` — a symbol that exists only in `e17ad99`.

⚠ Also established: **`console.log` reaches logcat in a preview build** (our own `[series]`/`[scan]`
output is there under tag `ReactNativeJS`). That is an instrumentation channel for the rest of this
ticket, and it means F-11's probe output is observable.

#### D-2 — DEFECT, FOUND AND FIXED: the landing is quantized to the pixel grid

**The D-1 fix did not resolve the reported bug.** The chain reproduced *identically* on the new
binary: Aaronovitch → **Andy Weir** → **Agatha Christie** → master top.

**Root cause — a sub-pixel shortfall meeting a strict inequality.** `scrollTo` can only come to rest
on an integer PHYSICAL PIXEL, while a FlashList layout `y` is a sum of measured dp heights and is
freely fractional. A landing aimed at `y_h` therefore rests at `y_h` **snapped to the pixel grid** —
up to half a pixel either side, 0.14 dp at this device's density 3.5, and never worse than 0.5 dp on
any density. Snapped SHORT, `containingSection`'s strict `y <= s.offset` drops the header the press
just landed on out of its own candidate set; the maximum falls through to the section below; back
climbs one open section per press. The `SUBPIXEL_EPSILON` guard was written for exactly this case
and could never fire, because the filter upstream of it had already discarded its subject.

**Why the device pass could not see it, and why the screen was no help.** The shortfall is smaller
than one pixel by construction. Measured on device (screenshots `m1`..`m4`): the header text's top
edge sits at y=702 px after landing on Aaronovitch, Weir and Agatha Christie, and at y=703 px for
`Recently Added` at master top — i.e. **every rung landing puts its header on the same pixel row it
occupies at master top**, exactly as §D2 promises. That measurement is what *proves* the mechanism:
it eliminates every large-magnitude explanation (a shifted layout `y`, a stale offset tracker, a
wrong coordinate space), and containment can only fail when `y > offset`, so the shortfall must lie
in the sub-pixel gap the measurement cannot resolve.

**Fix.** The containment test carries the same tolerance as the guard it feeds:
`y <= s.offset + SUBPIXEL_EPSILON`. Self-termination is restored for either sign of the snap, and
`SUBPIXEL_EPSILON` (1 dp) clears the worst-case quantization error on any density with margin.

jest 948 → **951**; tsc 0, eslint 0. **5 mutations run on the changed comparison, 4 killed** —
including M5 (*widen the band to 2*), so the tolerance is now bracketed from BOTH sides rather than
being a free parameter: too narrow and the climb returns, too wide and a genuine rung 2 px below a
header is swallowed. The survivor (`>` → `>=` on the maximum) is the same one adjudicated in D-1 and
is *provably equivalent* for the same reason, unaffected by the tolerance.

⚠ **NOT YET DEVICE-VERIFIED.** This is a JS change and the device holds a release build, so it needs
one more preview build. Under F-11's one-binary rule every checklist item below is still unrun.

⚠ **The §D4 spec amendment candidate from D-1 stands, and D-2 EXTENDS it**: the offset-space rule
that replaces §D4's mechanism must be stated with the tolerance, not as an equality, or it specifies
the bug fixed here.
