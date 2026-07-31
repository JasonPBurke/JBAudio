# Systemic Scroll Performance Diagnosis

**Date**: 2026-02-18
**Branch**: `fix/booksGrid-optimization`
**Problem**: ALL FlashLists in the app drop to 35-45 FPS during scroll with CPU spiking from ~17% to ~170%, regardless of list item complexity

---

## Problem Summary

### Symptoms

- Every FlashList in the app scrolls at 35-45 FPS (target: 60 FPS)
- CPU usage jumps from ~17% (idle) to ~130-170% (scrolling)
- Stripping list items to **single colored rectangles** yields only +3 FPS improvement
- Issue occurs on **release builds** with audio **paused**
- The simpler the list (chapterList), the better the FPS — but still far below 60

### Key Observation

Since reducing component complexity has near-zero impact on FPS, the bottleneck is **not** in renderItem, styles, props, or component tree depth. Something at the **app infrastructure level** is consuming CPU on every scroll frame regardless of what's being rendered.

### Test Subject

The read-only chapter list (`src/app/chapterList.tsx`) opened from titleDetails — the simplest list in the app (View + two Text elements per item, no images, no animations, no press handlers).

### Baseline Measurements (chapterList, scrolling)

| Metric | Idle | Scrolling |
|--------|------|-----------|
| FPS | 60 | 44.2 |
| Total CPU | 17.6% | 167.7% |
| RN JS Thread | ~0% | 53.6% |
| RenderThread | ~0% | 47.5% |
| UI Thread | 14.1% | 26.6% |
| hwuiTask0 | 0% | 15.4% |
| hwuiTask1 | 0% | 15.4% |

### Test Environment

- Device: Pixel 7 Pro
- Build: Release (Hermes bytecode, minified)
- Audio: Paused
- Chapter count: 60+
- Stack: chapterList (transparentModal) → titleDetails (formSheet) → library

---

## Suspects Ranked by Likelihood

### 1. Sentry Session Replay (PRIMARY)

**Location**: `src/app/_layout.tsx` lines 32-49

```typescript
Sentry.init({
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],
});
```

**Why suspected**:
- Session Replay captures screen frames by serializing the view hierarchy on every visible frame change
- During scroll, every frame is a "change" — meaning capture runs at ~60 Hz
- Frame capture involves: view tree serialization → pixel encoding → memory buffering
- This is **global** overhead — applies to ALL screens, ALL lists, regardless of content
- The `SentryReplayInt` thread was visible at 3% CPU even at **idle**
- `replaysOnErrorSampleRate: 1` means ANY session where an error occurs gets full replay (very likely in a complex RN app)
- Explains why stripped-down components don't help: capture cost is per-pixel, not per-component

**Evidence**:
- `SentryReplayInt` thread at 3% CPU during idle
- CPU spike proportional to frame rate (more frames during scroll = more capture work)
- Component complexity has no effect on FPS (frame capture is view-tree level)

### 2. Sentry Performance Monitoring / Tracing

**Location**: `src/app/_layout.tsx` — Sentry.init may enable default tracing

**Why suspected**:
- Sentry may auto-instrument navigation, rendering, and network requests
- `Sentry.wrap(LibraryScreen)` on the library screen adds component profiling
- Transaction/span creation on every navigation event adds JS thread overhead
- Even without explicit `tracesSampleRate`, Sentry may enable "performance monitoring" by default

### 3. Transparent Modal Compositing

**Location**: `src/app/_layout.tsx` line 216-221 (chapterList screen config)

**Why suspected**:
- chapterList uses `presentation: 'transparentModal'` — renders over the previous screen
- Container background is 0.92 opacity (`withOpacity(themeColors.background, 0.92)`)
- The GPU must composite the scrolling list over the screen underneath on every frame
- The screen underneath (titleDetails) has MeshGradientBackground with 6 SVG layers
- "Player is worse" correlation: player has even heavier background → more compositing cost
- This affects RenderThread (47.5%) and hwuiTask threads (15.4% each)
- However: this only explains PART of the overhead and only for modal-presented lists

### 4. Unnecessary Hooks in chapterList (Read-Only Mode)

**Location**: `src/app/chapterList.tsx` lines 34-36

```typescript
const activeTrack = useActiveTrack();        // line 34
const activeChapter = useCurrentChapterStable(); // line 36
```

