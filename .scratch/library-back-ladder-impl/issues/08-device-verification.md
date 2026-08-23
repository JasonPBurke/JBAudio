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

⚠ **REOPENED 2026-08-23** at the driver's request, for the THREE DEFERRED ITEMS ONLY (momentum-end
counts, per-view first-item offsets, the drift A/B's fix-OFF arm). Everything else in this ticket
stands as resolved — see the `## Answer` section, which is unchanged. The rig those three items
needed now exists; see Session 4.

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
- [x] **Momentum-end counts.** Once on a clean back press; twice on a press that interrupts a
      fling. Both harmless, because the sweep is idempotent. **PASS — Session 5.** ⚠ Only
      reproducible with a touch-free back (`input keyevent 4`); a gesture back cancels the fling.
- [x] **Per-view first-item offsets, read not assumed.** Expect roughly 38 / 38 / 44 on the three
      mountable views. The fourth list's predicted value has never been measured by any device —
      measure it if it now mounts. **PASS — Session 5: 38.0 / 38.0 / 44.0, all on attempt 1.**
      `booksList` never mounted (0 lines), so it remains unmeasured by design, not by omission.
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
- [x] **The drift recipe, fix on and fix off.** The reproducing configuration is: Recents
      collapsed, the first several sections expanded, everything after collapsed; fling deep into
      the collapsed region, then press back mid-fling. Expect drift with the fix removed and none
      with it in. **RUN — Session 5, 10 paired runs (5 on / 5 off), ONE binary. Result: NO drift in
      either arm**, i.e. the prototype's drift did NOT reproduce on shipping code. See Session 5
      before drawing any conclusion about removing §G1 — the reading is that the fix is insurance
      against an ordering shipped code no longer has, NOT that it is dead weight.
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

### Session 4 — 2026-08-23, the three deferred items get a rig (no device run yet)

**What was missing, and what closes it.** All three items were deferred for the same two reasons:
nothing on those paths prints anything, and the drift A/B's fix-OFF arm appeared to need a SECOND
binary, which F-11 forbids. Session 3 established that **`console.log` reaches logcat in a preview
build** (tag `ReactNativeJS`), which kills the first reason. The second dissolves once the anchor
fix's arm is chosen **at runtime** rather than by which binary you built: alternating it turns the
A/B into a paired experiment inside ONE binary — same device, same library, same session, nothing
but the arm differing between consecutive runs. That is strictly better evidence than two builds,
not a workaround for not having them.

**Built:** `src/helpers/ladderInstrumentation.ts` (15 tests) plus five bracketed call sites in
`src/hooks/useBackToTopLadder.ts` (5 tests in its `rn` suite). jest 952 → **972**, tsc 0, eslint 0.

⚠ **It is ON in any non-`test` build and OFF under jest** (`process.env.NODE_ENV !== 'test'`). The
jest default is not hygiene: in `alternate` mode the module deliberately WITHHOLDS the anchor fix on
every other sweep, so a module live under jest would make the hook suite's
`prepareForLayoutAnimationRender` assertions pass or fail by parity. The suite instead configures it
explicitly, which is the only way the "does the lever actually move?" test means anything.

⚠ **Ticket 09 must delete it.** It is now the teardown item with real user impact: shipped as-is, a
production build would withhold the MVCP anchor fix on every other sweep, which is the drift §G1
exists to prevent. Added to ticket 09's checklist.

#### Verifying the binary carries it, before trusting a single line

Session 2's method, unchanged — Hermes bytecode retains function names:

```
adb shell pm path com.jasonburke.sonicbooks   # then adb pull the base.apk
unzip -p base.apk assets/index.android.bundle | grep -c armAnchorFix   # non-zero == present
```

Then `adb logcat -c && adb logcat -s ReactNativeJS | grep LADDER`.

#### The log grammar

