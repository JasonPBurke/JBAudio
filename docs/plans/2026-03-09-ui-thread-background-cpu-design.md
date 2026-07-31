# UI Thread Background CPU Investigation & Fix

## Problem

When the app is backgrounded (both paused and playing states), the UI thread sustains ~18-20% CPU usage as measured by Flashlight. The usage is nearly identical in both states, indicating the cause is unrelated to playback.

## Root Cause Hypothesis

Reanimated's `Choreographer.FrameCallback` on Android fires at vsync rate (~60fps) as long as any `useSharedValue` or `useAnimatedStyle` hook is mounted — even with zero active animations. When backgrounded, the player screen is unmounted (via `navigation.goBack()`), but the library screen remains mounted with several Reanimated-instrumented components:

| Component | Reanimated Hooks |
|---|---|
| FloatingPlayer (PlayPauseButton, SeekBackButton) | 3x useSharedValue, 2x useAnimatedStyle |
| SearchBar | 1x useAnimatedStyle |
| Header / PulsingText | 1x useSharedValue, 1x useAnimatedStyle |
| TabButtons | 2x useSharedValue, 1x useAnimatedStyle |
| useScrollDirection | 1x useSharedValue |

TrackPlayer's foreground service keeps the process alive, so Android never fully suspends the Choreographer loop.

## Conditions During Testing

- Sleep timer: off
- Fade time: none
- Bedtime mode: off

## Design

### Phase 1: ReducedMotionConfig Toggle (Primary Approach)

Toggle Reanimated's `ReducedMotionConfig` mode based on `AppState`:

- **Active/Inactive:** `ReduceMotion.System` (respects device accessibility settings)
- **Background:** `ReduceMotion.Always` (disables all animations)

**Location:** Root layout (`src/app/_layout.tsx`) — already has an AppState listener.

**Decision gate after Flashlight measurement:**

| Result | Meaning | Action |
|---|---|---|
| UI thread < 5% | ReduceMotion.Always deregisters Choreographer loop | Ship Phase 1 as the fix |
| UI thread still ~20% | ReducedMotionConfig doesn't affect frame callback registration | Proceed to Phase 2 |

### Phase 2: Fallback (only if Phase 1 fails)

**Option A — Cancel animations on background:**
- Create `useBackgroundAnimationPause` hook
- On background: `cancelAnimation()` on every mounted shared value
- Integrate into: FloatingPlayer, SearchBar, Header, TabButtons, useScrollDirection

**Option B — Conditional unmount (last resort):**
- Gate animated components with `{isActive && <AnimatedComponent />}`
- Replace with static equivalents when backgrounded

## Success Criteria

- UI thread CPU when backgrounded: < 5% (ideally near 0%)
- No visual glitches on foreground return
- No functional regressions
- Playback and notification controls unaffected
