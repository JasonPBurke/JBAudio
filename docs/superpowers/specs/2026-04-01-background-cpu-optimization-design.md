# Background CPU Optimization Design

**Date:** 2026-04-01
**Branch:** `fix/stop-unneeded-cpu-on-background`
**Status:** Approved

## Problem

The player screen (`player.tsx`) currently dismisses itself when the app is backgrounded and restores when foregrounded. This was a blunt approach to reduce CPU usage, but it causes a jarring navigation experience and doesn't address the real sources of unnecessary background work — most of which occur at the service and hook layers, not the component tree.

Since this is an audiobook player, the primary use case is background playback (screen off, other apps in foreground). The app should use only the CPU required for essential background functions.

## Approach: Hybrid — Service Gate + Component Suspension

Two-layer optimization using a single `isBackground` flag in a Zustand store:

1. **Service layer**: Gates non-essential Zustand store updates and timer settings cache refresh.
2. **Component layer**: Player screen hooks skip event processing while backgrounded; snap to current values on foreground.
3. **Removal**: The existing dismiss/restore navigation flow is deleted entirely.

## What Keeps Running in Background

| System | Component | Why |
|--------|-----------|-----|
| TrackPlayer native | ExoPlayer, MediaSession, notification | Core playback |
| Sleep timer core | `onProgressTick()`, fade-out, expiry, chapter countdown | Timer must function in background; future shake-to-wake depends on it |
| Chapter boundary detection | `findChapterIndexByPosition()` + DB writes | Sleep timer chapter mode; lock screen metadata updates |
| Lock screen metadata | `updateMetadataForTrack()` | User-visible chapter title on notification |
| 30-second DB progress save | `updateChapterProgressInDB()` | Defense in depth for force-close data loss |
| Book end detection | Position >= duration - 0.2s | Must detect completion in background |
| Reanimated animation suspension | `ReducedMotionConfig` set to `Always` | Already implemented |

## What Gets Paused in Background

| System | Component | Why safe to pause |
|--------|-----------|-------------------|
| `setPlaybackProgress()` | Zustand UI update (1s) | No subscriber needs it while backgrounded; UI catches up on foreground |
| `setPlaybackIndex()` | Zustand UI update (on chapter change) | DB write on same code path persists the real value |
| Sleep timer settings cache refresh | 1s DB re-read | User cannot change settings while app is backgrounded |
| `useProgressReanimated` | Shared value updates (1s) | No visible UI to drive |
| `BookTimeRemaining` | Text recalculation (5s) | No visible UI |
| `useCurrentChapterStable` | Chapter derivation | No visible UI |

## Design

### 1. The `isBackground` Signal

**Store (`src/store/playerState.ts`):**
- Remove `wasPlayerScreenDismissedToBackground` and its setter `setWasPlayerScreenDismissedToBackground`
- Add `isBackground: boolean` (default `false`) and `setIsBackground: (value: boolean) => void`

**Signal source (`src/app/_layout.tsx`):**
- The existing AppState listener (line 136) already tracks background state as local component state. Add a call to `usePlayerStateStore.getState().setIsBackground(...)` alongside the existing local `setIsBackground` setter.
- The local state remains for `ReducedMotionConfig` to avoid adding a store subscription re-render.

### 2. Service Layer Gating (`src/setup/service.js`)

**New import required:** `import { usePlayerStateStore } from '@/store/playerState';`

**In the `PlaybackProgressUpdated` handler (line 86):**

```
const isBackground = usePlayerStateStore.getState().isBackground;
```

Read the flag once at the top of the handler. Gate the following with `if (!isBackground)`:

- `setPlaybackProgress(bookId, progress)` (single-file path, line 118)
- `setPlaybackProgress(bookId, position)` (multi-file path, line 217)
- `setPlaybackIndex(bookId, chapterIndex)` (line 148)

Everything else in the handler runs unconditionally.

**In the `PlaybackActiveTrackChanged` handler (line 329):**

Gate the Zustand UI update with `if (!isBackground)`:

- `setPlaybackIndex(trackAtIndex.bookId, event.index)` (line 347)

The DB write (`updateChapterIndexInDB`, line 349) and `sleepTimer.onChapterChanged()` (line 352) remain ungated.

**In the `PlaybackQueueEnded` handler (line 224):**

Not gated. This fires at most once per book at completion and is immediately followed by a stop. Background occurrence is a non-issue, and the Zustand reset-to-zero values are correct for the next foreground view.

**Sleep timer settings cache (`src/setup/sleepTimer.ts`):**

**New import required:** `import { usePlayerStateStore } from '@/store/playerState';`

