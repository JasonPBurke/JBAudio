# 06 — Animated or instant jump?

Type: prototype
Status: resolved
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

**Build both jump styles on a large real library and decide.**

Charting decision 8: **animated is the driver's preference**, with an instant
variant built so style can be weighed against complexity and long-list cost.

- **Animated:** `scrollToOffset({ offset: 0, animated: true })`. Preserves spatial
  orientation — the user sees where they came from.
- **Instant:** `scrollToOffset({ offset: 0, animated: false })` — the exact call
  `useResetScrollOnTabChange` already makes on tab change, so the app gains no
  new motion vocabulary.

## What to actually measure

The concern with animated is specific, not aesthetic: FlashList is a **recycling**
list, so an animated scroll across tens of thousands of pixels must render every
intervening cell. On a large library that risks a long visible smear of
placeholder cells, and it is the kind of thing that only shows up at real scale.
Test on the largest library available, not a seeded fixture.

Also weigh:

- **Determinism.** The collapse sweep fires on arrival (ticket 04); an animated
  scroll makes "arrival" a later, softer event. Check the two compose cleanly and
  that the sweep does not fire mid-flight.
- **Interruption.** What happens if the user touches the list mid-animation?
- **Distance sensitivity.** If animated is great short and bad long, a
  distance-dependent rule is a fallback — but it means back behaves differently
  depending on how far you scrolled, which is a real cost. Only reach for it if
  the evidence forces it.
- Note `ReducedMotionConfig` is already installed at the root layout
  (`src/app/_layout.tsx`) — establish whether an animated jump should respect a
  reduced-motion preference.

## Input from ticket 01 (resolved 2026-08-18) — judge the A/B knowing this

**RISK 4: no gesture affordance is possible.** On targetSdk 36 / Android 16 the screen
is **frozen during the back swipe**, and the ladder's rung fires only on **commit**.
There is no way to preview the jump, hint at it mid-gesture, or give the user any
signal that the press will scroll rather than exit.

**Post-commit feedback is the only option available.** That raises the stakes on this
ticket: the jump *is* the entire feedback channel (charting decision 6 already ruled
out a toast and a haptic), so whichever variant reads more clearly as "something
happened deliberately" carries more weight than it would if a gesture affordance were
on the table.

Related and already settled by ticket 01: the back-to-home **peek animation never plays
on this app**, so there is no competing motion to design around — the jump is the only
thing the user sees.

## Input from ticket 04 (resolved 2026-08-18) — read before building either variant

Ticket 04 settled the sequencing (collapse strictly **after** the list settles at
the top), and in doing so changed this ticket's cost sheet in three ways — one of
them a reversal.

- **Animated needs ZERO arrival machinery; instant needs a flag.** Traced through
  RN 0.83.2: `scrollToOffset({animated: true})` → `scrollTo({animated:true})` →
  `reactSmoothScrollTo` → `startFlingAnimator` (`ReactScrollView.java:1538`),
  which emits momentum-begin and registers `dispatchMomentumEndOnAnimationEnd`.
  So **`onMomentumScrollEnd` — already trigger #1 of the sweep — fires by itself
  when the animated back jump lands.** The back handler is
  `scrollToOffset({offset:0, animated:true}); return true;` and nothing else.
  `animated: false` goes through `super.scrollTo` and emits **no** momentum
  events, so the instant variant needs a one-shot armed flag consumed by the next
  at-top scroll event. This is the reverse of the usual "instant is simpler"
  intuition, and it should weigh in the decision.

- **Interruption is already solved for animated.** Your "what happens if the user
  touches the list mid-animation" bullet: `dispatchMomentumEndOnAnimationEnd`
  registers `onAnimationCancel` as well as `onAnimationEnd`
  (`ReactScrollViewHelper.kt:483–491`), so an interrupted jump still emits
  momentum-end — at a non-top offset, where ticket 03's at-top guard makes the
  sweep a no-op. Nothing to design. **The sweep also cannot fire mid-flight** for
  the same reason (the guard), answering your "determinism" bullet.

