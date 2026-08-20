# 01 — How does this app intercept a back press, on RN 0.83 + Android 16?

Type: research
Status: resolved
Blocked by: (none)
Resolved: 2026-08-18 — /research subagent (AFK). Findings: [research/01-back-interception-mechanism.md](../research/01-back-interception-mechanism.md). See Answer.
Parent: [map.md](../map.md)

## Question

**Which JS mechanism should conditionally consume an Android back press on the
library screen, and does declining one still background the app correctly?**

This is the map's foundation ticket. `grep -rn "BackHandler" src/` returns
**zero hits** — this app has never intercepted a back press in JS. Back is
handled entirely by Expo Router plus the `MainActivity.kt` override. So this
feature would introduce the app's first *conditional* back handler, directly on
top of a known-sharp workaround.

Answer all of:

1. **Which API.** `BackHandler.addEventListener` vs React Navigation's
   `useFocusEffect` + back handling vs `expo-router` facilities. Which is
   correct for a **drawer-root screen** under Expo Router 55 / RN 0.83.2 with
   New Architecture enabled, and which one fires *before* the drawer's own
   back consumption.
2. **The latch.** `android-back-latch-rn083` documents that
   `ReactActivity.invokeDefaultOnBackPressed()` calls
   `setEnabled(false)` on its `OnBackPressedCallback` and never re-enables it —
   a one-way latch, only reachable on **targetSdk 36 + Android 16**. The repo's
   `MainActivity.kt` works around it by calling `moveTaskToBack(false)` directly
   instead of delegating to super. **Does a JS handler that returns `true`
   (consumed) and later `false` (declined) still route correctly through that
   override, or does alternating consume/decline re-expose the latch?**
3. **Predictive back.** On Android 16 with enforced predictive back, what
   happens to the back-to-home peek animation when a JS handler returns `true`?
   Is the animation cancelled, does it flash, or is it suppressed cleanly? A
   consumed press that still plays a "leaving the app" animation would be a
   defect.
4. **Gesture vs button parity.** Confirm the edge-swipe gesture and the
   3-button back both reach the same handler with the same semantics.

## Why this is first

If back cannot be conditionally consumed on this RN version without
re-triggering the latch or breaking predictive back, the feature as designed is
not implementable and the whole map is redrawn. Every other ticket assumes this
works.

## Sources to prefer

React Native 0.83 Android source for `ReactActivity` / `BackHandler`,
React Navigation and Expo Router docs, and the Android
`OnBackPressedDispatcher` / `OnBackInvokedDispatcher` documentation. Read
`android/app/src/main/java/com/fuzzylogic42/JBAudio/MainActivity.kt` and the
`android-back-latch-rn083` memory topic first — the latch is already fully
characterised there; do not re-derive it.

## Answer

**Resolved 2026-08-18.** Full evidence, citations and confidence markings:
[`research/01-back-interception-mechanism.md`](../research/01-back-interception-mechanism.md).

### Headline

**The feature is implementable as specified on RN 0.83.2.** No native RN patch, no
RN 0.84 / Expo SDK 56 upgrade. Use **`BackHandler.addEventListener('hardwareBackPress', …)`
inside React Navigation's `useFocusEffect`** — the documented RN7 pattern. There is
no expo-router facility for this, and nothing native can get ahead of it on this stack.

### The four sub-questions

1. **Which API / ordering — VERIFIED.** `BackHandler` is strict **LIFO** by
   registration time (`BackHandler.android.js:21-29`). The only other JS
   subscribers are expo-router's forked `useBackButton` (registered at container
   mount, so it runs *last*) and the drawer's close-handler, which the drawer
   registers **only while open**, deliberately late. Drawer closed → no competing
   listener at all. Drawer open → LIFO puts the drawer first. Nothing native
   intercepts: RNS 4.23.0 registers an `OnBackPressedCallback` only for the native
   header search bar (unused here); native-stack registers none.

