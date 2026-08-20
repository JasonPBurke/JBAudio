# Research 01 — How this app intercepts a back press, on RN 0.83.2 + Android 16

Ticket: [01-back-interception-mechanism.md](../issues/01-back-interception-mechanism.md)
Parent map: [map.md](../map.md)
Researched: 2026-08-18
Method: primary sources only — RN 0.83.2 Android/JS source in `node_modules`, the
`androidx.activity` 1.11.0 AAR decompiled with `javap`, React Navigation 7 /
expo-router 55 source in `node_modules`, and Android developer documentation.
No blog posts were used as evidence for any load-bearing claim.

---

## RECOMMENDATION (read this first)

**The feature is implementable as specified on RN 0.83.2. Nothing about the back
ladder is blocked by the RN 0.83 latch, and nothing about it requires a native RN
patch or an RN/Expo upgrade.**

Use **`BackHandler.addEventListener('hardwareBackPress', …)` registered inside
React Navigation's `useFocusEffect`** — the pattern React Navigation 7 documents.
There is no expo-router-specific facility for this, and there is no native
mechanism that could get ahead of it on this stack.

```tsx
// shape only — placement is ticket 02's call
useFocusEffect(
  useCallback(() => {
    const onBackPress = () => {
      // read the rung predicate from REFS ONLY (see RISK 1)
      if (!shouldConsumeRef.current) return false;   // decline → app backgrounds
      runLadderStepRef.current();
      return true;                                    // consume
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []),   // ← empty deps is load-bearing, see RISK 1
);
```

Headline answers:

| # | Question | Answer | Confidence |
|---|----------|--------|-----------|
| 1 | Which API | `BackHandler` + `useFocusEffect`; it runs **first**, ahead of the drawer (when closed, the drawer has no listener at all) and ahead of expo-router's container handler | **VERIFIED** in source |
| 2 | The latch | **Alternating consume/decline cannot re-expose the latch.** The consumed path never reaches `invokeDefaultOnBackPressed` at all; the declined path reaches the `MainActivity` override, which never touches the callback's enabled state | **VERIFIED** in source |
| 3 | Predictive back | **No back-to-home peek animation exists on this app today**, consumed or declined. RN's always-enabled `PRIORITY_DEFAULT` callback suppresses the system animation for every press. A consumed press therefore cannot flash a "leaving the app" animation | **VERIFIED** in source + Android docs; visual outcome **NEEDS A DEVICE TEST** |
| 4 | Gesture vs button | Same handler, same semantics. On targetSdk 36 + Android 16 `KEYCODE_BACK` is not dispatched at all, so both inputs funnel through the one `OnBackInvokedDispatcher` path | **VERIFIED** in Android docs + source |

---

## 1. WHICH API

### 1.1 The full dispatch chain (VERIFIED in source)

Traced end-to-end in `node_modules/react-native@0.83.2`:

1. **System → androidx.** `androidx.activity.OnBackPressedDispatcher.onBackPressed()`
   walks `onBackPressedCallbacks` **in reverse** (`listIterator(size)` + `hasPrevious()`),
   picks the **last-added enabled** callback, and calls its `handleOnBackPressed()`;
   if none is enabled it runs `fallbackOnBackPressed`.
   *Evidence:* `javap -c androidx/activity/OnBackPressedDispatcher.class` from
   `~/.gradle/caches/modules-2/files-2.1/androidx.activity/activity/1.11.0/…/activity-1.11.0.aar`,
   method `onBackPressed()`.

2. **androidx → RN.** `ReactActivity` registers exactly one callback, in `onCreate`,
   gated on `AndroidVersion.isAtLeastTargetSdk36(this)`:
   ```java
   private final OnBackPressedCallback mBackPressedCallback =
       new OnBackPressedCallback(true) {
         @Override public void handleOnBackPressed() {
           setEnabled(false);
           onBackPressed();
           setEnabled(true);
         }
       };
   ```
   `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactActivity.java:30-39` (declaration) and `:62-63` (registration)

