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

Spec: Testing Decisions › "What jest will never cover here, and how it is accepted instead";
Risks R1, R3, R4, R6; user story 25.

**Blocked by:** 07.

**Status:** ready-for-human

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
