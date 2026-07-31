# Diagnostic Plan: BooksHome Scroll Performance

## Context

The BooksHome screen (the main library view) suffers from sustained jank at **36 FPS** (should be 60-120) during vertical scrolling through collapsed author sections. This occurs on a Pixel 7 Pro (flagship device) with a release build, indicating an architectural rather than hardware issue.

### Evidence Summary

| Test | FPS | Total CPU | JS Thread | Verdict |
|------|-----|-----------|-----------|---------|
| Full library, normal items | 36.1 | 164% | 67.8% | Baseline |
| Full library, stripped items + static views | ~36-38 | ~similar | ~similar | **Item complexity is NOT the cause** |
| 10 sections, normal items | 45.5 | 124% | 50.6% | **Section count scales the problem** |
| drawDistance 200-350px | ~37-38 | ~similar | ~similar | drawDistance barely helps |
| Expand/collapse sections | >60 | - | - | No jank (grid view is fine) |

### System Trace Analysis (Perfetto, 10.4s capture)

- **~92 frames dropped** (1,156 rendered vs ~1,248 expected at 120Hz)
- **Worst single gap**: 50.2ms (6 consecutive dropped frames)
- **JS thread**: 6,320ms CPU time (60.7% of one core), max burst 84.8ms
- **UI thread bottleneck**: `IntBufferBatchMountItem::UPDATE_PROPS` batches of 100-285 instructions per frame (8-22ms each)
- **826 native views created** during scroll: 272 RCTText, 180 GestureHandlerButton, 276 SVG views (from lucide icons), 90 RCTImageView
- **RenderThread is NOT the bottleneck** (avg 2ms draw time, max 7.6ms)
- **Fresco image decode**: 296 decodes across 8 threads (background, not blocking UI)

### Root Cause Hypothesis

The **JS thread is the bottleneck** (50-68% CPU), but the cost is NOT in:
- Per-item rendering (stripping items barely helps)
- Nested FlashList layout (replacing with static views barely helps)
- Pre-rendering distance (drawDistance barely helps)

The cost SCALES with section count and correlates with new sections appearing. This points to **FlashList V2's internal JS-side layout/recycling engine** processing many variable-height sections, compounded by React reconciliation overhead.

**Critical unknown**: We don't know WHICH JS functions consume the 50-68% CPU. The system trace shows thread-level CPU but cannot see inside the Hermes engine. A **Hermes CPU profile** is required to move from hypothesis to confirmed root cause.

---

## Phase 1: Hermes CPU Profile (HIGHEST PRIORITY)

**Goal**: Identify exactly which JS functions consume the 50-68% CPU during scroll.

### Step 1A: Capture a Hermes Sampling Profile

Add profiling capability to capture a `.cpuprofile` during the scroll test:

```typescript
// In a temporary dev utility or triggered by a dev menu button
import { HermesCPUProfiler } from 'react-native/Libraries/Performance/HermesCPUProfiler';

// Start before scrolling
HermesCPUProfiler.startProfiling();

// Stop after 10 seconds of scrolling
const profilePath = await HermesCPUProfiler.stopProfiling();
console.log('Profile saved to:', profilePath);
```

Alternatively, use the **Chrome DevTools** approach:
1. Run `npx react-devtools` or connect via Chrome at `chrome://inspect`
2. Navigate to the BooksHome screen
3. Start the Performance/CPU profiler
4. Scroll for 10 seconds
5. Stop and analyze the flame graph

**File to modify**: Create a temporary dev utility or use an existing dev menu
**What to look for**:
- Functions taking >5% of total CPU time
- Hot paths in FlashList internals vs. application code vs. React reconciliation
- Whether `renderItem` calls dominate, or if it's FlashList's layout engine

### Step 1B: React DevTools Component Profiler

Separately, use the React DevTools Profiler to understand component-level rendering:

