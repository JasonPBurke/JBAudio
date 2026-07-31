# Fix: Drawer Gesture Handler Non-Responsive Pressables (Physical Device)

**Date:** 2026-03-17
**Status:** In progress — Overlay fix confirmed working, drawer-content touch issue remains
**Branch:** `upgrade/expo55-rn83`

## Problem

After upgrading to RN 0.83 / Expo 55, all Pressable/button components inside the drawer content become non-responsive on **physical device only** (Pixel 7 Pro). Emulator works fine.

### Observed Behavior

1. Fresh app load: all main-screen buttons work correctly
2. Open drawer via settings button: drawer content buttons (X close, theme toggle, DrawerItems) are non-responsive
3. Close drawer via swipe: main-screen buttons work fine
4. After repeated tapping inside the drawer, eventually one button fires, then all work
5. Going back to the drawer resets the issue
6. Typing in the search bar (TextInput) can temporarily "unstick" buttons

### Key Diagnostic Signals

- **TextInput always works** — it uses native `EditText.requestFocus()`, bypassing the React Native responder/gesture pipeline entirely
- **Main screen buttons now work** (after Overlay fix) — even after opening/closing the drawer
- **Drawer buttons fail on first open, self-heal after enough taps** — suggests a race condition in native view/gesture registration, not a permanent architectural break
- **Emulator works, physical device doesn't** — different threading model, GPU rendering, and Fabric commit timing

## Confirmed Root Causes (Fixed)

### 1. Nested GestureHandlerRootView ✅ FIXED
The drawer's internal `GestureHandlerRootView` competed with the app root's instance for `dispatchTouchEvent()`. Fixed by replacing with `View` in the patch.

### 2. Overlay `pointerEvents` stuck on `'auto'` ✅ FIXED
The `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS: true` Reanimated flag prevents shadow tree commits outside React commit cycles. Visual properties (`opacity`, `transform`) go through a fast UI-thread path, but `pointerEvents` requires a Fabric shadow tree commit. The animated `pointerEvents` value was never applied after the drawer close animation because no React commit was triggered.

**Fix:** `useAnimatedReaction` + `runOnJS(setState)` to set `pointerEvents` as a React prop. The `setState` call triggers a React commit, guaranteeing the `pointerEvents` change is applied.

### 3. `removeClippedSubviews` on drawer's Animated.View ⚠️ APPLIED BUT INSUFFICIENT
Set to `false` to prevent drawer content views from being removed from native hierarchy when off-screen. This alone did not fix the issue.

## Remaining Issue: Drawer Content Buttons

The `GestureDetector` wrapping the entire drawer tree (content + drawer) is the prime suspect. When the drawer is open, the pan gesture's `hitSlop` expands to full screen width (`{ left: 0, width: undefined }`). Every touch on a drawer button enters the gesture tracker.

**However:** Removing the `GestureDetector` entirely did NOT fix the issue either, which means the problem is deeper.

## Current Patch State

File: `patches/react-native-drawer-layout+4.2.2.patch`

Changes applied:
- **Drawer.native.js:** `GestureHandlerRootView` → `View`, `removeClippedSubviews: false`, GestureDetector kept
- **Overlay.native.js:** `pointerEvents` via React state + `useAnimatedReaction` + `runOnJS`

## Investigation Plan for Next Session

### Step 1: Instrument touch events (diagnostic)

Add temporary logging to understand where touches are being consumed. Create a minimal test screen that renders ONLY a drawer with a single Pressable button, no other components. This isolates whether the issue is in the drawer infrastructure itself or caused by interaction with other app components.

```
Location: src/app/drawerTouchTest.tsx (temporary)
Purpose: Bare minimum drawer + Pressable, no FlashList, no SearchBar, no providers
```

### Step 2: Check Android logcat for RNGH/Fabric touch dispatch

Connect the Pixel 7 Pro via USB and capture logcat while tapping drawer buttons:
```bash
adb logcat | grep -iE "gesture|touch|dispatch|pressable|responder"
```

This will reveal:
- Whether RNGH is intercepting touches
- Whether Fabric is dispatching touch events to the drawer content views
- Whether the responder system receives the events but fails to act

### Step 3: Test `DrawerContentScrollView` vs plain `ScrollView`

