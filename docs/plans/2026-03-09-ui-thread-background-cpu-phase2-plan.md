# UI Thread Background CPU — Phase 2 Investigation Plan

## Context

We've been investigating ~20% UI thread CPU usage when the app is backgrounded. Through systematic elimination testing, we've identified and fixed one source (Reanimated Choreographer) and narrowed the remaining ~13% to TrackPlayer's native layer.

### What's been proven so far

| Test | Result | Conclusion |
|---|---|---|
| ReducedMotionConfig toggle (System/Always) | ~20% → ~0% (no TrackPlayer) | Reanimated Choreographer was ~6-8% of the issue — **FIXED** |
| FloatingPlayer returning null before hooks | Still ~13% | FloatingPlayer UI/hooks not the cause |
| PlayerStateSync returning null before hooks | Still ~13% | useIsPlaying/useActiveTrack hooks not the cause |
| progressUpdateEventInterval: 9999 | Still ~13% | Progress events not the cause |
| No TrackPlayer loaded at all | ~0% | **TrackPlayer's native layer is the source** |

### What's still open

The ~13% appears the moment TrackPlayer loads a track (even paused) and persists identically whether foregrounded or backgrounded. This points to something in the native layer: ExoPlayer, the foreground service, media notification, or MediaSession.

## Plan: Next Investigation Steps

### Step 1: Revert diagnostic changes ✅ DONE

Reverted the three temporary diagnostic changes:
- `src/components/FloatingPlayer.tsx` — removed early `return null`
- `src/components/PlayerStateSync.tsx` — removed early `return null`
- `src/hooks/useSetupTrackPlayer.tsx` — restored `progressUpdateEventInterval: 1`

### Step 2: Capture Android systrace

Use Android Studio CPU Profiler or `adb shell perfetto` to capture a trace while:
1. App is backgrounded with a paused track loaded
2. Record for ~10 seconds

Filter to the UI thread and inspect the call stack to identify the exact native methods consuming CPU. This will show whether the work is from:
- ExoPlayer's internal loop
- MediaSession/notification updates
- TrackPlayer's KotlinAudio layer
- Something else entirely

### Step 3: Test notification removal (if systrace points to notification)

TrackPlayer v5 alpha uses a foreground service with a persistent notification. Test whether disabling notification capabilities reduces CPU:

**File:** `src/hooks/useSetupTrackPlayer.tsx`

Temporarily remove `notificationCapabilities` or set it to an empty array to see if the notification update loop is the source.

### Step 4: Test with ExoPlayer idle mode (if systrace points to ExoPlayer)

Check if TrackPlayer v5 exposes any configuration for ExoPlayer's wake mode or idle behavior. When paused, ExoPlayer may still maintain buffers and a connection to the audio focus system. Options to test:
- Release audio focus on pause
- Check TrackPlayer's `android.audio.offload` or similar settings
- Check if there's a `waitForPlayerNotification` or similar config

### Step 5: Compare with other TrackPlayer apps

Search for known issues in the `react-native-track-player` GitHub repo related to background CPU usage on Android. This is a v5 alpha nightly build — there may be known regressions or configuration options.

**Search queries:**
- `background CPU` in react-native-track-player issues
- `ExoPlayer idle` / `foreground service CPU`
- KotlinAudio background behavior

### Step 6: Evaluate fix options based on findings

Depending on systrace results:

| Finding | Fix approach |
|---|---|
| Notification updates | Reduce notification update frequency or stop updates when paused |
| ExoPlayer internal loop | Configure ExoPlayer wake mode or release resources on pause |
| MediaSession callbacks | Adjust MediaSession configuration |
| KotlinAudio layer | File issue upstream or patch locally |

## Files to modify

- `src/hooks/useSetupTrackPlayer.tsx` — TrackPlayer configuration
- `src/setup/service.js` — playback service (if service-level changes needed)
- Potentially native Android files if TrackPlayer config isn't sufficient

## Current state of the codebase

The ReducedMotionConfig fix in `src/app/_layout.tsx` is ready to commit (confirmed working — brings non-TrackPlayer background CPU to ~0%). The three diagnostic test changes in FloatingPlayer, PlayerStateSync, and useSetupTrackPlayer need to be reverted.

## Action on exit: Save to docs/plans/2026-03-09-ui-thread-background-cpu-phase2-plan.md

## Verification

After each investigation step, measure with Flashlight:
- Load a book into TrackPlayer, pause it
- Background the app
- Target: UI thread < 5%
