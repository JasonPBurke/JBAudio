# UI Thread Background CPU Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate ~18-20% UI thread CPU usage when the app is backgrounded by disabling Reanimated's animation loop via `ReducedMotionConfig`.

**Architecture:** Toggle `ReducedMotionConfig` between `ReduceMotion.System` (foreground) and `ReduceMotion.Always` (background) in the root layout, driven by `AppState`. The root layout already tracks `AppState` via a ref — we add a `useState` to trigger a re-render when background state changes, and render the `ReducedMotionConfig` component with the appropriate mode.

**Tech Stack:** react-native-reanimated 4.1.3 (`ReducedMotionConfig`, `ReduceMotion`), React Native `AppState`

---

### Task 1: Add ReducedMotionConfig toggle to root layout

**Files:**
- Modify: `src/app/_layout.tsx:11-14` (imports), `src/app/_layout.tsx:67` (state), `src/app/_layout.tsx:137-153` (AppState listener), `src/app/_layout.tsx:169-182` (JSX)

**Step 1: Add imports**

In `src/app/_layout.tsx`, update the existing reanimated import block (lines 11-14):

```tsx
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
  ReducedMotionConfig,
  ReduceMotion,
} from 'react-native-reanimated';
```

**Step 2: Add `isBackground` state**

Inside the `App` component, after line 135 (`const appState = useRef(AppState.currentState);`), add:

```tsx
const [isBackground, setIsBackground] = useState(false);
```

Also add `useState` to the existing React import on line 5:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
```

**Step 3: Update AppState listener to set background state**

Modify the existing listener (lines 137-153) to also update `isBackground`:

```tsx
useEffect(() => {
  const subscription = AppState.addEventListener(
    'change',
    (nextAppState: AppStateStatus) => {
      // Only refresh when coming back to active state from background
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        initSubscription();
      }
      setIsBackground(nextAppState === 'background');
      appState.current = nextAppState;
    },
  );

  return () => subscription.remove();
}, [initSubscription]);
```

**Step 4: Add ReducedMotionConfig to JSX**

Inside the return block, add `ReducedMotionConfig` as the first child of `SafeAreaProvider` (before `PlayerStateSync`):

```tsx
return (
  <SafeAreaProvider>
    <ReducedMotionConfig
      mode={isBackground ? ReduceMotion.Always : ReduceMotion.System}
    />
    <PlayerStateSync />
    {/* ... rest unchanged */}
  </SafeAreaProvider>
);
```

**Step 5: Build and verify**

Run: `npx expo run:android`
Expected: App builds and runs normally with no visual changes.

**Step 6: Measure with Flashlight**

1. Open app, navigate to library
2. Background the app (paused state)
3. Measure UI thread CPU with Flashlight
4. Expected: UI thread drops from ~18-20% to < 5%
5. Repeat with a book playing — verify same result
6. Return to foreground — verify animations work normally

**Step 7: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "perf: disable Reanimated animations when app is backgrounded

Toggle ReducedMotionConfig between System (foreground) and Always
(background) to prevent Reanimated's Choreographer frame callback
from consuming ~20% UI thread CPU while backgrounded."
```

---

### Task 2 (only if Task 1 measurement fails): Investigate with systrace

If UI thread CPU remains at ~18-20% after Task 1, `ReducedMotionConfig` does not deregister the Choreographer callback. In that case:

1. Capture a systrace while backgrounded: `python systrace.py -o trace.html sched gfx view`
2. Open in Chrome, filter to UI thread, identify the repeating call stack
3. Based on findings, implement either:
   - **Option A:** `cancelAnimation()` on all mounted shared values via AppState hook
   - **Option B:** Conditional unmount of animated components when backgrounded

This task would require a new plan based on systrace findings.