```
[LADDER] press#1 view=booksHome offset=4312.0 first=38.0 -> scrollTo/section@1500.4
[LADDER] settle#1 momentum since=press#1/+118ms/n=1 view=booksHome offset=4180.0 first=38.0 vel=- -> none/not-at-top
[LADDER] settle#2 momentum since=press#1/+402ms/n=2 view=booksHome offset=0.0 first=38.0 vel=- -> collapse/dropped=3
[LADDER] anchorFix run#1 arm=on
[LADDER] drift run#1 arm=on offset=0.0 after=600ms
[LADDER] first view=booksHome value=38.0 attempt=1
```

- `n=` is the count of settles since the last back press — **the momentum-end count itself**.
- Every settle is logged, INCLUDING the declined ones. An interrupted fling's first momentum end
  lands away from the top and declines, and that decline IS the second event; logging only the
  sweeps would answer a different question and answer it wrongly.
- `vel=` carries four decimals because the gate it feeds is `0.01`. At one decimal every settled
  lift and every slow fling print as `-0.0`, which is exactly the distinction §F4 and D-3 turn on.
- `anchorFix run#N` appears only on a sweep that actually DROPS something — i.e. only where the fix
  is armed at all — so the A/B run counter advances once per real trial, not once per bounce.

#### Item 1 — momentum-end counts

1. Scroll deep, press back once cleanly, let it settle. Expect ONE settle line, `n=1`, at
   `offset=0.0`, `-> collapse/...` or `-> none/...`.
2. Fling deep and press back MID-FLING. Expect TWO settle lines against the same `press#`: `n=1`
   away from the top (`-> none/not-at-top`) and `n=2` at the top.

Both harmless either way — the sweep is idempotent by design — but the claim is now a reading.

#### Item 2 — per-view first-item offsets

Toggle Books → Series → Grid. Each view emits ONE `first view=… value=…` line shortly after it
mounts; no back press needed in any view. Expect roughly 38 / 38 / 44. `booksList` still mounts
nowhere, so its line will not appear — that is the same "never measured" state, now visible rather
than assumed. `attempt=N/UNRESOLVED` means the list never reported a non-zero offset within ~8 s,
which is itself a finding.

#### Item 3 — the drift A/B, both arms, ONE binary

Recipe as written above: Recents collapsed, the first several sections expanded, everything after
collapsed; fling deep into the collapsed region; press back mid-fling. Each qualifying arrival takes
the next arm — `run#1 arm=on`, `run#2 arm=off`, `run#3 arm=on`, … — so run the recipe **six to eight
times** and read the pairs off.

- `arm=on` runs should show `drift … offset=0.0` and rest at the top.
- `arm=off` runs are the ones expected to drift: a non-zero `drift … offset=…`, the list visibly
  back down the page, and the prototype's `[DT]` probe printing an MVCP correction whose `diff`
  should match the resting drift (that is how the prototype pinned it: -978.55, -1803.89, -617.20).

⚠ **The fix-off arm is a real defect while the build is installed** — every other deep back jump
will drift. That is the experiment, not a bug in the rig.

⚠ **The probe's `console.log` runs on every MVCP correction attempt** (F-11 KEEP). Note that in any
timing-sensitive writeup, exactly as sessions 1–3 did.

**To pin one arm instead of alternating** (e.g. to gather several fix-off runs in a row), the mode
lives in one place: `BUILD_DEFAULTS.anchorFix` in `ladderInstrumentation.ts` — `'alternate'` (the
default), `'on'`, or `'off'`. Changing it means a new binary, so prefer alternation.

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

⚠ **SPEC AMENDMENT — RAISED HERE, APPLIED 2026-08-23 as `spec.md`'s NINTH AMENDMENT.** It was
under-scoped as first written (below) and was widened before being applied: besides §D4 it also
covers **§H4**'s "the rung asks containment" clause, **§J1**'s press-time read list, and Testing
Decisions cases **11** and **13**, which specified the very behaviour D-1 removed. C1's
"meaningfully above the fold" (S-3) is recorded in §D4 as OPEN, not settled. Original wording:

⚠ **(as first raised — for the driver, not applied).** **§D4 is wrong as written**:
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