The drawer content uses `DrawerContentScrollView` from `@react-navigation/drawer`. This wraps a `ScrollView`. On Android Fabric, `ScrollView`'s `requestDisallowInterceptTouchEvent` behavior may interfere with `Pressable` touch handling.

Test by replacing `DrawerContentScrollView` in `DrawerContent.tsx` with a plain `View` (no scrolling). If buttons work, the issue is ScrollView-related.

### Step 4: Test without `react-native-boost`

`react-native-boost` was recently added (commit `0c50663`). It optimizes React Native performance by potentially batching native view updates. This could delay touch-affecting property updates on Fabric.

Test by temporarily removing `react-native-boost` from `package.json` and rebuilding.

### Step 5: Test without `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS`

This Reanimated flag is the root cause of the Overlay issue. It may also affect other animated properties in the drawer tree. Temporarily remove it from `package.json`:

```json
"reanimated": {
  "staticFeatureFlags": {
    "ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS": true
  }
}
```

**Trade-off:** May increase scroll CPU usage (the flag was added to fix that). But if it fixes the drawer touch issue, it confirms the mechanism and we can find a targeted solution.

### Step 6: Test `react-native-screens` interaction

The drawer lives inside an Expo Router screen stack. `react-native-screens ~4.23.0` uses native Fragments on Android which can affect view attachment order and touch dispatch.

Test by adding `detachInactiveScreens={false}` to the Stack navigator in `_layout.tsx`. Or temporarily replacing the `(drawer)` screen with a non-screen-wrapped version.

### Step 7: Isolate Fabric vs Paper

If available, test with `newArchEnabled=false` (Paper renderer). If the issue disappears, it confirms a Fabric-specific touch dispatch bug.

## Architecture Reference

### Component Tree (Drawer Open)
```
SafeAreaProvider
└── GestureHandlerRootView (app root, _layout.tsx:179)
    └── DatabaseProvider
        └── BottomSheetModalProvider
            └── Stack (expo-router)
                └── Screen "(drawer)"
                    └── Drawer (react-native-drawer-layout)
                        └── View (patched, was GestureHandlerRootView)
                            └── DrawerProgressContext.Provider
                                └── DrawerGestureContext.Provider
                                    └── GestureDetector (pan)
                                        └── Animated.View (main, flexDirection: row)
                                            ├── Animated.View (content, slides right)
                                            │   ├── View (main screen, aria-hidden)
                                            │   └── Overlay (pointerEvents via React state)
                                            └── Animated.View (drawer, position: absolute)
                                                └── DrawerContent
                                                    └── DrawerContentScrollView
                                                        ├── Pressable (X close)
                                                        ├── Pressable (theme toggle)
                                                        └── DrawerItem (x8)
```

### Reanimated Config (package.json)
```json
"reanimated": {
  "staticFeatureFlags": {
    "ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS": true,
    "USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS": true
  }
}
```

### Critical Files
| File | Role |
|------|------|
| `patches/react-native-drawer-layout+4.2.2.patch` | Current patch (3 Drawer changes + Overlay rewrite) |
| `node_modules/react-native-drawer-layout/lib/module/views/Drawer.native.js` | Drawer render tree |
| `node_modules/react-native-drawer-layout/lib/module/views/Overlay.native.js` | Overlay with pointerEvents fix |
| `src/app/_layout.tsx` | App root — GestureHandlerRootView, Reanimated config |
| `src/app/(drawer)/_layout.tsx` | Drawer config — drawerType: 'slide', swipeEdgeWidth: 0 |
| `src/components/DrawerContent.tsx` | Drawer UI — uses DrawerContentScrollView, Pressable, DrawerItem |
| `package.json` | Reanimated staticFeatureFlags |

### What We Know Works
- `GestureHandlerRootView` → `View` replacement: necessary, prevents nested root view conflict
- Overlay `pointerEvents` via `useAnimatedReaction` + `runOnJS` + React state: fixes main-screen touch blocking
- Emulator behavior: all fixes work correctly on emulator

### What We Know Doesn't Fix It
- `swipeEnabled: false`: does not fix drawer content buttons
- Removing `GestureDetector` entirely: does not fix drawer content buttons
- `removeClippedSubviews: false`: does not fix drawer content buttons (but good to keep)
- `pointerEvents` via `useAnimatedStyle`: doesn't work with `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS`
- `pointerEvents` via `useAnimatedProps`: same issue (original code, also broken)
