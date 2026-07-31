# List FPS Optimization Design

**Date**: 2026-02-16
**Branch**: `fix/list-optimization`
**Problem**: Vertical scrolling in `BooksHome.tsx` drops to 25-35 FPS due to nested FlashList overhead

---

## Problem Analysis

### Symptoms

- FPS drops from 60 to 25-35 during sustained vertical scrolling
- Horizontal scrolling within individual sections is smooth
- Jank is visible at normal scroll speeds

### Profiling Data (Flashlight)

| Thread         | Avg CPU | Role                                          |
| -------------- | ------- | --------------------------------------------- |
| **JS Thread**  | **73%** | React rendering, FlashList recycling, selectors |
| UI Thread      | 48%     | Native layout, view hierarchy                 |
| RenderThread   | 26%     | GPU drawing                                   |
| FrescoDecodeExe| 2%      | Image decoding                                |

**Conclusion**: JS thread is the bottleneck at 73% average CPU.

### Root Cause

The `BooksHome` component renders a vertical FlashList containing ~20-60 author sections. Each collapsed section mounts a nested horizontal `FlashList` instance. This means:

1. ~20-60 nested FlashList instances mounted simultaneously, each with its own recycler, scroll handler, and layout machinery
2. Each `BookGridItem` runs 3 Zustand store subscriptions (`useBookDisplayData`, `useBookById`, `useIsBookActive`), creating ~60-180 active subscriptions in a typical viewport
3. All recycling and subscription evaluation runs on the single JS thread
4. The JS thread cannot produce frames within the 16.6ms budget

### User Context

- **Library size**: 20-60 authors, 100-500 books
- **Books per author**: Highly variable (1-50+)
- **Artwork**: File URIs, 800x800 WebP (resized during scan via `@bam.tech/react-native-image-resizer`)
- **Target devices**: Mid-range Android
- **Key UX feature**: Tap section header to expand from horizontal row to vertical grid (must be preserved in approaches A-C)

---

## Approach A: Architectural Optimization

**Philosophy**: Preserve all visual elements. Reduce JS thread work through targeted optimizations within the existing nested-FlashList architecture.

### A1. Replace FadeInImage with expo-image

**Current**: `FadeInImage` wraps `Animated.Image` with a JS-driven opacity animation (300ms). Each mount creates an `Animated.Value` on the JS thread.

**Change**: Switch to `expo-image` with native transitions:

```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: artwork ?? unknownBookImageUri }}
  style={styles.bookArtworkImage}
  contentFit="contain"
  transition={300}
  recyclingKey={bookId}
  cachePolicy="memory-disk"
/>
```

- `transition` runs on native thread (zero JS cost)
- `recyclingKey` prevents wrong-image flashes during FlashList cell recycling
- `cachePolicy="memory-disk"` for optimal cache behavior
- Remove `FadeInImage` component (or leave for use elsewhere)

### A2. Consolidate Zustand selectors in BookGridItem

**Current** (3 subscriptions per item):
```tsx
const bookData = useBookDisplayData(bookId);   // shallow comparison, 7 fields
const fullBook = useBookById(bookId);           // full Book object
const isActiveBook = useIsBookActive(bookId);   // boolean
const isActiveAndPlaying = useIsBookActiveAndPlaying(bookId); // boolean
```

**Change** (1 subscription per item):
```tsx
const data = useBookGridItemData(bookId);
// Returns: { author, bookTitle, artwork, artworkHeight, artworkWidth,
//            currentChapterProgress, fullBook, isActive, isPlaying }
```

Create a new consolidated selector hook in the library store that returns exactly what `BookGridItem` needs, using `useShallow` for the combined result. Reduces ~120 active subscriptions to ~40 for a typical viewport.

### A3. FlashList tuning

- Add `drawDistance={250}` to nested horizontal FlashLists (reduces off-screen item rendering)
- Add `overrideItemLayout` to the outer FlashList with predictable heights (220px collapsed, dynamic for expanded)

### A4. Inline style elimination

- Extract `BookDurationRow`'s inline `style={{ marginTop: 3, maxWidth: ... }}` to a static StyleSheet or memoized value
- Audit other inline object creation in the render path

### A5. React Compiler scope

- `BooksHome.tsx` has `'use no memo'` which disables the React Compiler for the entire file
- Move `RecentlyAddedSection`, `AuthorSection`, and `SectionHeader` to separate files so they can benefit from compiler optimizations
- The `'use no memo'` stays only on the parent `BooksHome` component (which receives the Reanimated scroll handler)

### Expected Impact