⚠ **APPLIED 2026-08-23 in the ninth amendment.** As raised: the §D4 candidate from D-1 stands, and D-2 EXTENDS it: the offset-space rule
that replaces §D4's mechanism must be stated with the tolerance, not as an equality, or it specifies
the bug fixed here.

### Session 3 — 2026-08-22, the full checklist against ONE binary

**Rig:** unchanged. **Binary:** preview build installed 17:08 (update, data preserved), built from
`3f9392b`, **probe present** in `node_modules/@shopify/flash-list` per F-11's KEEP ruling. Every
result below was taken against this one binary. Animator scales verified `1/1/1` at start and
restored to `1/1/1` at the end.

#### The D-1 / D-2 fix — VERIFIED ON DEVICE ✅

From mid-Aaronovitch with three consecutive sections expanded: press 1 → **Ben Aaronovitch header**,
press 2 → **master top** (`Recently Added`), press 3 → **app backgrounded**. Two rungs then the
ladder ends, no climbing. The reported defect is gone.

#### Checklist results

- [x] **The latch test — PASS.** Five rounds in one process, alternating 3-button (`keyevent`) and
      gesture (edge swipe): scroll → back → back → back (backgrounds) → reopen → push a book screen
      → back pops to the library. All five rounds reached JS on every press; back never went dead.
      Verified visually per round, not just by focus, since a dead press also leaves the app
      foreground.
- [x] **The collapse sweep — PASS.** Arriving at master top left the VISIBLE section (Agatha
      Christie) expanded and collapsed the off-screen ones (Andy Weir, Ben Aaronovitch). Confirmed by
      scrolling down afterwards, as the ticket requires — the sweep itself is silent.
- [x] **Animator duration scale 0 — PASS, both halves.** The jump is instant (the frame captured
      250 ms after the press already shows the landing, identical to the settled frame) **and the
      sweep still fires** (a below-fold expanded section was collapsed on arrival).
- [x] **The rung landing against the search bar — PASS.** The landed header sits below the
      dropped-down bar and is fully readable. Now also measured: see D-2's m1..m4, the landed header
      occupies the SAME pixel row as the first item at master top.
- [x] **Drawer, keyboard, modal routes — PASS.** Drawer open + back → drawer closes, list scroll
      position byte-identical. Search focused + back → keyboard dismisses, list unchanged. Modal book
      screen + back → pops to library (5×, in the latch rounds). Back did that and only that.
- [x] **The overscroll bounce sweeps (F5) — CONFIRMED, it DOES sweep.** With a below-fold expanded
      section, a pull-down-and-release at the top collapsed it. Controlled: the same setup without
      the bounce left it expanded. So the platform does report the bounce and §F5's gate is not
      silently dead. Not a failure.
- [x] **A deep jump on a preview build against the real library — MEASURED, needs a driver
      judgement.** Screen-recorded at 120 Hz and analysed frame by frame: the list viewport goes
      **fully blank for ~160 ms** (t=1.752→1.911, flat luminance 26.3 vs 62–63 settled), then fills
      over ~90 ms, fully settled ~320 ms after the press; cover art resolves last. So it is not a
      "smear" of mismatched cells — it is a brief EMPTY viewport. Frames and per-frame luminance are
      in the session scratchpad. **DRIVER RULING 2026-08-23: ACCEPTED** — brief, identical every
      time, nothing mis-landed, and the list is correct the moment it settles. Reopens on a user
      report of a glitch or a perceived hang. Recorded in `spec.md` §E5 (tenth amendment).
- [x] **Rung overshoot — NOT REPRODUCED.** ~25 back presses across this session, never once landed
      past the header.
- [x] **Card reload after a collapse — observed, matches the known accepted behaviour.** Cover art
      fades in after a jump (the first `Recently Added` cover is blank for ~2 frames). Cosmetic, not
      fixed, per the ticket's standing instruction.

#### D-3 — F-7 IS REAL AND REACHABLE (not "unreachable by a human hand")