3. **RN → JS.** `ReactActivity.onBackPressed()` → `ReactActivityDelegate.onBackPressed()`
   (`ReactActivityDelegate.java:228`) → `ReactDelegate.onBackPressed()`
   (`ReactDelegate.kt:177-190`). With bridgeless/New Arch enabled this takes the
   `reactHost?.onBackPressed()` branch and **returns `true` unconditionally**, so
   `ReactActivity.onBackPressed` never falls through to `super.onBackPressed()`.
   `ReactHostImpl.onBackPressed()` (`runtime/ReactHostImpl.kt:349-358`) calls
   `DeviceEventManagerModule.emitHardwareBackPressed()`, which emits the
   `hardwareBackPress` device event and returns.
   **The native side is done at this point — the JS decision is asynchronous.**

4. **JS.** `Libraries/Utilities/BackHandler.android.js:21-29`:
   ```js
   RCTDeviceEventEmitter.addListener(DEVICE_BACK_EVENT, function () {
     for (let i = _backPressSubscriptions.length - 1; i >= 0; i--) {
       if (_backPressSubscriptions[i]?.()) { return; }
     }
     BackHandler.exitApp();
   });
   ```
   **Strict LIFO: the most recently registered subscription runs first.** Any
   truthy return short-circuits. If every subscription declines, `exitApp()` →
   `NativeDeviceEventManager.invokeDefaultBackPressHandler()`.

5. **JS → native decline path.** `DeviceEventManagerModule.invokeDefaultBackPressHandler()`
   posts a runnable to the UI queue that calls
   `backBtnHandler.invokeDefaultOnBackPressed()` — i.e. **`MainActivity`'s override**.
   `modules/core/DeviceEventManagerModule.kt:30-33` (runnable), `:54-59` (module method)

### 1.2 Who else is subscribed, and in what order (VERIFIED in source)

`grep -rn "BackHandler" src/` in this repo returns **zero** hits (only a prose
mention in `src/app/seriesEditor.tsx:28`), so today the only JS subscribers are
from libraries. The full set on this stack:

| Subscriber | Registered when | File |
|---|---|---|
| expo-router's forked `useBackButton` — `canGoBack() ? goBack() : false` | once, at `NavigationContainer` mount (earliest ⇒ **runs last**) | `node_modules/expo-router/build/fork/useBackButton.native.js:39-53` |
| Drawer's `handleHardwareBack` — closes the drawer | **only while the drawer is open**, deliberately late so it wins LIFO | `node_modules/@react-navigation/drawer/src/views/DrawerView.tsx:168-192` + `utils/addCancelListener.native.tsx` |

The drawer's own comment states the intent explicitly:

> `// We only add the listeners when drawer opens`
> `// This way we can make sure that the listener is added as late as possible`
> `// This will make sure that our handler will run first when back button is pressed`

`@react-navigation/native`'s own `useBackButton` is **not** in play — expo-router
renders its own forked `NavigationContainer`
(`node_modules/expo-router/build/fork/NavigationContainer.js:11, 39`).

**Consequences for this feature:**

- With the drawer **closed** there is *no* drawer listener at all, so a
  screen-level handler is unambiguously first.
- With the drawer **open** the drawer's listener is newer than a
  focus-registered screen handler, so LIFO gives the drawer priority —
  *provided the screen handler does not re-register* (see RISK 1).
- The screen handler always beats expo-router's container handler, which is
  registered at app start.

This settles the map's open item *"Interaction with the drawer's own back
handling"*: the ordering is guaranteed **by registration time, not by
navigator nesting** — which is exactly why RISK 1 below matters.

### 1.3 Nothing native gets ahead of JS (VERIFIED in source)

A repo-wide grep of every dependency's Android sources for
`onBackPressedDispatcher | OnBackInvokedDispatcher | OnBackPressedCallback`
returns only three files:

- `react-native-screens/…/FragmentBackPressOverrider.kt` and `CustomSearchView.kt`
  — used **only** by the native header search bar. This app does not use
  `headerSearchBarOptions` (`src/constants/layout.ts` sets no search-bar options
  and the library screen sets `headerShown: false`), so this callback is never added.
- `expo-dev-launcher/…/DevLauncherErrorActivity.kt` — debug-only, different Activity.

`react-native-screens` 4.23.0 has **no** predictive-back support on Android
(grep for `predictive` in `android/src/main` returns nothing), and
`@react-navigation/native-stack` 7.11.0 does not register a `BackHandler` either
(`executeNativeBackPress` exists in `react-native-screens/src/utils.ts:11` but is
only re-exported, never used internally). **Every** back-driven navigation on
this stack — including popping `player`, `titleDetails`, `seriesDetail` — runs
through the JS `BackHandler` chain.