In `onProgressTick()`, the settings refresh check (governed by `SETTINGS_REFRESH_INTERVAL`) should be gated:

```
const isBackground = usePlayerStateStore.getState().isBackground;
if (!isBackground && now - lastRefreshedAt >= SETTINGS_REFRESH_INTERVAL) {
  // refresh settings from DB
}
```

The existing AppState listener in `sleepTimer.ts` already invalidates the cache (`lastRefreshedAt = 0`) on foreground, so the first tick after foregrounding will re-read settings.

### 3. Component Layer Suspension

Each hook reads `usePlayerStateStore.getState().isBackground` inside its existing event callback and early-returns if `true`. No props, no re-renders.

**`src/hooks/useProgressReanimated.ts`:**
- `PlaybackProgressUpdated` listener (line 42): Check `isBackground`, early-return if true.
- `PlaybackActiveTrackChanged` listener (line 52): Check `isBackground`, early-return if true.
- `PlaybackState` listener (line 67): Check `isBackground`, early-return if true.
- Add a `useEffect` that subscribes to `usePlayerStateStore.subscribe()` and watches for `isBackground` transitioning `true -> false`. On transition, call `TrackPlayer.getProgress()` and set shared values directly (instant snap).

**`src/components/BookTimeRemaining.tsx`:**
- Inner component's `PlaybackProgressUpdated` listener (line 125): Check `isBackground`, early-return if true.
- Add a foreground snap subscription (same pattern): call `TrackPlayer.getProgress()`, recalculate remaining text, set state.
- Note: `BookTimeRemaining` is mounted in both `player.tsx` and `FloatingPlayer.tsx`. Each instance creates its own event subscription via the inner component's `useEffect`, so both instances benefit from the same gate/snap pattern without special handling.

**`src/hooks/useCurrentChapterStable.ts`:**
Three event listeners to gate:
- `PlaybackActiveTrackChanged` listener (line 94): Check `isBackground`, early-return if true.
- `PlaybackProgressUpdated` listener (line 106, single-file books only): Check `isBackground`, early-return if true.
- `PlaybackState` listener (line 115): Check `isBackground`, early-return if true.
- Add foreground snap subscription: re-derive current chapter from `TrackPlayer.getProgress()`.
- Note: All consumers of this hook (`PlayerProgressBar`, `PlayerChaptersModal`, `chapterList`) are children of the player screen. Gating is safe since none are visible while backgrounded.

### 4. Foreground Recovery Flow

When `isBackground` transitions `true -> false`:

1. **Service layer**: Next progress event (within 1s) resumes Zustand updates automatically.
2. **Component hooks**: Zustand subscribe callbacks fire immediately, each calls `TrackPlayer.getProgress()` and snaps to current values.
3. **Sleep timer settings**: Cache invalidated, next tick re-reads from DB.

No orchestration needed. Each layer independently reacts to the same flag.

### 5. Code Removals

**File deleted:**
- `src/hooks/usePlayerScreenRestoration.ts` — entire file

**`src/app/player.tsx`:**
- Remove `AppState` from react-native imports
- Remove `useNavigation` import and usage
- Remove `appState` ref
- Remove `usePlayerStateStore` selector for `setWasPlayerScreenDismissedToBackground`
- Remove the entire AppState `useEffect` that dismisses the player (lines 83-102)

**`src/app/_layout.tsx`:**
- Remove `usePlayerScreenRestoration()` call
- Remove its import

**`src/store/playerState.ts`:**
- Remove `wasPlayerScreenDismissedToBackground` and its setter
- (Replaced by `isBackground` and `setIsBackground`)

### 6. Unaffected Components

- **`PlayerStateSync`** (`src/components/PlayerStateSync.tsx`): Uses `usePlayerStateStore` to set `isPlaying` and `activeBookId`. Does not read `isBackground`. No changes needed.
- **`FloatingPlayer`** (`src/components/FloatingPlayer.tsx`): Contains a `BookTimeRemaining` instance (covered above). No other changes needed.
- **WatermelonDB observers** (`src/store/library.tsx`): Event-driven, low impact, only fire on actual DB mutations. No changes needed.

## Future Considerations

- **Shake-to-wake:** The `isBackground` flag in the store provides a clean hook point. An accelerometer listener can subscribe to `isBackground` to start/stop listening for shake gestures after sleep timer expiry.
- **Progress event interval:** Currently 1s. If native TrackPlayer CPU (~13%) becomes a concern, reducing to 5-10s while backgrounded via `TrackPlayer.updateOptions()` is a future option, but risks sleep timer fade granularity.
- **WatermelonDB observer:** Event-driven, low impact. No changes needed now.