**Why suspected**:
- Both hooks subscribe to TrackPlayer state, which maintains native → JS bridge traffic
- `useCurrentChapterStable()` internally calls `useActiveTrack()` again (double subscription)
- `renderItem` has `activeChapter` in its dependency array (line 185), meaning any chapter change invalidates the memoized callback
- These are unnecessary in read-only mode — the list doesn't show active state

**Note**: With audio paused, these are likely low-impact, but they represent unnecessary bridge traffic.

### 5. React Compiler (babel-plugin-react-compiler) Overhead

**Location**: `babel.config.js`

```javascript
plugins: [
  ['babel-plugin-react-compiler'],
  ...
]
```

**Why suspected**:
- React Compiler adds automatic memoization wrappers to all components
- Each wrapper has a per-render cost for cache validation (comparing deps)
- On a 60+ item FlashList with recycling, the compiler's generated memo checks run for every recycled item
- The compiler is still relatively new; there may be pathological cases with FlashList v2 + Fabric

### 6. FlashList v2 + Fabric (New Architecture) Interaction

**Why suspected**:
- FlashList v2 is designed for Fabric but may have edge cases on RN 0.79.6
- Fabric's synchronous layout could create contention with FlashList's async recycling
- New Architecture enables JSI (direct C++ calls) but FlashList may still use the old bridge for some operations
- The high JS Thread (53.6%) during scroll of a simple list suggests excessive JS-side work in the list machinery itself

---

## Diagnostic Plan

### Methodology

**Elimination testing**: Disable one suspect at a time, rebuild a release APK, and re-test with Flashlight on the same chapter list scroll test. The suspect whose removal produces the largest FPS improvement is the root cause.

**Test protocol** (same for every test):
1. Open the app, navigate to titleDetails for a 60+ chapter book
2. Open the chapter list (read-only mode)
3. Audio paused
4. Run Flashlight: `flashlight measure`
5. Wait ~2 seconds idle, scroll continuously for ~8 seconds
6. Record: FPS avg, Total CPU %, JS Thread %, RenderThread %, UI Thread %
7. Run 2-3 times, use median

### Phase 1: Sentry Isolation (Highest Priority)

#### Test 1A: Disable Session Replay Only

**Change** in `src/app/_layout.tsx`:
```typescript
Sentry.init({
  dsn: '...',
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0,    // ← was 0.1
  replaysOnErrorSampleRate: 0,    // ← was 1
  integrations: [Sentry.mobileReplayIntegration()],  // keep integration, just disable sampling
});
```

**Build**: `npx expo run:android --variant release`
**Test**: Standard chapter list scroll test
**Expected if this is the cause**: FPS jumps to 55-60, CPU drops to 30-50%

#### Test 1B: Disable Sentry Entirely (if 1A shows partial improvement)

**Change**: Comment out the entire `Sentry.init()` block and the `@sentry/react-native` import in `_layout.tsx`.

**Build & test**: Same protocol
**Purpose**: Reveals whether Sentry's non-replay features (tracing, error handling, breadcrumbs) contribute additional overhead beyond replay.

### Phase 2: Modal Compositing (if Phase 1 < 10 FPS improvement)

#### Test 2A: Make chapterList Background Fully Opaque

**Change** in `src/app/chapterList.tsx`:
```typescript
// Replace withOpacity(themeColors.background, 0.92)
// with just themeColors.background (fully opaque)
backgroundColor: themeColors.background,
```

**Build & test**: Same protocol
**Purpose**: Eliminates per-frame alpha compositing over the gradient background underneath.

#### Test 2B: Change chapterList to formSheet (non-transparent)

**Change** in `src/app/_layout.tsx`:
```typescript
<Stack.Screen
  name='chapterList'
  options={{
    presentation: 'formSheet',           // ← was 'transparentModal'
    animation: 'slide_from_bottom',      // ← was 'fade'
    sheetCornerRadius: 15,
  }}
/>
```

**Build & test**: Same protocol
**Purpose**: Fully removes the transparent overlay. The system no longer needs to composite over the screen underneath.

### Phase 3: App Infrastructure (if Phases 1-2 < 10 FPS improvement)

#### Test 3A: Disable React Compiler

**Change** in `babel.config.js`:
```javascript
plugins: [
  // ['babel-plugin-react-compiler'],   // ← commented out
  ['@babel/plugin-proposal-decorators', { legacy: true }],
  ...
]
```

**Build & test**: Same protocol
**Purpose**: Tests whether the compiler's automatic memoization wrappers add overhead during FlashList recycling.

#### Test 3B: Replace FlashList with FlatList