1. Connect React DevTools to the running app
2. Start the Profiler recording
3. Scroll through BooksHome for 10 seconds
4. Stop and examine:
   - Which components re-render on each frame?
   - How many `AuthorSection` / `RecentlyAddedSection` renders occur?
   - Are any components re-rendering that shouldn't be?
   - What is the "commit" duration per frame?

---

## Phase 2: Targeted Isolation Tests

Run these tests WITH Flashlight to get comparable FPS/CPU numbers. Each test changes ONE variable from the baseline.

### Test A: Replace Outer FlashList with ScrollView

**Purpose**: Determine if FlashList's internal layout engine is the bottleneck.

In `BooksHome.tsx`, temporarily replace the outer `<FlashList>` with a `<ScrollView>` that renders all sections directly:

```tsx
<ScrollView onScroll={onScroll} scrollEventThrottle={16}>
  {listData.map((item, index) => renderItem({ item, index }))}
</ScrollView>
```

- **If FPS improves significantly**: FlashList's JS-side layout computation is the bottleneck
- **If FPS stays similar**: The bottleneck is in React reconciliation or downstream

### Test B: Absolute Minimum Baseline

**Purpose**: Establish the maximum achievable FPS with this architecture.

Replace BooksHome entirely with a FlashList of 50+ empty colored Views (no hooks, no components, no store subscriptions):

```tsx
const data = Array.from({ length: 60 }, (_, i) => i);
<FlashList
  data={data}
  renderItem={({ item }) => (
    <View style={{ height: 240, backgroundColor: item % 2 ? '#333' : '#444' }} />
  )}
  onScroll={onScroll}
  scrollEventThrottle={16}
/>
```

- **If FPS is 60+**: The FlashList infrastructure itself is fine; the problem is in what we render
- **If FPS is still <60**: Something external to BooksHome is the bottleneck (FloatingPlayer? SearchBar animation? SafeAreaView?)

### Test C: Remove All Store Subscriptions from BookGridItem

**Purpose**: Determine if per-item Zustand subscriptions are the cost.

In `BookGridItem.tsx`, comment out all hooks and render a static View with hardcoded content:

```tsx
export const BookGridItem = memo(function BookGridItem({ bookId }: BookGridItemProps) {
  // No hooks at all - no useBookById, useBookDisplayData, useIsBookActive, etc.
  return <View style={{ height: 200, width: 120, backgroundColor: '#555' }} />;
});
```

**Keep BooksHorizontal using FlashList** for this test.

- **If FPS improves significantly**: Store subscriptions or hook execution is the bottleneck
- **If FPS stays similar**: FlashList's management of nested lists is the cost

### Test D: Verify React Compiler Impact

**Purpose**: Check if removing `'use no memo'` from BooksHome improves performance.

Currently ALL files in the scroll path opt out of React Compiler:
- `src/app/(drawer)/(library)/index.tsx` — `'use no memo'`
- `src/components/BooksHome.tsx` — `'use no memo'`
- `src/components/BooksGrid.tsx` — `'use no memo'`
- `src/hooks/useScrollDirection.ts` — `'use no memo'`

The stated reason is "Receives Reanimated scroll handler," but the `onScroll` handler is a plain `useCallback` (NOT a worklet). The SharedValue is updated imperatively, which should be Compiler-safe.

