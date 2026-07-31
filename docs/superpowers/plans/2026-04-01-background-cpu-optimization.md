# Background CPU Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the player screen dismiss/restore flow with targeted background CPU optimization that pauses unnecessary UI work while keeping essential playback, sleep timer, and persistence services running.

**Architecture:** A single `isBackground` flag in the `usePlayerStateStore` Zustand store is set by the AppState listener in `_layout.tsx`. The service layer (`service.js`, `sleepTimer.ts`) reads it to skip Zustand UI updates. Player screen hooks read it to skip event processing and snap to current values when foregrounding.

**Tech Stack:** React Native 0.79, Zustand, react-native-track-player 5 alpha, react-native-reanimated 4.1.3

**Spec:** `docs/superpowers/specs/2026-04-01-background-cpu-optimization-design.md`

---

### Task 1: Update `usePlayerStateStore` — Replace dismiss flag with `isBackground`

**Files:**
- Modify: `src/store/playerState.ts`

- [ ] **Step 1: Replace the dismiss flag with `isBackground`**

In `src/store/playerState.ts`, replace the interface and store definition:

```typescript
// In the PlayerState interface, replace:
//   wasPlayerScreenDismissedToBackground: boolean;
//   setWasPlayerScreenDismissedToBackground: (value: boolean) => void;
// With:
  isBackground: boolean;
  setIsBackground: (value: boolean) => void;
```

```typescript
// In the create() call, replace:
//   wasPlayerScreenDismissedToBackground: false,
//   setWasPlayerScreenDismissedToBackground: (value) =>
//     set({ wasPlayerScreenDismissedToBackground: value }),
// With:
  isBackground: false,
  setIsBackground: (value) => set({ isBackground: value }),
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: Errors in `player.tsx`, `_layout.tsx`, and `usePlayerScreenRestoration.ts` referencing the removed property. These will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/store/playerState.ts
git commit -m "Refactor: replace wasPlayerScreenDismissedToBackground with isBackground flag"
```

---

### Task 2: Remove player screen dismiss/restore flow

**Files:**
- Modify: `src/app/player.tsx` (lines 1-20 imports, lines 62-102 dismiss logic)
- Modify: `src/app/_layout.tsx` (line 26 import, line 146 setter, line 159 hook call)
- Delete: `src/hooks/usePlayerScreenRestoration.ts`

- [ ] **Step 1: Clean up `player.tsx` — remove dismiss logic**

In `src/app/player.tsx`:

Remove `AppState` from the react-native import (line 6):
```typescript
// Change:
import {
  StyleSheet,
  View,
  ActivityIndicator,
  AppState,
} from 'react-native';
// To:
import {
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
```

Remove the `useNavigation` import (line 9):
```typescript
// Delete this line:
import { useNavigation } from '@react-navigation/native';
```

Remove the `usePlayerStateStore` import (line 15):
```typescript
// Delete this line:
import { usePlayerStateStore } from '@/store/playerState';
```

Inside the `PlayerScreen` component, remove these lines (62-102):
```typescript
// Delete:
  const appState = useRef(AppState.currentState);
  const navigation = useNavigation();

// Delete the entire usePlayerStateStore selector (lines 75-80):
  const setWasPlayerScreenDismissedToBackground = usePlayerStateStore(
    useCallback(
      (state) => state.setWasPlayerScreenDismissedToBackground,
      [],
    ),
  );

// Delete the entire AppState useEffect (lines 83-102):
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        if (
          appState.current.match(/active|inactive/) &&
          nextAppState === 'background'
        ) {
          setWasPlayerScreenDismissedToBackground(true);
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }
        appState.current = nextAppState;
      },
    );
    return () => subscription.remove();
  }, [navigation, setWasPlayerScreenDismissedToBackground]);
```

Also clean up the import line for `useRef` if it's no longer used — check if `useRef` is still needed (it is NOT used elsewhere in `player.tsx`):
```typescript
// Change:
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
// To:
import React, { useCallback, useMemo } from 'react';
```

Note: `useEffect` is also no longer used in `player.tsx` after removing the AppState listener — remove it from the import too.

- [ ] **Step 2: Clean up `_layout.tsx` — remove restoration hook, add store setter**

In `src/app/_layout.tsx`:

Remove the import (line 26):
```typescript
// Delete this line:
import { usePlayerScreenRestoration } from '@/hooks/usePlayerScreenRestoration';
```

Add the store import (near existing imports):
```typescript
import { usePlayerStateStore } from '@/store/playerState';
```