2. **The latch — VERIFIED, CANNOT be re-exposed.** Enabled state is
   **path-independent**. The consume path never reaches `invokeDefaultOnBackPressed`
   (JS returns `true` → `exitApp()` is never called). The decline path reaches
   `MainActivity`'s override, where `moveTaskToBack(false)` returns `true` for this
   root `singleTask` LAUNCHER activity, so `super.invokeDefaultOnBackPressed()` — and
   RN's `setEnabled(false)` — is never reached. **Any interleaving of consume/decline
   is safe**, and the feature makes the latch strictly *less* reachable than today.

3. **Predictive back — VERIFIED.** RN's always-enabled `PRIORITY_DEFAULT` callback
   (androidx registers at literal priority `0`) means **the back-to-home peek never
   plays on this app, on any press, today**. RN also doesn't override
   `handleOnBackStarted/Progressed`, whose androidx defaults are empty, so the app
   draws no peek either. **A consumed press cannot flash a "leaving the app"
   animation.** A cancelled gesture dispatches `onBackCancelled`, which RN no-ops, so
   JS never sees an abandoned swipe.

4. **Gesture vs button — VERIFIED.** On targetSdk 36 + Android 16, `KEYCODE_BACK` is
   no longer dispatched; both inputs converge on `OnBackInvokedDispatcher` → one
   `hardwareBackPress` event. The only difference is the started/progressed prelude,
   which RN discards.

### Risks this hands to later tickets

- **RISK 1 (HIGH) → ticket 02.** LIFO is by *registration time*, so the
  `useFocusEffect` dep array is **load-bearing**: re-registering while the drawer is
  open would put the ladder's handler *above* the drawer's, and back would scroll
  instead of closing the drawer. Mandate **both** empty deps (all inputs via refs)
  **and** an explicit `useDrawerStatus() === 'open'` guard. **Do not rely on LIFO
  alone.** This settles the map's open fog item on drawer ordering.
- **RISK 2 → ticket 03.** The predicate must be **synchronously readable from a ref**.
  The screen already threads a plain-JS `onScroll` at `scrollEventThrottle={16}` into
  the lists, so a `scrollYRef` is nearly free — fine for `offset > 0`, but ticket 03
  must not pick a predicate needing sub-frame accuracy.
- **RISK 3 → spec invariant.** The entire no-latch argument rests on
  `moveTaskToBack(false)` returning `true`, i.e. `MainActivity` staying the task root.
  Anything that changes that re-arms the latch **app-wide**.
- **RISK 4 → ticket 06.** **No gesture affordance is possible** — the screen is frozen
  during the swipe and the rung fires only on commit. Judge the animated/instant A/B
  knowing post-commit feedback is the only option.
- **RISK 5.** JS-thread latency is the whole budget, but both double-press
  interleavings are benign — **charting decision 2 (no counter, no timer) survives**,
  and no debounce is needed.
- **RISK 6.** `@gorhom/bottom-sheet` registers no BackHandler; latent only if a sheet
  is ever added to the library screen.

### Recorded to stop re-litigation

**The RN 0.84 / Expo SDK 56 upgrade is NOT required for this feature.**

### Confidence

VERIFIED in source/docs: all four headline answers, the dispatch chain, the
subscriber inventory, the priority-0 registration, the empty default animation
callbacks, targetSdk 36 in the merged manifest. INFERRED (flagged): that
`formSheet`/`transparentModal` pushes blur the library screen. UNKNOWN, not asserted:
IME back priority, and all user-visible animation outcomes. Caveat: androidx.activity
bytecode was read at 1.11.0 (newest in the Gradle cache) — behaviour is stable
1.8–1.11, but line-level citations are 1.11.0's.

**Five device tests (DT-1..DT-5) are carried into new ticket 11** — the source-level
answers above are verified, but no user-visible animation outcome is.