**Change** in `src/app/chapterList.tsx`:
```typescript
// Replace FlashList import with:
import { FlatList } from 'react-native';

// Replace <FlashList> with <FlatList> (remove FlashList-specific props)
```

**Build & test**: Same protocol
**Purpose**: Tests whether FlashList v2's recycling mechanism on Fabric has overhead compared to React Native's built-in FlatList.

#### Test 3C: Guard Hooks in Read-Only Mode

**Change** in `src/app/chapterList.tsx`:
```typescript
// Only subscribe to TrackPlayer state when not in read-only mode
const activeTrack = isReadOnly ? null : useActiveTrack();
const activeChapter = isReadOnly ? null : useCurrentChapterStable();
```

Note: This requires restructuring to avoid conditional hook calls (React rules of hooks). Use a wrapper pattern:
```typescript
const activeTrack = useActiveTrack();
const activeChapter = useCurrentChapterStable();
// Simply don't use them in the render path when isReadOnly
// The hooks still run but their values don't trigger renders if unused
```

Actually, the hooks will still subscribe and trigger re-renders regardless. A better approach is to split into two components:
```typescript
// ChapterListReadOnly — no TrackPlayer hooks at all
// ChapterListInteractive — current component with all hooks
```

**Build & test**: Same protocol
**Purpose**: Tests whether TrackPlayer subscriptions add JS thread overhead during scroll.

### Phase 4: Deep Profiling (if Phases 1-3 are all < 5 FPS improvement)

If all targeted eliminations fail to identify a single root cause, the issue may be a combination of smaller overheads or a fundamental RN rendering pipeline bottleneck.

#### Test 4A: Bare Minimum Test Screen

Create a temporary screen (`src/app/perfTest.tsx`) with:
- NO Zustand subscriptions
- NO TrackPlayer hooks
- NO theme hooks
- A plain FlatList with 100 static items (Text only)
- Static background color
- Navigate to it directly from the drawer

If this screen scrolls at 60 FPS → the issue is in one or more of the hooks/stores used by real screens.
If this screen ALSO drops FPS → the issue is in the RN runtime, Sentry, or the app shell itself.

#### Test 4B: ADB-Based Perfetto Trace

Set up ADB debugging and capture a proper trace:
```bash
adb shell perfetto \
  -o /data/misc/perfetto-traces/trace.pftrace \
  -t 10s \
  sched/sched_switch \
  sched/sched_waking \
  power/cpu_frequency \
  -a com.fuzzylogic42.JBAudio
```

Analyze in ui.perfetto.dev to identify exact functions consuming JS thread time.

---

## Results Tracking

| Test | Change | FPS | CPU % | JS % | Render % | UI % | Delta FPS |
|------|--------|-----|-------|------|----------|------|-----------|
| Baseline | none | 44.2 | 167.7 | 53.6 | 47.5 | 26.6 | — |
| 1A | No Replay | | | | | | |
| 1B | No Sentry | | | | | | |
| 2A | Opaque BG | | | | | | |
| 2B | formSheet | | | | | | |
| 3A | No Compiler | | | | | | |
| 3B | FlatList | | | | | | |
| 3C | No Hooks | | | | | | |
| 4A | Bare Screen | | | | | | |

---

## Success Criteria

- **Root cause identified**: One test produces >= 10 FPS improvement
- **Root cause confirmed**: Reverting that change drops FPS back to baseline
- **Path to fix clear**: The identified cause has a reasonable fix or configuration change

## Next Steps After Diagnosis

Once the root cause is identified:
1. Implement a proper fix (not just the test workaround)
2. Re-test ALL lists in the app to confirm the systemic improvement
3. Revisit the Feb 16 BooksHome optimization plan — the component-level optimizations may now produce meaningful gains on top of the infrastructure fix
4. Update the Feb 16 plan's baseline measurements with the new infrastructure

---

## Key Files

| File | Role |
|------|------|
| `src/app/_layout.tsx` | Sentry.init, app shell, navigation config |
| `src/app/chapterList.tsx` | Test subject (simplest list) |
| `src/app/titleDetails.tsx` | Parent screen for chapterList |
| `babel.config.js` | React Compiler configuration |
| `src/components/PlayerStateSync.tsx` | Root-level TrackPlayer subscription |
| `src/store/library.tsx` | Zustand store with WatermelonDB observer |
| `src/hooks/useCurrentChapterStable.ts` | TrackPlayer event subscriptions |