In the AppState listener (line 146), add the store update alongside the existing local state setter:
```typescript
// Change:
        setIsBackground(nextAppState === 'background');
// To:
        const bg = nextAppState === 'background';
        setIsBackground(bg);
        usePlayerStateStore.getState().setIsBackground(bg);
```

Remove the hook call (line 158-159):
```typescript
// Delete these lines:
  // Restore player screen when app returns from background
  usePlayerScreenRestoration();
```

- [ ] **Step 3: Delete `usePlayerScreenRestoration.ts`**

```bash
rm src/hooks/usePlayerScreenRestoration.ts
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: No errors related to the removed code. If there are other pre-existing errors, ignore them.

- [ ] **Step 5: Commit**

```bash
git add src/app/player.tsx src/app/_layout.tsx
git rm src/hooks/usePlayerScreenRestoration.ts
git commit -m "Fix: remove player screen dismiss/restore on background

Replace with isBackground flag in usePlayerStateStore, set by
the existing AppState listener in _layout.tsx."
```

---

### Task 3: Gate service layer — `service.js`

**Files:**
- Modify: `src/setup/service.js` (lines 1-19 imports, lines 86-220 progress handler, lines 329-354 track changed handler)

- [ ] **Step 1: Add the store import**

At the top of `src/setup/service.js`, add after the existing imports (after line 16):
```javascript
import { usePlayerStateStore } from '@/store/playerState';
```

- [ ] **Step 2: Gate Zustand UI updates in `PlaybackProgressUpdated` handler**

At the top of the `PlaybackProgressUpdated` callback (line 88, after `async ({ position, track }) => {`), add:
```javascript
      const isBackground = usePlayerStateStore.getState().isBackground;
```

Gate the single-file `setPlaybackProgress` (line 118):
```javascript
      // Change:
        setPlaybackProgress(trackToUpdate.bookId, progressWithinChapter);
      // To:
        if (!isBackground) {
          setPlaybackProgress(trackToUpdate.bookId, progressWithinChapter);
        }
```

Gate the `setPlaybackIndex` (line 148):
```javascript
      // Change:
          setPlaybackIndex(trackToUpdate.bookId, currentChapterIndex);
      // To:
          if (!isBackground) {
            setPlaybackIndex(trackToUpdate.bookId, currentChapterIndex);
          }
```

Gate the multi-file `setPlaybackProgress` (line 217):
```javascript
      // Change:
        setPlaybackProgress(trackToUpdate.bookId, position);
      // To:
        if (!isBackground) {
          setPlaybackProgress(trackToUpdate.bookId, position);
        }
```

- [ ] **Step 3: Gate Zustand UI update in `PlaybackActiveTrackChanged` handler**

In the `PlaybackActiveTrackChanged` handler (line 346-347):
```javascript
      // Change:
      setPlaybackIndex(trackAtIndex.bookId, event.index);
      // To:
      if (!usePlayerStateStore.getState().isBackground) {
        setPlaybackIndex(trackAtIndex.bookId, event.index);
      }
```

Note: The DB write (`updateChapterIndexInDB`) and `sleepTimer.onChapterChanged()` below it remain ungated.

- [ ] **Step 4: Verify no syntax errors**

Run: `npx tsc --noEmit 2>&1 | grep service`

Expected: No errors in service.js (it may not appear at all since it's a .js file — that's fine).

- [ ] **Step 5: Commit**

```bash
git add src/setup/service.js
git commit -m "Fix: skip Zustand UI updates in service layer when backgrounded"
```

---

### Task 4: Gate sleep timer settings cache — `sleepTimer.ts`

**Files:**
- Modify: `src/setup/sleepTimer.ts` (lines 1-16 imports, lines 241-260 onProgressTick)

- [ ] **Step 1: Add the store import**

At the top of `src/setup/sleepTimer.ts`, add after the existing imports (after line 12):
```typescript
import { usePlayerStateStore } from '@/store/playerState';
```

- [ ] **Step 2: Gate the settings cache refresh in `onProgressTick`**

In the `onProgressTick` function (lines 243-260), add the `isBackground` check:
```typescript
// Change:
  const nowTs = Date.now();
  if (
    !cachedTimer.lastRefreshedAt ||
    nowTs - cachedTimer.lastRefreshedAt >= SETTINGS_REFRESH_INTERVAL
  ) {
// To:
  const nowTs = Date.now();
  const isBackground = usePlayerStateStore.getState().isBackground;
  if (
    !isBackground &&
    (!cachedTimer.lastRefreshedAt ||
      nowTs - cachedTimer.lastRefreshedAt >= SETTINGS_REFRESH_INTERVAL)
  ) {
```

Note: The existing AppState listener at line 515 already invalidates the cache (`lastRefreshedAt = 0`) on foreground, so the first tick after foregrounding will re-read settings from DB.

- [ ] **Step 3: Commit**

```bash
git add src/setup/sleepTimer.ts
git commit -m "Fix: skip sleep timer settings cache refresh when backgrounded"
```

---

### Task 5: Suspend `useProgressReanimated` hook

**Files:**
- Modify: `src/hooks/useProgressReanimated.ts`

- [ ] **Step 1: Add the store import**

At the top of `src/hooks/useProgressReanimated.ts`, add after existing imports:
```typescript
import { usePlayerStateStore } from '@/store/playerState';
```

- [ ] **Step 2: Add `isBackground` early-return to all three event listeners**

In the `PlaybackProgressUpdated` listener (line 43-48), add an early-return:
```typescript
// Change:
    const progressSubscription = TrackPlayer.addEventListener(
      Event.PlaybackProgressUpdated,
      (event) => {
        position.value = event.position;
        duration.value = event.duration;
        buffered.value = event.buffered;
      }
    );
// To:
    const progressSubscription = TrackPlayer.addEventListener(
      Event.PlaybackProgressUpdated,
      (event) => {
        if (usePlayerStateStore.getState().isBackground) return;
        position.value = event.position;
        duration.value = event.duration;
        buffered.value = event.buffered;
      }
    );
```

In the `PlaybackActiveTrackChanged` listener (line 52-64), add early-return:
```typescript
// Change:
    const trackChangedSubscription = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      async () => {
        try {
// To:
    const trackChangedSubscription = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      async () => {
        if (usePlayerStateStore.getState().isBackground) return;
        try {
```

In the `PlaybackState` listener (line 67-79), add early-return:
```typescript
// Change:
    const seekSubscription = TrackPlayer.addEventListener(
      Event.PlaybackState,
      async () => {
        try {
// To:
    const seekSubscription = TrackPlayer.addEventListener(
      Event.PlaybackState,
      async () => {
        if (usePlayerStateStore.getState().isBackground) return;
        try {
```

- [ ] **Step 3: Add foreground snap subscription**

After the existing `return` cleanup function (line 81-85), add a new `useEffect` for the foreground snap. Add this as a second `useEffect` in the hook:

```typescript
  // Snap to current values when returning from background
  useEffect(() => {
    const unsubscribe = usePlayerStateStore.subscribe(
      (state, prevState) => {
        if (prevState.isBackground && !state.isBackground) {
          TrackPlayer.getProgress().then((progress) => {
            position.value = progress.position;
            duration.value = progress.duration;
            buffered.value = progress.buffered;
          }).catch(() => {});
        }
      }
    );
    return unsubscribe;
  }, [position, duration, buffered]);
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useProgressReanimated.ts
git commit -m "Fix: suspend useProgressReanimated updates when backgrounded"
```

---

### Task 6: Suspend `BookTimeRemaining` updates

**Files:**
- Modify: `src/components/BookTimeRemaining.tsx` (lines 76-155, inner component)

- [ ] **Step 1: Add the store import**

At the top of `src/components/BookTimeRemaining.tsx`, add after existing imports:
```typescript
import { usePlayerStateStore } from '@/store/playerState';
```

- [ ] **Step 2: Add `isBackground` early-return to progress listener**

In `BookTimeRemainingInner`, in the `PlaybackProgressUpdated` listener (line 125-135):
```typescript
// Change:
      const subscription = TrackPlayer.addEventListener(
        Event.PlaybackProgressUpdated,
        ({ position }) => {
          // Only update every 5 seconds to reduce re-renders
          const currentBucket = Math.floor(position / 5);
// To:
      const subscription = TrackPlayer.addEventListener(
        Event.PlaybackProgressUpdated,
        ({ position }) => {
          if (usePlayerStateStore.getState().isBackground) return;
          const currentBucket = Math.floor(position / 5);
```

- [ ] **Step 3: Add foreground snap subscription**

Inside `BookTimeRemainingInner`, add a new `useEffect` after the existing progress subscription `useEffect` (after line 138):

```typescript
    // Snap to current values when returning from background
    useEffect(() => {
      const unsubscribe = usePlayerStateStore.subscribe(
        (state, prevState) => {
          if (prevState.isBackground && !state.isBackground) {
            TrackPlayer.getProgress().then(({ position }) => {
              lastUpdateRef.current = Math.floor(position / 5);
              setRemainingText(calculateRemaining(position));
            }).catch(() => {});
          }
        }
      );
      return unsubscribe;
    }, [calculateRemaining]);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/BookTimeRemaining.tsx
git commit -m "Fix: suspend BookTimeRemaining updates when backgrounded"
```

---

### Task 7: Suspend `useCurrentChapterStable` updates

**Files:**
- Modify: `src/hooks/useCurrentChapterStable.ts` (lines 73-131, main useEffect)

- [ ] **Step 1: Add the store import**

At the top of `src/hooks/useCurrentChapterStable.ts`, add after existing imports:
```typescript
import { usePlayerStateStore } from '@/store/playerState';
```

- [ ] **Step 2: Add `isBackground` early-return to all three event listeners**

In the `PlaybackActiveTrackChanged` listener (line 94-97):
```typescript
// Change:
    const trackChangedSubscription = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      updateFromPosition
    );
// To:
    const trackChangedSubscription = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      () => {
        if (usePlayerStateStore.getState().isBackground) return;
        updateFromPosition();
      }
    );
```

In the `PlaybackProgressUpdated` listener (line 106-112):
```typescript
// Change:
    const progressSubscription = TrackPlayer.addEventListener(
      Event.PlaybackProgressUpdated,
      ({ position }) => {
        positionRef.current = position;
        updateChapterIfChanged(findChapter(position));
      }
    );
// To:
    const progressSubscription = TrackPlayer.addEventListener(
      Event.PlaybackProgressUpdated,
      ({ position }) => {
        if (usePlayerStateStore.getState().isBackground) return;
        positionRef.current = position;
        updateChapterIfChanged(findChapter(position));
      }
    );
```

In the `PlaybackState` listener (line 115-118):
```typescript
// Change:
    const seekSubscription = TrackPlayer.addEventListener(
      Event.PlaybackState,
      updateFromPosition
    );
// To:
    const seekSubscription = TrackPlayer.addEventListener(
      Event.PlaybackState,
      () => {
        if (usePlayerStateStore.getState().isBackground) return;
        updateFromPosition();
      }
    );
```

- [ ] **Step 3: Add foreground snap subscription**

Add a new `useEffect` after the main one (after line 131):

```typescript
  // Snap to current chapter when returning from background
  useEffect(() => {
    const unsubscribe = usePlayerStateStore.subscribe(
      (state, prevState) => {
        if (prevState.isBackground && !state.isBackground) {
          TrackPlayer.getProgress().then(({ position }) => {
            positionRef.current = position;
            updateChapterIfChanged(findChapter(position));
          }).catch(() => {});
        }
      }
    );
    return unsubscribe;
  }, [findChapter, updateChapterIfChanged]);
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCurrentChapterStable.ts
git commit -m "Fix: suspend useCurrentChapterStable updates when backgrounded"
```

---

### Task 8: Manual verification

**Files:** None — runtime testing only.

- [ ] **Step 1: Build the app**

Run: `npx expo run:android`

Expected: Successful build with no errors.

- [ ] **Step 2: Test background/foreground cycle with player open**

1. Open the app, start playing a book
2. Open the player screen
3. Background the app (press home button)
4. Wait 30+ seconds
5. Return to the app

Verify:
- Player screen is still visible (NOT dismissed)
- Progress bar snaps to current position immediately
- Time remaining text is correct
- Chapter info is correct (if applicable)
- Playback continues uninterrupted throughout

- [ ] **Step 3: Test sleep timer in background**

1. Set a duration-based sleep timer (e.g., 2 minutes)
2. Background the app
3. Wait for the timer to expire

Verify:
- Sleep timer fires correctly and pauses playback
- If fade-out is enabled, volume fades smoothly
- Lock screen notification reflects the pause

- [ ] **Step 4: Test lock screen notification**

While app is backgrounded and playing:
- Lock screen notification shows correct chapter title
- Progress bar on notification updates
- Play/pause controls work from notification
- Skip forward/backward works from notification

- [ ] **Step 5: Test chapter boundary crossing in background**

1. Seek to near the end of a chapter
2. Background the app
3. Wait for the chapter to change

Verify:
- Lock screen notification updates to new chapter title
- When returning to app, player shows correct chapter
- Sleep timer chapter countdown works if active

- [ ] **Step 6: Commit final state (if any fixes were needed)**

```bash
git add -A
git commit -m "Fix: address any issues found during manual testing"
```