### 1.4 Why `useFocusEffect` and not `useEffect` (VERIFIED in docs + structure)

React Navigation 7 documents `BackHandler` + `useFocusEffect` as *the* mechanism
and states plainly that a plain `useEffect` / mount-based approach "will not work"
(https://reactnavigation.org/docs/custom-android-back-button-handling/).

That matters concretely here because of the route tree
(`src/app/_layout.tsx`, `src/app/(drawer)/_layout.tsx`, `src/app/(drawer)/(library)/_layout.tsx`):

```
root Stack (native-stack)
├── (drawer)            ← Drawer, swipeEdgeWidth: 0, drawerType 'slide'
│   └── (library)       ← Stack
│       └── index       ← THE LIBRARY SCREEN (drawer root AND stack root)
├── player / titleDetails / seriesDetail   (formSheet)
├── coverArtSearch / editTitleDetails / chapterList / footprintList / seriesEditor (transparentModal)
└── (settings)
```

`player`, `titleDetails` and `seriesDetail` are `formSheet`s and the modal routes
are `transparentModal`s — **the library screen stays mounted underneath them**.
A `useEffect`-registered handler would therefore stay subscribed while the player
sheet is open, and (being LIFO-newer than expo-router's container handler) would
swallow the back press that should pop the sheet. `useFocusEffect` unsubscribes
on blur, which is what makes charting decision 5 ("library screen only") true in
practice rather than in principle.

> **INFERRED (high confidence, worth one device check):** React Navigation's focus
> model is state-based, not visibility-based — pushing any route onto the root
> stack blurs `(drawer)` → `(library)` → `index` regardless of `presentation`.
> I did not trace `useFocusEvents` line by line for the `formSheet` case.

### 1.5 Alternatives considered and rejected

- **`usePreventRemove` / `PreventRemoveContext`** (`@react-navigation/core/src/usePreventRemove.tsx`)
  — designed to block a screen being *removed*. The library screen is the root of
  both its stack and its drawer; there is nothing to remove. Not applicable.
- **An `expo-router` facility** — none exists. expo-router 55.0.5 exposes no back
  interception API; its only back involvement is the forked `useBackButton`
  described above.
- **A native `OnBackPressedCallback` in `MainActivity`** — would run *before* RN's
  callback only if added later, and would have no access to the scroll state.
  Also re-opens the very latch this repo has already worked around. Rejected.
- **Patching RN's `ReactActivity.java`** — a documented **non-starter**: RN Android
  ships here as a prebuilt AAR, so patch-package cannot touch RN's Java/Kotlin
  (established in `android-back-latch-rn083`). Not needed for this feature.

---

## 2. THE LATCH — does alternating consume/decline re-expose it?

### **No. VERIFIED in source, by exhaustive case analysis of every path that can change `mBackPressedCallback.isEnabled`.**

There are exactly three sites in RN 0.83.2 that touch that field, and all three
are visible in `ReactActivity.java`:

| Site | Line | Effect |
|---|---|---|
| construction, `new OnBackPressedCallback(true)` | 32 | enabled at creation |
| `handleOnBackPressed`: `setEnabled(false); onBackPressed(); setEnabled(true);` | 34-38 | **self-restoring pair, synchronous** |
| `invokeDefaultOnBackPressed`: `mBackPressedCallback.setEnabled(false); super.onBackPressed();` | 122-127 | **the latch — never re-enabled** |

Now the two press outcomes:

**(a) JS consumes (`return true`).**
`BackHandler.android.js` short-circuits the loop and **never calls `exitApp()`**.
`invokeDefaultBackPressHandler` is therefore never invoked, so
`MainActivity.invokeDefaultOnBackPressed` never runs and RN's line 125
`setEnabled(false)` is unreachable. The only enabled-state change on this press is
the synchronous `false`/`true` pair inside `handleOnBackPressed`, which has already
completed (it runs entirely before the JS event is even processed, because
`ReactDelegate.onBackPressed()` returns `true` immediately after emitting).
**Net effect on the callback: none.**

**(b) JS declines (`return false`), all subscribers decline.**
`exitApp()` → `invokeDefaultBackPressHandler()` → UI-queue runnable →
`MainActivity.invokeDefaultOnBackPressed()`:
```kotlin
override fun invokeDefaultOnBackPressed() {
    if (!moveTaskToBack(false)) { super.invokeDefaultOnBackPressed() }
}
```
For `MainActivity` — `android:launchMode="singleTask"`, the LAUNCHER activity and
the root of its task (`android/app/src/main/AndroidManifest.xml`) — `moveTaskToBack(false)`
returns `true`, so `super.invokeDefaultOnBackPressed()` (and with it RN's
`setEnabled(false)`) is **never reached**. **Net effect on the callback: none.**

Because both outcomes leave `isEnabled == true`, **the enabled state is
path-independent**: any sequence of consumes and declines — `true, true, false`,
`false, true, false`, any interleaving — leaves the callback in exactly the state
it started in. There is no accumulating state anywhere in this chain to alternate
*into*.

Two corollaries worth recording:

- **The feature makes the latch strictly *less* reachable, not more.** Every press
  the ladder consumes is a press that no longer travels the decline path at all.
- **The `moveTaskToBack(false)` return value is the load-bearing invariant.** If a
  future change makes `MainActivity` a non-root activity, `super.invokeDefaultOnBackPressed()`
  runs and the latch is back — for the whole app, not just this feature. The spec
  should record this dependency (RISK 3).

### Side note: the pre-JS-instance path (VERIFIED, not a concern for this feature)

If no React instance exists (very early cold start), `ReactHostImpl.onBackPressed()`
returns `false`, `ReactDelegate.onBackPressed()` returns `false`, and
`ReactActivity.onBackPressed()` calls `super.onBackPressed()` **from inside
`handleOnBackPressed`, while the callback is temporarily disabled** — which is
precisely why the `setEnabled(false)` there exists (it prevents infinite
re-entrancy). `setEnabled(true)` restores it on the way out. This path is
unchanged by the feature and is not the latch.

---

## 3. PREDICTIVE BACK on Android 16

### 3.1 The finding: there is no back-to-home peek animation to break

**VERIFIED in source + Android documentation.**

Android's documentation is explicit:

> "If your app enables an `OnBackPressedCallback` or an `OnBackInvokedCallback`
> with `PRIORITY_DEFAULT` or `PRIORITY_OVERLAY`, the predictive back animations
> don't run and you must handle the back event."
> — https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture

And `androidx.activity` registers at exactly that priority. From the decompiled
`OnBackPressedDispatcher`:

- `updateEnabledCallbacks()` sets `hasEnabledCallbacks = onBackPressedCallbacks.any { it.isEnabled }`
  and, when that value *changes* on SDK ≥ 33, calls `updateBackInvokedCallbackState(hasEnabledCallbacks)`.
- `updateBackInvokedCallbackState(true)` calls
  `Api33Impl.registerOnBackInvokedCallback(dispatcher, 0, callback)` — the literal
  `0` is `OnBackInvokedDispatcher.PRIORITY_DEFAULT` (bytecode `iconst_0` at offset 33).
- `updateBackInvokedCallbackState(false)` unregisters it.

RN's `mBackPressedCallback` is created enabled and — per section 2 — **is enabled
at all times in this app**. So the app always holds a registered
`PRIORITY_DEFAULT` system callback, and the system never plays back-to-home,
cross-task or cross-activity animations for it. **This is already true today, on
every press, before this feature exists.** The ladder cannot introduce a
"leaving the app" animation on a consumed press, because that animation does not
play on any press.

### 3.2 Nor does the app draw its own peek

On API 34+ androidx registers an `OnBackAnimationCallback`
(`Api34Impl.createOnBackAnimationCallback`, selected by the `SDK_INT >= 34` branch
in the dispatcher's constructor), so `onBackStarted` / `onBackProgressed` /
`onBackCancelled` *are* delivered to the dispatcher, which forwards them to the
topmost enabled callback. But RN's callback does **not** override them, and
`androidx.activity.OnBackPressedCallback`'s defaults are empty method bodies
(verified via `javap`: `handleOnBackStarted` and `handleOnBackProgressed` bodies
contain only the Kotlin null-check and `return`; `handleOnBackCancelled` is a bare
`return`).

So during an edge-swipe the screen is **static** — no system peek, no app-drawn
peek — and the ladder step fires on commit, in `handleOnBackPressed`. That is the
clean-suppression outcome the ticket asked for, though it also means the ladder
gets **no** gesture-progress affordance (RISK 4).

### 3.3 A cancelled gesture is silently dropped (VERIFIED — this is good news)

A back gesture the user starts and then abandons dispatches `onBackCancelled` →
`OnBackPressedDispatcher.onBackCancelled()` → the in-progress callback's
`handleOnBackCancelled()`, which for RN's callback is a no-op. **JS is never told,
and `hardwareBackPress` never fires.** A half-swipe therefore cannot spuriously
trigger a ladder step. Confirmed by the dispatcher's `onBackStarted` storing
`inProgressCallback`, and `onBackPressed()` clearing it (`putfield inProgressCallback = null`)
before invoking `handleOnBackPressed`.

### 3.4 What the decline path looks like

Declining calls `moveTaskToBack(false)` directly, which uses the standard
task-to-background transition — **not** the predictive back-to-home animation.
This is unchanged from today's behaviour and is already device-verified per
`android-back-latch-rn083`. The user-visible consequence is that "back exits the
app" will not get a predictive peek even after the RN 0.84+ upgrade unless the
`MainActivity` override is reverted at that time.

---

## 4. GESTURE VS BUTTON PARITY

**VERIFIED — they are the same code path, and on this configuration they cannot
diverge.**

Android's Android 16 behaviour-changes page states, for apps targeting API 36 on
an Android 16+ device:

> "the predictive back system animations (back-to-home, cross-task, and
> cross-activity) are enabled by default. Additionally, `onBackPressed` is not
> called and `KeyEvent.KEYCODE_BACK` is not dispatched anymore."
> — https://developer.android.com/about/versions/16/behavior-changes-16

This app is targetSdk 36 (`android/app/build/intermediates/merged_manifests/debug/…/AndroidManifest.xml`:
`<uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/>`) and sets
**no** `android:enableOnBackInvokedCallback` attribute, so it does not opt out.

Therefore:

- **3-button back** no longer arrives as `KEYCODE_BACK`, so
  `ReactActivity.onKeyDown/onKeyUp` (`ReactActivity.java:99-113`) are dead for back.
  It arrives as `OnBackInvokedCallback.onBackInvoked()`.
- **Edge-swipe** arrives as `onBackStarted` → `onBackProgressed`* → `onBackInvoked`
  (or `onBackCancelled`).
- Both converge on `OnBackPressedDispatcher.onBackPressed()` →
  RN's `handleOnBackPressed()` → one `hardwareBackPress` JS event.

The **only** difference is the `onBackStarted`/`onBackProgressed` prelude, which
the gesture has and the button does not, and which RN discards (§3.2). **The JS
handler therefore sees an identical, indistinguishable event from both inputs.**

Two more parity notes specific to this app:

- The drawer sets `swipeEdgeWidth: 0` (`src/app/(drawer)/_layout.tsx`), so the
  drawer never competes with the system's edge-swipe region. The drawer opens by
  button only. That removes the most obvious gesture-only hazard.
- `android:windowSoftInputMode="adjustPan"` and no RN `<Modal>` anywhere in the
  library screen's component tree (`Header`, `SearchBar`, `BooksHome`, `BooksGrid`,
  `SeriesHome`, `CreateSeriesFab`, `FloatingPlayer` — grepped, zero `Modal` usage),
  so no dialog window can sit between the input and the Activity dispatcher.

---

## RISKS AND CONSTRAINTS THE SPEC MUST RECORD

**RISK 1 — the `useFocusEffect` dependency array is load-bearing (HIGH).**
LIFO ordering is by *registration time*. If the effect's `useCallback` deps
change while the drawer is open, the handler is removed and re-added **on top of
the drawer's listener**, and back will run a ladder step instead of closing the
drawer. Mitigations, both cheap, and the spec should mandate **both**:
1. Empty deps — read every input (scroll offset, view toggle, expanded set,
   list ref) through `useRef`, never through closed-over state.
2. An explicit belt-and-braces guard: `if (useDrawerStatus() === 'open') return false;`
   (`useDrawerStatus` is exported from `@react-navigation/drawer`,
   `src/index.tsx:21`). Read it via a ref too, per (1).
This is also the concrete resolution of the map's open item on drawer ordering:
**do not rely on LIFO alone — guard explicitly.**

**RISK 2 — the rung predicate must be synchronously readable (MEDIUM).**
`BackHandler` handlers are synchronous; there is no way to await a measurement.
The offset must already be in a ref when the press arrives. Good news: the library
screen already threads a plain-JS `onScroll` into both lists with
`scrollEventThrottle={16}` (`src/components/BooksHome.tsx:296-297`,
`src/components/BooksGrid.tsx:157-158`, `src/hooks/useScrollDirection.ts`), so a
`scrollYRef` can be updated there for near-free. Residual staleness is up to one
frame plus JS-thread lag — irrelevant for an `offset > 0` predicate (charting
decision 2), but it *would* matter for a tighter threshold. Ticket 03 should not
choose a predicate that needs sub-frame accuracy.

**RISK 3 — `moveTaskToBack(false)` returning `true` is an app-wide invariant.**
The whole no-latch argument in §2 rests on `MainActivity` being the root of its
task. It is today (`launchMode="singleTask"`, LAUNCHER). Anything that changes
that — a second Activity, a launch-mode change — re-arms the RN 0.83 latch for
the entire app. Worth a comment in `MainActivity.kt` if one is not there already.

**RISK 4 — no gesture affordance (design constraint, not a defect).**
Because RN's callback ignores `onBackStarted`/`onBackProgressed` (§3.2), the ladder
cannot show any progressive feedback during an edge swipe: the screen is frozen
until the gesture commits, then the list jumps/animates. Charting decision 6 (no
toast, no haptic — "the visible jump is the feedback") is compatible with this,
but the A/B in ticket 06 should be judged knowing that the *only* feedback
possible is post-commit.

**RISK 5 — JS-thread latency is the whole budget (LOW-MEDIUM).**
The native side finishes the moment the event is emitted; every millisecond after
that is JS. If the JS thread is busy (a library scan, a big collapse re-render),
the back press appears to do nothing and a second press may arrive before the
first is handled. Two presses in flight at offset > 0 would yield: press 1
consumed (scroll to top), press 2 declined (background) — which is the intended
ladder, so double-press is benign. The reverse (both declined) issues two
`moveTaskToBack` calls, also benign. **No debounce is needed**; charting decision 2
(no counter, no timer) survives.

**RISK 6 — an open `@gorhom/bottom-sheet` modal does not consume back.**
`@gorhom/bottom-sheet` registers no `BackHandler` in this version (grepped). No
bottom sheet is currently mounted on the library screen (`SeriesDetailSheet` and
`PlayerControls` are elsewhere), so this is latent rather than live — but if one
is ever added to the library screen, the ladder handler will fire underneath it.

**NON-RISK, recorded to stop it being re-raised:** the RN 0.84 fix / Expo SDK 56
upgrade is **not** required for this feature. Nothing in the ladder needs it, and
the existing `MainActivity` workaround is sufficient and correct for both the
consume and the decline path.

---

## DEVICE TESTS STILL REQUIRED (Android 16, targetSdk 36, real device)

Everything above is a source/documentation result. These four claims are about
what a human *sees*, and I will not assert them without a device.

**DT-1 — Predictive back peek suppression (confirms §3.1/§3.2).**
No code change needed; this can be run on today's build.
1. On the library screen, scrolled to the top, slowly edge-swipe from the left
   and hold at ~50% without releasing.
2. **Expected:** the app does *not* shrink/peek toward the home screen; the
   screen is static. Release → the app backgrounds with the ordinary task
   transition.
3. Repeat on the `player` sheet (a case where back pops rather than exits).
4. **If a peek animation DOES appear**, §3.1 is wrong for this device/OEM and the
   consumed-press-flash concern is live — re-open the ticket.

**DT-2 — Cancelled gesture is inert (confirms §3.3).**
Requires a temporary instrumented build with a `console.log` in a
`BackHandler` subscription on the library screen.
1. Start an edge swipe, drag past the commit threshold, then drag back to the
   edge and release (cancel).
2. **Expected:** no `hardwareBackPress` log line at all.
3. **If it logs**, the ladder will fire on abandoned swipes and needs a guard.

**DT-3 — Alternating consume/decline does not latch (confirms §2).**
Requires the prototype handler from ticket 02/05.
1. Scroll the library down. Press back → list jumps to top (consumed).
2. Press back again → app backgrounds (declined).
3. Reopen from recents. Open `player`. Press back → **the sheet must pop.**
4. Repeat steps 1-3 **five times in one process**, alternating gesture and
   3-button back between rounds, without killing the app.
5. **Expected:** step 3 pops correctly every round. This is the exact sharp test
   from `android-back-latch-rn083` ("backgrounding via BACK always broke it,
   HOME never did") applied to the new conditional handler. A latch would show
   as: after some round, back from `player` backgrounds the app instead of
   popping.

**DT-4 — Drawer ordering under re-registration (confirms RISK 1).**
1. With the ladder active and the list scrolled down, open the drawer.
2. Press back. **Expected:** the drawer closes and the list does **not** move.
3. Then, while the drawer is open, cause the screen to re-render (switch tabs
   before opening, expand a section, type in search) and press back again.
4. **If the list jumps instead of the drawer closing**, the handler is
   re-registering — the empty-deps rule and/or the `useDrawerStatus` guard is
   missing or ineffective.

**DT-5 (optional, cheap) — soft keyboard still wins.**
Charting decision 7 assumes the IME consumes back upstream. Focus the library
search field so the keyboard is up, scroll the list down, press back.
**Expected:** the keyboard dismisses and the list does not move; a second press
runs the ladder. *(I did not verify the IME's back priority in source — it is
outside the app's dispatcher — so this one is genuinely unknown, not merely
unconfirmed.)*

---

## SOURCE INDEX

**Local source (versions exact, read directly):**
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactActivity.java` (RN 0.83.2)
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactActivityDelegate.java:228`
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactDelegate.kt:177-190`
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactHostImpl.kt:349-358`
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/core/DeviceEventManagerModule.kt`
- `node_modules/react-native/Libraries/Utilities/BackHandler.android.js`
- `node_modules/expo-router/build/fork/useBackButton.native.js` + `build/fork/NavigationContainer.js` (expo-router 55.0.5)
- `node_modules/@react-navigation/drawer/src/views/DrawerView.tsx:168-192` + `src/utils/addCancelListener.native.tsx` (drawer 7.7.13)
- `node_modules/@react-navigation/native/src/useBackButton.native.tsx` (native 7.1.28, unused here)
- `node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/FragmentBackPressOverrider.kt`, `CustomSearchView.kt`, `src/utils.ts` (RNS 4.23.0)
- `~/.gradle/caches/modules-2/files-2.1/androidx.activity/activity/1.11.0/…/activity-1.11.0.aar`
  → `androidx/activity/OnBackPressedDispatcher.class`, `OnBackPressedCallback.class` (via `javap -p -c`)
- `android/app/src/main/java/com/fuzzylogic42/JBAudio/MainActivity.kt`
- `android/app/src/main/AndroidManifest.xml`, `android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml`
- `src/app/_layout.tsx`, `src/app/(drawer)/_layout.tsx`, `src/app/(drawer)/(library)/_layout.tsx`, `src/app/(drawer)/(library)/index.tsx`, `src/hooks/useScrollDirection.ts`, `src/components/BooksHome.tsx`, `src/components/BooksGrid.tsx`, `src/constants/layout.ts`

**Documentation:**
- https://reactnavigation.org/docs/custom-android-back-button-handling/
- https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture
- https://developer.android.com/about/versions/16/behavior-changes-16
- https://developer.android.com/guide/navigation/navigation-event/handle-back
- https://reactnavigation.org/docs/drawer-navigator/

**Carried in as established fact, not re-derived:**
- `~/.claude/projects/-home-jason-Development-JBAudio/memory/android-back-latch-rn083.md`

**Caveat on one artifact:** the `androidx.activity` version was read at **1.11.0**,
the newest in the local Gradle cache; I could not confirm from a resolved
dependency report which version this build actually links. The
`updateEnabledCallbacks` / `onBackPressed` / `PRIORITY_DEFAULT` behaviour cited
here has been stable across activity 1.8–1.11, so the conclusions do not turn on
the exact version — but the *line-level* bytecode citations are 1.11.0's.