- **FPS gain**: 10-20%
- **Risk**: Low (incremental, non-breaking changes)
- **Preserves**: All visual elements, all UX patterns

---

## Approach B: Deferred Section Rendering

**Philosophy**: Only mount nested FlashList instances for sections near the viewport. Everything else renders as a lightweight placeholder. Layers on top of all Approach A optimizations.

### B1. Placeholder component

```tsx
const SectionPlaceholder = memo(({ title, height }: Props) => (
  <View style={{ height }}>
    <SectionHeader title={title} ... />
    {/* No FlashList mounted */}
  </View>
));
```

Preserves correct scroll height (220px for collapsed sections) so scroll position and scrollbar remain accurate.

### B2. Visibility tracking

Use FlashList's `onViewableItemsChanged` on the outer list to track visible section indices. Maintain a `Set<number>` of visible indices plus a buffer of +/-2 sections:

```
Viewport:  [ Section 5 ] [ Section 6 ] [ Section 7 ]
Buffer:    [ Section 3 ] [ Section 4 ] ... [ Section 8 ] [ Section 9 ]
Mounted:   Sections 3-9 get real BooksHorizontal FlashLists
Rest:      Sections 0-2, 10+ get SectionPlaceholder
```

### B3. Mount/unmount with React.startTransition

When a section enters the buffer zone, use `React.startTransition` to defer the FlashList mount as a low-priority update. This lets React yield back to the scroll handler between mounts, preventing "mount storms" during fast scrolling.

When a section leaves the buffer zone, swap it back to a placeholder.

### B4. Expected result

Instead of ~40 simultaneously mounted FlashLists, only ~7 (viewport + buffer) are active. JS thread work for nested list machinery drops by ~80%.

### Expected Impact

- **FPS gain**: 30-50%
- **Risk**: Medium (sections may briefly show as header-only when scrolling very fast)
- **Preserves**: All visual elements, horizontal scrolling, expand-to-grid

---

## Approach C: Flat List with Section Rendering

**Philosophy**: Eliminate nested virtualized lists entirely. One single FlashList renders all content using multiple item types. Includes all Approach A optimizations.

### C1. Flattened data model

```tsx
type FlatListItem =
  | { type: 'sectionHeader'; sectionId: string; title: string; bookCount: number }
  | { type: 'horizontalRow'; sectionId: string; books: Book[]; totalCount: number }
  | { type: 'gridBook'; sectionId: string; bookId: string };
```

**Collapsed section** emits 2 items:
```
[sectionHeader] → [horizontalRow]
```

**Expanded section** emits 1 + N items:
```
[sectionHeader] → [gridBook] → [gridBook] → ... → [gridBook]
```

### C2. HorizontalRow component (collapsed sections)

A lightweight `ScrollView` (not FlashList) rendering up to 8-10 books with an overflow card:

```tsx
const HorizontalRow = memo(({ books, totalCount, onExpand }: Props) => {
  const previewBooks = books.slice(0, 8);
  const remaining = totalCount - previewBooks.length;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {previewBooks.map((book) => (
        <BookGridItem key={book.bookId} bookId={book.bookId} flowDirection="row" />
      ))}
      {remaining > 0 && (
        <OverflowCard count={remaining} onPress={onExpand} />
      )}
    </ScrollView>
  );
});
```

- Plain ScrollView with 8-10 children has zero virtualization overhead
- Horizontally scrollable (user can swipe through the 8-10 books)
- Overflow card at the end: "Plus X more" — tapping expands the section to full grid

### C3. OverflowCard component

A pressable card matching book card dimensions:

```tsx
const OverflowCard = memo(({ count, onPress }: Props) => (
  <PressableScale onPress={onPress} style={overflowCardStyle}>
    <Text style={overflowText}>+{count}{'\n'}more</Text>
  </PressableScale>
));
```

### C4. Expanded grid layout (Option 1: manual column layout)

Expanded `gridBook` items use calculated widths based on the `numColumns` setting. The FlashList renders them as individual items, and each item is sized to `screenWidth / numColumns` so they naturally flow into rows.

Since FlashList doesn't support varying `numColumns` per section, each `gridBook` item sets its own width and the FlashList renders them in a single-column mode where the visual grid is achieved through item sizing:

- Each `gridBook` occupies `screenWidth / numColumns` width
- FlashList renders them sequentially
- Visual grid appearance achieved through item width + flex wrapping at the section level

Alternatively, use a wrapper approach: the expanded section emits a single `gridContainer` item that internally uses `flexDirection: 'row', flexWrap: 'wrap'` to lay out all books.

