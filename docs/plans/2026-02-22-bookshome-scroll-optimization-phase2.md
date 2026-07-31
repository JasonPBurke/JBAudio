# BooksHome Scroll Optimization — Phase 2 Plan

## Context

Phase 1 implemented diagnostic isolation tests and quick wins. Flashlight testing and React DevTools profiling are now complete. The original hypotheses have been tested and we have confirmed root causes with data.

### Phase 1 Diagnostic Results

| Test | FPS | JS Thread | Total CPU | RAM | Score |
|------|-----|-----------|-----------|-----|-------|
| Original baseline (pre-changes) | 36.1 | 67.8% | 164.2% | — | — |
| `none` (with Phase 1 optimizations) | 33.3 | 71.2% | 175.1% | 854.8 MB | 58 |
| `minimal` (60 empty Views) | 38.4 | 50.2% | 132.4% | 489.1 MB | 69 |
| `scrollview` (no FlashList) | 30.7 | 96.7% | 208.9% | 1088 MB | 0 |
| `no-subscriptions` (static items) | 41.3 | 53.7% | 127.1% | 514.9 MB | 72 |

React DevTools Ranked view: commit durations of **50-203ms** during scroll (budget: 16ms). `BooksHorizontal` re-renders show "Props changed: (authors)" — new sections mounting is the expensive operation.

### Hypotheses Confirmed/Rejected

- **FlashList is NOT the bottleneck** — ScrollView test was catastrophic (30.7 FPS, JS 96.7%). FlashList virtualization is essential.
- **Store subscriptions ARE the #1 bottleneck** — removing hooks gives +8 FPS and -17.5% JS thread.
- **Removing `'use no memo'` REGRESSED performance** — 33.3 FPS vs 36.1 baseline = -3 FPS.
- **~50% JS baseline exists OUTSIDE BooksHome** — even empty Views only reach 38.4 FPS.

---

## Confirmed Root Causes

### 1. BookGridItem store subscriptions (17.5% JS thread overhead)

Each BookGridItem mounts **6+ hooks** per item:
- `useBookById(bookId)` — returns **FULL Book object with chapters[]** (HIGH cost, unnecessary during scroll)
- `useBookDisplayData(bookId)` — 7 display fields via `useShallow` (medium)
- `useIsBookActive(bookId)` — boolean comparison (low)
- **BookPlayButton** adds: `useQueueStore(activeBookId)` (REDUNDANT with playerState), `useQueueStore(setActiveBookId)`, `useIsBookActive(bookId)` (DUPLICATE of parent), `useIsBookActiveAndPlaying(bookId)`

**Key finding**: `useBookById` fetches the entire Book including chapters[] — only needed on press, not during scroll.

### 2. React Compiler interference (-3 FPS regression)

Removing `'use no memo'` from BooksHome/useScrollDirection caused a measurable regression. The Compiler's tracking machinery adds overhead in the hot scroll path.

### 3. External baseline cost (~50% JS thread)

Identified contributors:
- **PulsingText** in Header: infinite `withRepeat` animation even when not scanning
- **FloatingPlayer**: `useActiveTrack()`, `useBookById()`, BookTimeRemaining progress events
- **TrackPlayer progress events**: `progressUpdateEventInterval: 1` fires every frame

---

## Implementation Steps

### Step 1: Restore `'use no memo'` in scroll path files

**Rationale**: Clear -3 FPS regression from removing it.

**Files**:
- `src/components/BooksHome.tsx` — replace comment on line 1 with `'use no memo';`
- `src/hooks/useScrollDirection.ts` — replace comment on line 1 with `'use no memo';`

Keep extracted module-level constants (`listKeyExtractor`, `getListItemType`, `listContentContainerStyle`, `horizontalKeyExtractor`, `horizontalContentContainerStyle`) — these help regardless of Compiler.

### Step 2: Remove `useBookById` from BookGridItem render path

**Rationale**: Biggest single optimization. Eliminates full Book+chapters subscription from every visible grid item.

**File**: `src/components/BookGridItem.tsx`

Changes:
1. Remove `const fullBook = useBookById(bookId)` from BookGridItem body
2. Remove `fullBook` from the early-return null check
3. Pass `bookId` to BookPlayButton instead of `fullBook`
4. In BookPlayButton: read book imperatively inside `handlePressPlay` via `useLibraryStore.getState().books[bookId]`
5. Remove BookPlayButton's `fullBook` prop entirely

