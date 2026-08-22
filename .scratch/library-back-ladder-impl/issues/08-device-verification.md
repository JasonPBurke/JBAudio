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