### C5. getItemType mapping

```tsx
getItemType={(item) => item.type}
```

FlashList creates 3 recycling pools:
- `sectionHeader` — lightweight text + chevron (reusable across all sections)
- `horizontalRow` — ScrollView with book covers (reusable across collapsed sections)
- `gridBook` — individual book card (reusable within expanded sections)

### C6. Section expand/collapse

Same `handleSectionPress` pattern as current implementation:
1. Recompute `flatListData` — swap that section's `horizontalRow` for N `gridBook` items
2. Use `measureInWindow` + `scrollToIndex` for scroll restoration
3. All other sections remain collapsed

### Expected Impact

- **FPS gain**: 50-70%
- **Risk**: Medium-high (significant refactor of data flow)
- **Preserves**: Horizontal scrolling (8-10 items + overflow card), expand-to-grid
- **Trade-off**: Collapsed sections show max 8-10 books instead of full virtualized list

---

## Approach D: Navigate-to-Author Detail (Last Resort)

**Philosophy**: Remove nested lists from home screen entirely. Each author is a compact card. Full browsing on a dedicated screen. Only build if A/B/C all miss the FPS target.

### D1. Home screen structure

Single flat FlashList with 2 item types:

```tsx
type HomeItem =
  | { type: 'recentlyAdded'; books: Book[] }
  | { type: 'authorCard'; author: Author };
```

### D2. AuthorCard component

Compact card with 2-3 fanned cover thumbnails + author name + book count. No nested list. Tapping navigates to a new native stack screen.

### D3. Author detail screen

Full `BooksGrid` for the selected author, pushed via native stack navigation. Single non-nested FlashList — guaranteed 60fps.

### D4. RecentlyAdded row

Keeps the horizontal `ScrollView` approach from Approach C (8-10 items + overflow card).

### Expected Impact

- **FPS gain**: 80-90%
- **Risk**: Low technical, high UX (removes inline browsing)
- **Trade-off**: Two taps to see full author collection instead of one

---

## Testing & Measurement Strategy

### Branch Structure

```
fix/list-optimization (current)
├── fix/list-opt-A  (Approach A: architectural optimizations)
├── fix/list-opt-B  (Approach B: A + deferred section rendering)
├── fix/list-opt-C  (Approach C: flat list, single FlashList)
└── fix/list-opt-D  (Approach D: navigate-to-author, only if needed)
```

Each branch forks from `fix/list-optimization`.

### Profiling Protocol

For each branch, run the same Flashlight test:

1. **Cold start** — launch app, navigate to library
2. **Wait 2 seconds** — let initial render settle
3. **Sustained vertical scroll** — top to bottom at moderate speed (~3 screens/second) for 10 seconds
4. **Record**: FPS (avg, p5, p50), JS thread CPU %, UI thread CPU %
5. **Repeat 3 times**, take the median

### Additional Profiling (Included in Plan)

Step-by-step instructions will be provided for:

- **React DevTools Profiler**: Record a scroll session, identify which components re-render most and which renders are slowest
- **Android Studio CPU Profiler**: Capture a systrace to see per-frame thread activity
- **Hermes Profiler**: JS heap snapshot to check for memory pressure from large objects

### Success Criteria

| Metric                    | Current | Target | Stretch |
| ------------------------- | ------- | ------ | ------- |
| Avg FPS during scroll     | 30-35   | 50+    | 58+     |
| JS Thread CPU %           | 73%     | <45%   | <30%    |
| UI Thread CPU %           | 48%     | <35%   | <25%    |
| Visual jank (subjective)  | Visible | Rare   | None    |

### Implementation Order

1. **Approach A** — smallest diff, establishes shared optimizations
2. **Approach B** — fork from A, add deferred rendering
3. **Approach C** — fork from `fix/list-optimization`, full rewrite with A's optimizations baked in
4. **Approach D** — only if A/B/C all miss the FPS target

---

## Key Files

| File | Role |
| ---- | ---- |
| `src/components/BooksHome.tsx` | Outer list with section rendering |
| `src/components/BooksHorizontal.tsx` | Nested horizontal FlashList |
| `src/components/BooksGrid.tsx` | Grid/masonry FlashList |
| `src/components/BookGridItem.tsx` | Individual book card renderer |
| `src/components/FadeInImage.tsx` | JS-driven fade-in (to be replaced) |
| `src/components/BookDurationRow.tsx` | Progress display |
| `src/store/library.tsx` | Zustand store with selectors |
| `src/store/playerState.ts` | Active book / playing state selectors |