### Step 3: Refactor BookDurationRow to accept `bookId`

**Rationale**: BookDurationRow currently receives the full `book` object, which forces the parent to hold a `useBookById` subscription. It already reads playback state imperatively — make book data imperative too.

**File**: `src/components/BookDurationRow.tsx`

Changes:
1. Change prop from `book: Book` to `bookId: string`
2. Read book data inside via `useLibraryStore.getState().books[bookId]`
3. Early return if book not found

**File**: `src/components/BookGridItem.tsx` — update BookDurationRow callsite to pass `bookId={bookId}` instead of `book={fullBook}`

### Step 4: Consolidate BookPlayButton subscriptions

**Rationale**: BookPlayButton has 4 store hooks including a duplicate `useIsBookActive` and redundant `useQueueStore(activeBookId)`.

**File**: `src/components/BookGridItem.tsx`

Changes:
1. Remove `useQueueStore((state) => state.activeBookId)` — read imperatively in press handler
2. Remove `useQueueStore((state) => state.setActiveBookId)` — read imperatively in press handler
3. The `isActiveBook` from `useIsBookActive` is needed for rendering (determines icon display) — keep it
4. Keep `useIsBookActiveAndPlaying` — needed for rendering

Target: BookPlayButton goes from 4 store hooks → 2 (`useIsBookActiveAndPlaying`, `useIsBookActive`)

### Step 5: Remove `useIsBookActive` from BookGridItem (already in BookPlayButton)

**Rationale**: BookGridItem calls `useIsBookActive(bookId)` on line 159 to color the title. BookPlayButton already calls it. Lift the value from BookPlayButton or pass as prop.

**File**: `src/components/BookGridItem.tsx`

Changes:
1. Remove `useIsBookActive(bookId)` from BookGridItem body (line 159)
2. Instead, use `usePlayerStateStore` with a selector that returns `activeBookId` and compare inline — or keep one call and pass down

Actually simpler: keep one `useIsBookActive(bookId)` in BookGridItem (it's cheap — boolean comparison) and pass the result to BookPlayButton as a prop instead of BookPlayButton calling it again.

### Step 6: External baseline — no action needed for now

**PulsingText**: Already correctly guarded — only renders when `isScanning === true` (Header.tsx:163). Unmounts when scanning stops.

**SearchBar/FloatingPlayer**: Their `useAnimatedStyle` worklets run on the UI thread, not JS thread. The ~50% JS baseline from the minimal test may be FlashList V2's own internal overhead (layout manager, recycling engine) rather than these components. Further investigation deferred — the subscription optimizations in Steps 2-5 are the priority.

### Step 7: Clean up diagnostic infrastructure

**Files**: `src/components/BooksHome.tsx`, `src/components/BookGridItem.tsx`

Changes:
1. Remove `ACTIVE_DIAGNOSTIC` import and conditional branches from BooksHome
2. Remove `MinimalBaselineTest` component
3. Remove `ScrollView` import (only needed for diagnostic)
4. Remove `ACTIVE_DIAGNOSTIC` import and conditional from BookGridItem
5. Delete `src/helpers/diagnosticConfig.ts` and `src/helpers/hermesProfiler.ts`
6. Remove Header long-press profiler trigger: revert `Pressable` back to `View` for titleWrapper, remove `handleProfileLongPress` callback, remove `profileForDuration`/`inspectHermesInternal` imports, remove `Alert` and `useCallback` imports if no longer needed

---

## Critical Files

| File | Changes |
|------|---------|
| `src/components/BookGridItem.tsx` | Remove `useBookById`, consolidate hooks, pass `bookId` to children |
| `src/components/BookDurationRow.tsx` | Accept `bookId` instead of `book`, imperative store read |
| `src/components/BooksHome.tsx` | Restore `'use no memo'`, remove diagnostic branches |
| `src/hooks/useScrollDirection.ts` | Restore `'use no memo'` |
| `src/helpers/handleBookPlay.ts` | No changes — still receives full book from press handler |

## Verification

1. **Functional**: BooksHome scrolls, play/pause works, duration row shows progress, expand/collapse works
2. **Flashlight**: 10-second scroll, full library, release build, Pixel 7 Pro
3. **Targets**: FPS >40 avg, JS Thread <55%, Total CPU <140%
4. **Compare against**: `none` baseline (33.3 FPS) and `no-subscriptions` ceiling (41.3 FPS)
5. **React DevTools**: Commit durations <50ms (down from 50-203ms)