**Test**: Remove `'use no memo'` from `BooksHome.tsx` only and verify:
1. The app still works correctly (Reanimated doesn't break)
2. Whether FPS changes

**Inline props that the Compiler would auto-memoize** (currently re-created every render):
- `keyExtractor={(item) => ...}` in BooksHome FlashList
- `getItemType={(item) => item.type}` in BooksHome FlashList
- `contentContainerStyle={{ paddingBottom: 58 }}` in BooksHome FlashList
- Various inline styles in BookDurationRow

---

## Phase 3: Optimizations (Apply Based on Phase 1-2 Findings)

### 3A: If FlashList Layout Is the Bottleneck

- **Use `overrideItemLayout`** on the outer FlashList to provide fixed section heights, avoiding measurement:
  ```tsx
  overrideItemLayout={(layout, item) => {
    layout.size = 244; // SectionHeader (24) + gap (12) + BooksHorizontal (220) - adjust to actual
  }}
  ```
- **Investigate FlashList V2's `useRecyclingState`** for the horizontal list items — designed specifically for nested list recycling
- **Reduce `scrollEventThrottle`** from 16 to 32 (30 events/sec instead of 60) to halve JS scroll processing

### 3B: If React Reconciliation Is the Bottleneck

- **Remove `'use no memo'` where safe** (BooksHome, BooksGrid) and let React Compiler optimize
- **Extract inline arrow functions** from FlashList props (`keyExtractor`, `getItemType`) to module-level constants
- **Memoize all inline style objects** (contentContainerStyle, etc.)

### 3C: If Store Subscriptions Are the Bottleneck

- **Consolidate per-item subscriptions**: BookGridItem currently has 4-6 store subscriptions (`useBookById`, `useBookDisplayData`, `useIsBookActive`, `useIsBookActiveAndPlaying`, `useQueueStore` x2). Combine into a single selector
- **Defer non-essential data**: Don't fetch `fullBook` (with all chapters) for grid items. BookDurationRow could use a lightweight progress selector instead

### 3D: Quick Wins (Apply Regardless)

- **Replace lucide SVG icons with font icons**: Each `<Play>` creates 3 native views (SVGSvgViewAndroid + SVGGroup + SVGPath). Use `@expo/vector-icons` Ionicons (1 native Text view per icon). Same for `<ChevronRight>` in SectionHeader. This eliminates ~276 SVG views during scroll.

  **Files**: `src/components/BookGridItem.tsx` (Play icon), `src/components/BooksHome.tsx` (ChevronRight icon)

- **Memoize BookDurationRow**: Currently explicitly NOT wrapped in `React.memo`. Wrap it to prevent re-renders when parent re-renders with identical props.

  **File**: `src/components/BookDurationRow.tsx`

---

## Critical Files

| File | Role | Key Issue |
|------|------|-----------|
| `src/app/(drawer)/(library)/index.tsx` | LibraryScreen parent | `'use no memo'`, data pipeline |
| `src/components/BooksHome.tsx` | Outer vertical FlashList | `'use no memo'`, inline FlashList props |
| `src/components/BooksHorizontal.tsx` | Nested horizontal FlashList | Per-section FlashList creation |
| `src/components/BookGridItem.tsx` | Per-item rendering | 4-6 store subscriptions, SVG icon |
| `src/components/BookDurationRow.tsx` | Progress display | Not memoized, calls computeBookProgress |
| `src/store/library.tsx` | Zustand store | Data source for all selectors |
| `src/hooks/useScrollDirection.ts` | Scroll handler | `'use no memo'` |

---

## Verification

After each test/optimization:
1. **Flashlight test**: 10-second scroll on BooksHome with full library, release build, Pixel 7 Pro
2. **Target metrics**: FPS >55 avg, JS Thread CPU <40%, Total CPU <120%
3. **Compare against baseline**: FPS 36.1, JS 67.8%, CPU 164.2%
4. **System trace** (optional): Capture another Perfetto trace to compare UPDATE_PROPS batch sizes

---

## Execution Order

1. **Phase 1A/1B** (Hermes + React DevTools profiling) — highest diagnostic value, do FIRST
2. **Phase 2B** (absolute minimum baseline) — quick sanity check
3. **Phase 2A** (ScrollView replacement) — tests FlashList hypothesis
4. **Phase 2C** (no store subscriptions) — tests hook overhead hypothesis
5. **Phase 2D** (React Compiler test) — quick toggle test
6. **Phase 3D** (quick wins) — apply regardless of findings
7. **Phase 3A/3B/3C** — apply based on what Phase 1-2 reveal