- **The smear concern is now unmitigated by ordering — this is the real cost.**
  Collapsing *before* the jump would have shortened the traversal, and ticket 04
  ruled it out (it freezes FlashList's render stack for 100 ms mid-animation via
  MVCP's `ignoreScrollEvents`). So **the animated jump traverses the fully
  expanded list.** If it smears at real library scale, the remaining levers are a
  **two-stage jump** (instant to within a screenful of the top, then animate the
  last leg) or the instant variant — *not* a pre-collapse. Test at scale knowing
  the fallback set is this small.

- **Distance does not change the duration.** Android's smooth scroll runs for a
  device-constant ~250 ms regardless of distance
  (`getDefaultScrollAnimationDuration`, cached from an `OverScroller` probe;
  `ReactScrollViewHelper.kt:219–228`, and RN's own comment at `:507`). A long jump
  is therefore *faster*, not longer — which is exactly why it risks the smear.

- **A hook for your `ReducedMotionConfig` bullet.** That same duration is probed
  from the device's `OverScroller`, so a system animation scale of 0 can make it
  **0 ms** — the animated variant would be silently instant on such a device.
  Worth establishing whether that already gives you reduced-motion behaviour for
  free, or whether it makes the animated variant untestable on a device with
  animations disabled.

## Working notes — session 2026-08-18 (ticket still CLAIMED, not resolved)

Traced in `node_modules/react-native` (RN 0.83.2) this session. These settle the
**reduced-motion** bullet mechanically; the **smear** bullet still needs device evidence.

### The animated jump is an `ObjectAnimator`, so the OS animation scale already governs it

`ReactScrollView.java:100` —
`private final ValueAnimator DEFAULT_FLING_ANIMATOR = ObjectAnimator.ofInt(this, "scrollY", 0, 0);`

`startFlingAnimator` (`:1538`) cancels it, then
`DEFAULT_FLING_ANIMATOR.setDuration(getDefaultScrollAnimationDuration(context)).setIntValues(start, end)`
and `.start()` (`:1549–1552`). Confirms ticket 04's trace, and adds the part that matters here:
**the animated scroll is a platform `ValueAnimator`, not an `OverScroller` fling.** `OverScroller`
is used only as a *duration probe* (`ReactScrollViewHelper.kt:610` `OverScrollerDurationGetter`,
cached into `SMOOTH_SCROLL_DURATION`, default 250) and, separately, for snap prediction (`:510`).

Consequences:

1. **`Settings.Global.ANIMATOR_DURATION_SCALE` applies to it** — that is the platform
   ValueAnimator scale, driven by Developer Options "Animator duration scale" and by
   Accessibility → **Remove animations**. At scale 0 the jump is 0 ms, i.e. *visually the
   instant variant*, with no code branch.
2. **Reduced motion therefore comes for free, and it comes with arrival intact.**
   `onAnimationEnd` still fires at duration 0, so `dispatchMomentumEndOnAnimationEnd`
   (`ReactScrollViewHelper.kt:483`) still emits momentum-end → ticket 04's sweep trigger #1
   still fires. The animated variant degrades to instant *without* needing the instant
   variant's one-shot armed flag. **This strengthens animated: it is the only variant that
   is simple at both ends of the reduced-motion setting.**
3. RN anticipates the zero case itself — `:1556` guards `yVelocity` with `if (duration > 0)`.

### Ruling on the `ReducedMotionConfig` bullet

`src/app/_layout.tsx:204` `<ReducedMotionConfig mode={isBackground ? ReduceMotion.Always : ReduceMotion.System} />`
is a **Reanimated** component and governs **Reanimated** animations only. It has **no path** to
`ReactScrollView`'s `ObjectAnimator`. So the ladder must **not** try to read it or gate the jump on
it — the correct answer is to do nothing and let the OS scale apply, which reaches the same
outcome by a shorter route. (Note the app deliberately forces `ReduceMotion.Always` while
backgrounded; irrelevant here, since the ladder only fires on a focused screen.)

### Testing caveat this creates (carry to ticket 11)

A device with animations disabled **cannot exercise the animated variant at all** — it will look
identical to instant. Any device A/B of this ticket must first confirm
`Settings.Global.animator_duration_scale` is `1.0`:

    adb shell settings get global animator_duration_scale

If it returns `0.0`, the A/B is measuring nothing. This is also the cheapest way to *simulate*
the reduced-motion path deliberately (`adb shell settings put global animator_duration_scale 0.0`).

### Still open — needs the device

- **The smear at real library scale.** Unchanged and unmitigated (ticket 04 removed pre-collapse
  as a lever). Mechanism to look for: the animator drives `scrollY` over ~250 ms across the full
  expanded content height, so FlashList sees a handful of `onScroll` samples with **no window
  overlap** between them — every sample is a fresh set of cells, so recycling buys nothing and
  each frame is a full cell mount. Fallback set remains: **two-stage jump** (instant to within a
  screenful, animate the last leg) or instant.
- **Driver's read on which variant says "that was deliberate"** — ticket 01's RISK 4 makes the
  jump the entire feedback channel.

## A device vehicle for this ticket already exists (added from ticket 05's session, 2026-08-18)

⚠ **This is NOT a resolution and does not claim this ticket.** It exists so a
concurrent session does not build a second prototype of the same thing.

Ticket 05's throwaway prototype on **`proto/back-ladder-rung-ab`** now carries
this ticket's arm on an **independent second toggle**, because both tickets need
the same thing on device — the driver's real library, a real ladder, one build.

- Chip **`06 · animated`** (blue) / **`06 · instant`** (amber), above ticket 05's
  own chip. Live toggle, no reload.
- The two axes are independent by construction, and the driver has been asked to
  **fix one while judging the other** so motion quality does not contaminate the
  rung judgement, or vice versa.

**Ticket 04's asymmetry is implemented, and it is the thing to watch.** The
animated arm has *no* arrival machinery — the programmatic scroll emits
`onMomentumScrollEnd` itself. The instant arm needed the one-shot `pendingSweepRef`
that 04 §3 specified, consumed by the first subsequent at-top scroll event, because
`animated: false` emits no momentum events at all. So the sweep's arrival signal
differs between the arms, and that cost is now concrete rather than predicted.

### What the toggle does NOT cover

The toggle answers the core A/B only. Three of this ticket's bullets are untouched
by it and still need their own handling:

- **Distance sensitivity** — the toggle is global, not distance-dependent.
- **`ReducedMotionConfig`** — not consulted by the prototype at all. Note ticket 04's
  warning that `getDefaultScrollAnimationDuration` can be **0** under a system
  animation scale of 0, which makes the animated arm *silently instant* on such a
  device — so a null result on this arm may be a device-settings artifact, not a
  finding. Worth checking the device's animation scale before trusting a comparison.
- **Interruption** — ticket 04 already answered this for the animated arm
  (momentum-end fires on `onAnimationCancel`, and the at-top guard makes the
  resulting sweep a no-op). The instant arm has nothing to interrupt.

**Findings will reach this ticket via the driver**, who is judging on device. That
is the correct channel for a HITL ticket — the driver speaks for themselves.

## Device-test protocol for this ticket (2026-08-18, ticket 06 owner)

The driver is testing ticket 05's combined build on `proto/back-ladder-rung-ab` and
reporting ticket 06's axis back to this session. Run in this order.

### Step 0 — PRECONDITION, or the whole A/B measures nothing

    adb shell settings get global animator_duration_scale

Must be `1.0` (or `null`, which means default 1.0). If it is `0.0`, the animated arm is
**silently instant** (see the ObjectAnimator trace above) and the two chips are the same
build. Restore with:

    adb shell settings put global animator_duration_scale 1.0

### Step 1 — the smear, at real scale, one axis at a time

Pin ticket 05's chip to **one variant** and leave it there; only flip `06 · animated` /
`06 · instant`. Largest real library, BooksHome, several sections expanded, scrolled
**deep** — the far end of the list, not a screenful down.

Watch for, in order of decisiveness:

1. **Placeholder smear** — blank/grey cells streaming past during the ~250 ms jump.
   Expected mechanism: constant duration over a huge distance means consecutive
   `onScroll` samples share **no** visible items, so recycling buys nothing and every
   frame is a full cell mount. This is the finding the ticket exists for.
2. **Does it land clean?** Any settle-jitter, over/undershoot, or a late re-layout
   after the jump completes.
3. **Deliberateness** — ticket 01 RISK 4 makes the jump the entire feedback channel.
   Which arm reads as "the app did that on purpose" rather than "the app glitched"?

### Step 2 — short-distance control

Repeat one screenful down. If animated is good short and smeary long, the fallback is a
**two-stage jump** (instant to within a screenful, animate the last leg) — the only
lever left, since ticket 04 removed pre-collapse.

### Step 3 — reduced-motion path (optional, cheap)

    adb shell settings put global animator_duration_scale 0.0

Confirm the animated arm still **collapses** on arrival. It should: the `ValueAnimator`
fires `onAnimationEnd` at duration 0, so momentum-end still emits and the sweep still
runs. If collapse fails here, that is a real finding — restore the scale to 1.0 after.

### Known prototype artifact — do NOT read as a jump-style finding

**Variant A + instant only.** `useBackToTopLadderPrototype.ts:182` arms `pendingSweepRef`
before the *intermediate-rung* jump, but that jump lands **mid-list**, and `onScroll`
only consumes the flag at `offset <= firstItemOffset` (`:132`). So the flag survives the
press and is consumed by whatever scroll next reaches the top — via the `onScroll` path,
which has **no velocity gate** (unlike `onScrollEndDrag`). Symptom: after an
intermediate-rung press, hand-dragging to the top can collapse sections **mid-drag,
under the finger**.

It is variant-A-only and instant-only, so it lands squarely on this ticket's axis and
would read as "instant behaves badly". It is not. Master-top is unaffected (lands at 0,
consumes correctly). Fix is to arm the flag only on the jump that targets the top.

### Evidence boundary of this build — BooksHome only

`index.tsx:346–349` wires `externalListRef` and the ladder handlers into **`BooksHome`
alone**. `SeriesHome` (`:355`) and `BooksGrid` (`:365`) still pass the bare
`useScrollDirection` `onScroll` and get no ref, so `ladderListRef.current` is `null` on
those views and the back handler returns `false` — back just backgrounds the app.

So whatever the driver reports settles the jump style **for BooksHome**. That is the
right list to decide it on (expanded sections make it the longest content, i.e. the
worst case for smear), but the verdict's generality is not tested here. **Ticket 09**
should carry the question of whether one jump style is asserted for all four views or
re-checked per view — most likely the former, since the mechanism (a constant-duration
`ObjectAnimator` over the full content height) is list-agnostic.

## Answer

**ANIMATED.** `scrollToOffset({ offset: 0, animated: true })` is the jump for every rung.
The instant arm is **rejected**, and with it the whole one-shot arrival mechanism it
required. Charting decision 8's stated preference is now **confirmed on device**, not
merely deferred to.

**Evidence.** Driver device-tested the combined ticket 05/06 prototype on
`proto/back-ladder-rung-ab`, built as a **preview build** (`--profile preview`) — the
build type this repo requires for anything visual, since a debug build serves assets over
Metro. Judged on `BooksHome` against the driver's real library. Verdict: animated is the
clear winner.

**The precondition was satisfied in fact, by inference.** Step 0 above warned that at
`animator_duration_scale = 0.0` the animated arm is silently instant, making the chips
identical. A verdict of "clear winner" is only reachable if the two arms **visibly
differed**, which is only possible with a non-zero duration. The comparison was therefore
a real one, and no re-test is needed to establish it.

**The smear did not decide this.** It was the ticket's central risk — a constant ~250 ms
duration over the full expanded content height means consecutive frames share no visible
cells, so FlashList's recycling buys nothing. It was not reported as objectionable at the
driver's real library scale. Consequently:

- The **two-stage jump** fallback (instant to within a screenful, then animate the last
  leg) is **not needed and stays unbuilt**.
- The **distance-dependent rule** is likewise not needed. It was always the least
  desirable outcome — back would have behaved differently depending on how far you had
  scrolled — and the evidence did not force it.

### What this deletes from the design (the main consequence for the spec)

1. **The back handler is two statements.** `list.scrollToOffset({ offset: 0, animated: true });
   return true;` — and nothing else. Ticket 04 F3 established that `animated: true` emits
   `onMomentumScrollEnd` by itself, which is already trigger #1 of the collapse sweep, so
   the animated arm needs **zero** arrival machinery.
2. **`pendingSweepRef` is deleted.** The one-shot flag consumed by the next at-top scroll
   event existed *solely* because `animated: false` emits no momentum events. It has no
   remaining caller. This also retires the prototype artifact documented above (the flag
   armed before the mid-list intermediate-rung jump, `:182` vs `:132`) — **moot**, since
   it required the instant arm.
3. **The ladder does not consult `ReducedMotionConfig`, and must not.** That component
   (`src/app/_layout.tsx:204`) is Reanimated's and has no path to `ReactScrollView`'s
   `ObjectAnimator`. Reduced motion is handled by the OS animator scale for free, and
   correctly: at scale 0 the jump is 0 ms yet `onAnimationEnd` still fires, so momentum-end
   still emits and the sweep still runs. The animated choice is the only one that is simple
   at **both** ends of that setting — the instant arm would have needed its flag regardless.
4. **Interruption needs no design.** Ticket 04: `dispatchMomentumEndOnAnimationEnd`
   registers `onAnimationCancel` as well as `onAnimationEnd`, so an interrupted jump still
   emits momentum-end, at a non-top offset where ticket 03's at-top guard makes the sweep a
   no-op.

### Residuals handed on, not left open here

- **Ticket 11** — add a device test at the extreme end of library scale confirming the
  animated jump stays clean, plus the reduced-motion path
  (`adb shell settings put global animator_duration_scale 0.0`; the jump becomes instant
  and the sweep must still fire). Neither is a decision; both are confirmations.
- **Ticket 09** — this verdict was measured on `BooksHome` only, the sole view wired in
  this build (`index.tsx:346–349`). The mechanism is list-agnostic — a constant-duration
  `ObjectAnimator` over the content height — so the expectation is one jump style asserted
  for all four views rather than re-checked per view. Ticket 09 asserts it as part of the
  shared list contract.