**The ticket asked for a ruling rather than an omission. The ruling has to be made on the basis that
the sweep DOES fire.**

Reproduction, with a control:

1. At rest at master top, expand a VISIBLE section (Andy Weir) — verified expanded.
2. Expand the section ABOVE it (Agatha Christie), which pushes Andy Weir's header below the fold
   while it stays expanded. This is the reachable precondition, and it needs no scrolling at all.
3. Drag down into the list ~50 px, **decelerating and holding still before lifting** so the release
   velocity is genuinely ~0 (`input motionevent` DOWN/MOVE.../pause/UP — a plain `input swipe`
   lifts while still moving and is classified as a fling, which is why a first attempt showed
   nothing).
4. Scroll down: **Andy Weir is collapsed.**

**Control (same setup, no gesture): Andy Weir stays expanded.** So the collapse is caused by the
gesture, not by the setup or by the scroll used to inspect it.

⚠ This is exactly F-7's predicted failure: the drag begins AT the top, so §F5's recorded lever
(*"require the drag to have begun below the top"*) does not cover it. §I2 is not violated — nothing
visible changes — so the loss is **silent** until the reader scrolls down and finds their sections
shut, at the very moment they started browsing downward.

**Sketch of a lever, for the driver — NOT implemented:** the bounce (§F5, which we want to keep
sweeping) moves the list UP off the top and returns; this failure moves the list DOWN INTO the list.
Gating the drag-trigger sweep on the drag not having moved *into* the list separates the two cases,
where a start-position test cannot.

**DRIVER RULING 2026-08-23: ACCEPTED AS IT STANDS, revisit on evidence.** Not severe enough to
correct now — the precondition needs two deliberate expansions near the top, which is plausible but
not the commonest path; the loss is one tap to undo; nothing is mis-landed. **What reopens it: a user
report of disliking the behaviour, or of hitting it at all.** Recorded in `spec.md` §F5 (tenth
amendment) together with the lever to use if that day comes.

#### Not observable on this binary — three items deferred with reasons

- [x] **RESOLVED Session 5.** **Momentum-end counts (once clean / twice interrupting a fling).** There is no counter in the
      build and no log on this path, so the *count* cannot be observed — only its effect, and the
      sweep is idempotent by design precisely so the count does not matter. Needs a one-line
      instrumented build. ⚠ Now cheap: **`console.log` reaches logcat in a preview build** (tag
      `ReactNativeJS`), established this session.
- [x] **RESOLVED Session 5 (38.0 / 38.0 / 44.0).** **Per-view first-item offsets, read not assumed (expect ~38 / 38 / 44).** Same reason —
      `getFirstItemOffset()` is not printed anywhere. D-2's technique (compare the first item's pixel
      row at master top across views) could measure it from screenshots if instrumentation is
      unwanted.
- [x] **RUN Session 5 — fix-OFF measured in one binary; no drift in either arm.** **The drift recipe, fix OFF.** The fix-ON half shows no drift, but the fix-OFF half requires a
      SECOND binary with the MVCP anchor fix removed, which contradicts F-11's one-binary rule for
      this session. Defer to a dedicated A/B session; the prototype's numbers (fix off 4/6 drifted,
      fix on 0/20) already stand.


---

## Answer

**Resolved.** `e17ad99`, `3f9392b`, `9f463ac`, `c407c6d`, `9a4e2f5`, `c86f9b4`, `a5a2a2e`.
jest 943 → **952**, tsc 0, eslint 0.

The ticket was written to buy *confidence, not code*. It bought code: **two real defects in the
intermediate rung**, both found only because the checks were run on a real device against a real
library, and both invisible to 943 tests and three reviewers.

- **D-1, the 38 px sample skew** — `computeVisibleIndices()` samples 38 px above the coordinate §D2
  lands in, so with CONSECUTIVE sections expanded back climbed one open section per press. Fixed by
  resolving the containing section in offset space.
- **D-2, the pixel-grid snap** — a scroll landing is quantized to an integer physical pixel while a
  layout `y` is not, so a strict `y <= offset` dropped the just-landed header from its own candidate
  set and the climb resumed. **The D-1 fix alone did not fix the reported bug**; the symptom was
  byte-identical and the mechanism completely different. Fixed by giving the containment test the
  same tolerance as the guard it feeds.

⚠ **The generalisable lesson, worth more than either fix: never compare a scroll offset to a layout
coordinate with a bare `===`/`<=`.** One is pixel-quantized by the platform, the other is not. Any
"land there, then ask where I am" design needs a tolerance on BOTH the filter and the guard.

**Verified on device** (one binary, `3f9392b`, probe present per F-11): the ladder is two rungs then
background with no climb; the latch survives five rounds alternating gesture and 3-button; the sweep
keeps the visible section and collapses the off-screen ones; **animator scale 0 keeps BOTH the
instant jump and the sweep**; the search-bar landing is clear; drawer, keyboard and modal back do
that and only that; no rung overshoot in ~25 presses. The **F5 overscroll bounce DOES sweep**,
confirmed against a control, closing §F5's open device question.

**Three questions went to the driver and all three were ruled ACCEPTED, revisit on evidence** — each
recorded in `spec.md` with what that evidence would be, so the revisit can actually happen:

- **D-3 / F-7 is REAL, not "unreachable by a human hand"** (§F5, tenth amendment). A settled slow
  drag down into the list collapses below-fold sections silently, and the precondition needs no
  scrolling: expand a visible section at the top, then expand the one above it. Established with a
  control. ⚠ The lever if it ever must be fixed is NOT §F5's recorded start-offset test — that drag
  begins at the top; gate on the drag not having moved *into* the list.
- **S-3, the sub-fold rung hop** (§D4, ninth amendment) — `offset 1505` with a header at `1500`
  fires the rung and consumes the press for an invisible move. ⚠ The ruling rests on the tolerance
  staying sub-pixel: **split the constant before ever widening it.**
- **The deep jump blanks the viewport for ~160 ms** (§E5, tenth amendment) — measured frame by
  frame, not described. It is not the *smear* §E5 assumed; for about half the jump there are no
  cells at all. ⚠ §E5's parked two-stage jump would not address it — an instant first leg lands in
  the same unrendered region.

**The spec was amended twice** (ninth and tenth) rather than left to drift. The ninth was widened
after review found the original candidate under-scoped: §D4's mechanism, §H4's containment clause,
§J1's press-time read list and Testing Decisions cases **11 and 13** all described the design D-1
removed, and together they read as coherent — so a re-derivation would have rebuilt D-1 with nothing
to stop it. **§D3 was correct throughout**; the fault was always D4's mechanism for reaching it.

### Three items deliberately NOT run, and why

Not omissions — each needs a capability this session could not have without breaking F-11's
one-binary rule:

- **Momentum-end counts** (once clean, twice interrupting a fling). No counter and no log on that
  path, so only the effect is observable, and the sweep is idempotent by design precisely so the
  count cannot matter.
- **Per-view first-item offsets, read not assumed.** `getFirstItemOffset()` is printed nowhere.
- **The drift A/B, fix OFF.** Needs a SECOND binary with the MVCP anchor fix removed, which
  contradicts F-11 for this session. The prototype's numbers (fix off 4/6 drifted, fix on 0/20)
  stand unchallenged.

⚠ **All three are now cheap**, because this session established that **`console.log` reaches logcat
in a PREVIEW build** (tag `ReactNativeJS`) — instrumentation does not need a debug build. One
instrumented build clears the first two; the third needs its own A/B session.

### Method notes worth reusing

- ⚠ **Verify the binary before debugging the code.** Hermes bytecode RETAINS FUNCTION NAMES, so
  `adb pull` the APK and `grep assets/index.android.bundle` for a symbol that exists only in the new
  commit. That settled "is my fix even running?" in one step, with no version bump. It is what
  turned "the fix didn't work" into "the fix is running and there is a second bug".
- ⚠ **`adb shell input swipe` CANNOT test a settled release.** It lifts the finger while still
  moving, so RN reports a non-zero velocity and the gesture reads as a FLING. The first F-7 probe
  showed "no sweep" for exactly this reason and was wrong. Use `input motionevent DOWN / MOVE… /
  sleep / UP` to hold still before lifting.
- ⚠ **A screenshot can prove a sub-pixel bug by elimination.** Measuring the landed header's pixel
  row (702/702/702 vs 703 at master top) showed every landing is exact, which eliminated every
  large-magnitude explanation and left only the gap too small to see — no instrumentation needed.

---

### Session 5 — 2026-08-23, the three deferred items RUN on device

**Device:** Pixel 7 Pro (cheetah), Android 16 / SDK 36, gesture navigation, 1440×3120 @ 560dpi,
real 356-book library, large covers on. **Build:** EAS `preview` profile built **locally**
(`eas build --local`), **versionCode 111**, installed 01:01, `:app:assembleRelease`. Rig confirmed in the shipped bundle before any measurement
(`armAnchorFix`, `sampleDriftAfterSweep`, `probeFirstItemOffset`, `logLadderPress`,
`logLadderSettle`, `ladderInstrumentationEnabled` — all present; log prefixes `[LADDER]`,
`anchorFix run#`, `drift run#`, `first view=` all present).

⚠ **F-11 CORRECTION — the `[DT]` MVCP probe was NOT in this binary, and a rebuild would not have
put it there.** `grep -c '[DT]'` on the extracted Hermes bundle returned **0**, while the probe is
still present in local `node_modules` at the documented lines. The probe is not dev-gated (a bare
`try` + `console.log`), so this is an install-path artifact, not release stripping.

**Cause — and note this was a LOCAL preview build, so "the cloud did it" is NOT the explanation.**
`node_modules/` is gitignored (`.gitignore:4`), and an **EAS build archives the project excluding
gitignored paths, then reinstalls dependencies from the lockfile in its own staging directory** and
runs `"postinstall": "patch-package"`, which reapplies only the seven shipping patches. That happens
with `eas build --local` exactly as it does in the cloud. **A raw `node_modules` edit therefore
survives NO EAS build of either kind.**

The evidence is self-contained: an edit present ONLY in local `node_modules` and absent from
`patches/` is missing from the shipped bundle, which proves the build never read the local
`node_modules`.

⚠ **This also corrects the premise in ticket 10's F-11 note**, which said "`npm run android` and EAS
preview builds bundle from the local `node_modules`". Only the first half is true. **`npm run
android` (`expo run:android` → Gradle in place) does use local `node_modules`; an EAS build does
not, local or cloud.** A local EAS build is not an in-place build.

**The generalised lesson, which the KEEP ruling could not have known:** *a diagnostic that must
survive a build belongs in `patches/` with a teardown ticket; one that must never ship belongs in
`src/` behind a runtime flag.* `ladderInstrumentation.ts` is in the second category and reached the
binary; `[DT]` is in neither and did not. **F-11's KEEP ruling was sound for a locally-built binary
and silently void for a cloud-built one.** Consequence for this session: all Session 5 measurements
come from one binary (versionCode 111), so the one-binary rule is satisfied, but there is **no
MVCP-internal corroboration** for the drift A/B — only the ladder's own outcome measure.

#### ⚠ The confound that nearly produced a wrong answer: a gesture back cancels the fling

The driver observed that a human back press can itself stop the scroll. It can, and it does. On
gesture navigation the back gesture is an **edge swipe**; that touch lands on the list and kills
momentum *before* the back event dispatches. A hand-run "press back mid-fling" measured `n=1` and
looked like a clean result — it was measuring a cancelled fling.

**Every mid-fling measurement must use `adb shell input keyevent 4`**, which delivers back with no
touch. Reproduced immediately once switched. The proof the fling was genuinely live is that the
list travelled thousands of px between the drag settle and the press with **no momentum line in
between**, and `settleSeq` is contiguous across that gap — the counter increments before the line
is formatted, so a dropped log line would show as a numbering gap. There is none.

Harness used, kept for reuse: `input swipe` for the fling (a fast swipe is a real fling; only a
*settled release* needs `input motionevent`), then `sleep`, then `keyevent 4` — all inside one
`adb shell` so the fling→back gap is not subject to host round-trip latency.

#### Item 1 — momentum-end counts: **PASS**

| trial | back | fling start | press offset | travelled while flying | settles | `n` |
|---|---|---|---|---|---|---|
| clean (from rest) | gesture | — | 18516.9 | — | `+266ms` | **1** |
| mid-fling | keyevent, 400ms | 9202.9 | 12332.0 | +3129 | `+298ms`, `+378ms` | **1, 2** |
| mid-fling | keyevent, 250ms | 9313.4 | 11671.1 | +2358 | `+286ms`, `+403ms` | **1, 2** |
| mid-fling | keyevent, 600ms | 9254.6 | 13395.1 | +4141 | `+297ms`, `+386ms` | **1, 2** |

Once on a clean press, twice on a press interrupting a fling — as specified. Three delays, 3/3.

Two observations worth keeping:

- **Both momentum ends report `offset=0.0`.** The cancelled fling's handler runs *after* the
  programmatic scroll has landed, so the sweep never sees a stray settle away from the top. The
  "interrupted fling emits a decline at the wrong offset" scenario does not occur.
- **The second sweep is always a no-op** (`dropped=0`), because `decision.open === inputs.expanded`
  by then, so `armAnchorFix()` at `useBackToTopLadder.ts:408` is never reached twice. **Exactly one
  anchor-fix arm is consumed per back press** — observed on every run below. This is what keeps the
  A/B's alternation aligned, and it is now measured rather than assumed.
- **In the wild, `n=2` is rare on gesture nav** for the same reason the confound exists: a reader's
  back gesture touches the list and cancels the fling. `n=2` needs a back that does not touch the
  list — 3-button nav, a hardware key, or scripted input.

#### Item 2 — per-view first-item offsets, read not assumed: **PASS**

| view | `getFirstItemOffset()` | attempt |
|---|---|---|
| `booksHome` | **38.0** | 1 |
| `seriesHome` | **38.0** | 1 |
| `booksGrid` | **44.0** | 1 |
| `booksList` | *never mounted — 0 lines in the whole session* | — |

Every assumed value confirmed exactly. All resolved on the first read, so the probe's retry ladder
(300/800/2000/5000 ms) never engaged and there were **zero `UNRESOLVED`** probes. `booksList`
remains unmeasured because it still mounts nowhere — now an observation, not an assumption.

#### Item 3 — the drift A/B, both arms, ONE binary: **RUN — no drift in either arm**

The fix-OFF arm is reachable inside one binary by choosing the arm at runtime and alternating it, so
consecutive runs differ *only* in the arm. Ten runs, same device, same session, same library:

| run | arm | press offset | dropped | drift @600ms | rest |
|---|---|---|---|---|---|
| 1 | on | 16,220.9 | 4 | **0.0** | at top |
| 2 | **off** | 15,892.3 | 4 | **0.0** | at top |
| 3 | on | 16,031.1 | 4 | **0.0** | at top |
| 4 | **off** | 49,947.7 | 5 | **0.0** | at top |
| 5 | on | 96,842.3 | 6 | **0.0** | at top |
| 6 | **off** | 106,245.1 | 7 | **0.0** | at top |
| 7 | on | 17,010.3 | 2 | **0.0** | at top |
| 8 | **off** | 106,252.3 | 7 | **0.0** | at top |
| 9 | on | 19,046.3 | 1 | **0.0** | at top |
| 10 | **off** | **107,766.9** | **7** | **0.0** | at top |

**Ten runs: five fix-ON, five fix-OFF, zero drift in every one.** Runs 6, 8 and 10 are the three
strongest fix-OFF cases — all above 106k depth with 7 sections dropped and the fix withheld.

Runs 5 and 6 used the driver's own recipe — the giant **Terry Pratchett** section (100+ books) plus
several other long sections expanded, large covers on, pressing back deep inside Pratchett near the
bottom of the master list. Run 6 is the strongest available fix-OFF case: 106k deep, 7 sections
dropped, fix withheld. It rests at `0.0`.

**The withholding is real, not a broken lever.** `arm=off` is logged at the branch, `dropped` is
unchanged between arms, and the hook's `rn` suite already proves `prepareForLayoutAnimationRender`
is skipped in that arm while `setExpanded` still runs.

**Reading (proposed, for the driver):** the shipped ladder sweeps on **momentum-end** — after the
list has already come to rest at `offset=0`. At rest at the top the MVCP anchor is the first item,
and everything the sweep removes is *below* it, a position no correction can move. The prototype
collapsed under a different ordering, which is where its drift came from. **This is an argument for
KEEPING §G1, not removing it:** the fix is cheap insurance against an ordering that shipped code
does not currently have, and nothing here shows the fix misbehaving.

**Strength of the result.** The prototype's rate was **fix-off 4/6**, not 6/6, so a single clean
run would have proved little. Against that same 2/3 rate, observing **0 drifts in 5 fix-off runs**
has probability (1/3)⁵ ≈ **0.4%**. The prototype's drift rate therefore does not carry over to
shipped code; whatever produced it is not present on this path.

⚠ **Remaining limits, stated plainly.** The outcome measure is a single read 600 ms after the
sweep, so a drift that appeared and fully self-corrected inside 600 ms would be missed — though on
every run the two settle lines *also* read `offset=0.0` (≈ +280 ms and +420 ms), giving three
independent reads per run and making a transient unlikely. One device, one list geometry, one
ordering. And there is **no `[DT]` corroboration in this binary**, so this is the ladder's own
outcome measure only, with no view of what MVCP attempted internally.

⚠ **Do not read "no drift with the fix off" as "the fix is unnecessary."** No conclusion about
removing the anchor fix should be drawn from ten runs against one ordering on one device.

#### Method notes worth reusing

- ⚠ **Check the artifact, not the working tree, for anything installed by hand.** `node_modules/`
  is gitignored, so **any EAS build — `--local` included — reinstalls dependencies and reapplies only
  `patches/`**, reverting every un-patched `node_modules` edit. One
  `unzip -p base.apk assets/index.android.bundle | grep -c <symbol>` settles it before any
  measurement is trusted. ⚠ "I built it locally" is NOT evidence the edit survived.
- ⚠ **A hand-delivered input can be its own confound.** The gesture back cancels the very fling the
  test is about. When measuring anything that races a gesture, deliver the input without touching
  the screen.
- **`uiautomator dump` makes section headers scriptable.** They expose `content-desc` (the section
  title), are `clickable="true"`, and measure ~138px tall, so setup can be automated. ⚠ `selected`
  does **not** track `isActive`, so there is no direct read of whether a section is open.
  ⚠ **Detecting expansion geometrically ("did the next header move down?") is NOT reliable at large
  cover size** — one expanded section can push the following header clean off-screen, so the check
  compares against a *different* header and concludes it closed the section, then "reopens" it by
  tapping it shut. That produced a silent `dropped=0` run that failed to burn an A/B arm. Tap-and-move-on
  is more robust than tap-and-verify here.
- **A section only counts as dropped if it is genuinely off-screen at the top.** Expanding the
  first two sections drops nothing, because §I2 correctly refuses to collapse what the reader can
  see. To burn an arm cheaply, scroll below the fold *first*, then expand.
- ⚠ **Never restart the app mid-A/B.** `anchorRun` is module state; a JS reload resets the arm to
  `on` and silently destroys the alternation. Setup must be done in-process.
- **Sequence numbers turn a missing log line into a visible gap.** `settleSeq`/`pressSeq` increment
  before formatting, so "no line appeared" can be distinguished from "logcat dropped it".
