# Flatten BooksHome FlashList Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the nested FlashList architecture in BooksHome by flattening all items (section headers, horizontal rows, and individual book grid items) into a single FlashList, enabling proper virtualization of 100+ book grids.

**Architecture:** Replace the current pattern of BooksHome FlashList -> AuthorSection -> nested BooksGrid FlashList with a single FlashList containing 3 item types: `sectionHeader`, `horizontalRow` (collapsed), and `book` (expanded). Use FlashList v2's `overrideItemLayout` with `span = maxColumns` for full-width items (headers, horizontal rows) and `span = 1` for book grid items.

**Tech Stack:** FlashList v2.2.1, React Native 0.79.6, New Architecture, FastImage, Zustand

---

## Current Architecture (the problem)

```
BooksHome FlashList (outer)
  -> AuthorSection (one item per author)
    -> SectionHeader
    -> BooksGrid FlashList (inner, masonry) when EXPANDED  <-- nested vertical FlashList!
    -> BooksHorizontal FlashList (horizontal) when COLLAPSED  <-- fine, different axis
```

When expanding a 100-book author, the inner BooksGrid FlashList can't virtualize because it's nested inside the outer FlashList. All 100 BookGridItems mount simultaneously, causing RenderThread ~91% and JS Thread ~55%.

## Target Architecture (the fix)

```
BooksHome FlashList (single, flat)
  -> [sectionHeader: "Recently Added"]     span=maxColumns (full width)
  -> [horizontalRow: recently added books] span=maxColumns (full width, 220px)
  -> [sectionHeader: "Author A"]           span=maxColumns (full width)
  -> [book: bookId1] [book: bookId2]       span=1 (grid items, virtualized!)
  -> [book: bookId3] [book: bookId4]       span=1
  -> ...only visible items mounted...
  -> [sectionHeader: "Author B"]           span=maxColumns (full width)
  -> [horizontalRow: Author B books]       span=maxColumns (full width, 220px)
```

## Critical Files

| File | Action |
|---|---|
| `src/components/BooksHome.tsx` | Major rewrite — new data structure, single FlashList, new renderItem |
| `src/components/BooksGrid.tsx` | NO changes — still used standalone in library toggle view 2 |
| `src/components/BooksHorizontal.tsx` | NO changes — still used for collapsed horizontal rows |
| `src/components/BookGridItem.tsx` | NO changes — rendered directly by the flat list for 'book' items |
| `src/store/settingsStore.ts` | Read-only — provides `numColumns` |
| `src/app/(drawer)/(library)/index.tsx` | NO changes — `activeGridSection` state stays in parent |

## Key Design Decisions

### 1. Data type for the flat list

```typescript
type FlatListItem =
  | { type: 'sectionHeader'; sectionId: string; title: string }
  | { type: 'horizontalRow'; sectionId: string; books?: Book[]; authors?: Author[]; preserveOrder?: boolean }
  | { type: 'book'; bookId: string };
```

### 2. Masonry + mixed spans

FlashList v2 supports `overrideItemLayout` with `span` in masonry mode. Section headers and horizontal rows get `span = maxColumns` (full width). Book items get `span = 1` (default column width). This preserves the masonry layout for book items while allowing full-width section breaks.

### 3. Scroll restoration after expansion

Current approach stores an index + Y offset, then calls `scrollToIndex` after the state change. The problem: in the flat list, expanding a section inserts N book items, shifting all subsequent indices.

Solution: After rebuilding `flatData`, find the target header by `sectionId` and use its new index. The `sectionId` is stable across data rebuilds.

### 4. `getItemType` for recycling

Return `item.type` so FlashList maintains 3 separate recycle pools. This prevents a SectionHeader view from being recycled into a BookGridItem slot (which would cause layout thrashing).

### 5. What about collapsed sections that used BooksHorizontal?

`BooksHorizontal` is still rendered as a full-width item (`span = maxColumns`) inside the flat list. A horizontal FlashList nested inside a vertical FlashList is fine — the scroll axes don't conflict and it has a fixed 220px height. This is NOT the performance problem (the problem was vertical-in-vertical nesting from BooksGrid).

---

## Tasks

### Task 1: Define the new data types and build the flat data array

**Files:**
- Modify: `src/components/BooksHome.tsx`

**Step 1: Add the new FlatListItem type**

Replace the existing `ListDataItem` type (lines 29-31) with:

```typescript
type FlatListItem =
  | { type: 'sectionHeader'; sectionId: string; title: string }
  | { type: 'horizontalRow'; sectionId: string; books?: Book[]; authors?: Author[]; preserveOrder?: boolean }
  | { type: 'book'; bookId: string };
```

**Step 2: Rewrite the `listData` useMemo**

Replace the existing `listData` memo (lines 76-84) with a new memo that depends on `activeGridSection`, `recentlyAddedBooks`, and `sortedAuthors`. The logic:

```typescript
const flatData: FlatListItem[] = useMemo(() => {
  if (recentlyAddedBooks.length === 0 && sortedAuthors.length === 0) return [];
  const items: FlatListItem[] = [];

  // Recently Added section
  if (recentlyAddedBooks.length > 0) {
    items.push({ type: 'sectionHeader', sectionId: 'recentlyAdded', title: 'Recently Added' });
    if (activeGridSection === 'recentlyAdded') {
      // Expanded: add individual book items (preserve chronological order)
      for (const book of recentlyAddedBooks) {
        if (book.bookId) items.push({ type: 'book', bookId: book.bookId });
      }
    } else {
      // Collapsed: add horizontal row
      items.push({ type: 'horizontalRow', sectionId: 'recentlyAdded', books: recentlyAddedBooks, preserveOrder: true });
    }
  }

  // Author sections
  for (const author of sortedAuthors) {
    items.push({ type: 'sectionHeader', sectionId: author.name, title: author.name });
    if (activeGridSection === author.name) {
      // Expanded: add individual book items sorted by title
      const sortedBooks = [...author.books].sort((a, b) =>
        compareBookTitles(a.bookTitle, b.bookTitle)
      );
      for (const book of sortedBooks) {
        if (book.bookId) items.push({ type: 'book', bookId: book.bookId });
      }
    } else {
      // Collapsed: add horizontal row
      items.push({ type: 'horizontalRow', sectionId: author.name, authors: [author] });
    }
  }

  return items;
}, [activeGridSection, recentlyAddedBooks, sortedAuthors]);
```

**Step 3: Verify** — Add a `console.log(flatData.length, flatData.slice(0, 5))` temporarily. Reload Metro. Navigate to library. Check the output makes sense (headers + horizontal rows when collapsed, headers + books when expanded).

**Step 4: Commit**
```bash
git add src/components/BooksHome.tsx
git commit -m "refactor: define flat data structure for BooksHome"
```

---

### Task 2: Rewrite renderItem for 3 item types

**Files:**
- Modify: `src/components/BooksHome.tsx`

**Step 1: Import required dependencies**

Add imports for `compareBookTitles`, `BookGridItem`, `useSettingsStore`, and `Dimensions` at the top of the file:

```typescript
import { BookGridItem } from './BookGridItem';
import { useSettingsStore } from '@/store/settingsStore';
import { compareBookTitles } from '@/helpers/miscellaneous';
```

Note: `BooksGrid` import can be removed (no longer used in this file). `BooksHorizontal` import stays.

**Step 2: Add numColumns and itemWidth calculations**

Inside the BooksHome component, add (similar to what BooksGrid currently does):

```typescript
const numColumns = useSettingsStore((state) => state.numColumns);
const { width: screenWidth } = Dimensions.get('window');
const ITEM_MARGIN_HORIZONTAL = 10;
const itemWidth = useMemo(
  () => (screenWidth - ITEM_MARGIN_HORIZONTAL * (numColumns + 1)) / numColumns,
  [screenWidth, numColumns],
);
```

**Step 3: Rewrite renderItem**

Replace the existing `renderItem` callback with one that handles 3 types:

```typescript
const renderItem = useCallback(
  ({ item, index }: { item: FlatListItem; index: number }) => {
    switch (item.type) {
      case 'sectionHeader':
        return (
          <SectionHeader
            title={item.title}
            sectionId={item.sectionId}
            isActive={activeGridSection === item.sectionId}
            index={index}
            onSectionPress={handleSectionPress}
          />
        );
      case 'horizontalRow':
        return (
          <BooksHorizontal
            books={item.books}
            authors={item.authors}
            flowDirection='row'
            preserveOrder={item.preserveOrder}
          />
        );
      case 'book':
        return (
          <BookGridItem
            bookId={item.bookId}
            flowDirection='column'
            numColumns={numColumns}
            itemWidth={itemWidth}
          />
        );
      default:
        return null;
    }
  },
  [activeGridSection, handleSectionPress, numColumns, itemWidth],
);
```

**Step 4: Remove RecentlyAddedSection and AuthorSection components**

Delete the `RecentlyAddedSection` component (lines 191-208), its type (lines 184-189), the `AuthorSection` component (lines 217-239), and its type (lines 210-215). Their logic is now absorbed into the flat data + renderItem.

**Step 5: Verify** — Reload Metro. The list should render but layout will be wrong (no column/span configuration yet). Section headers and horizontal rows should appear. Book items will be single-column. This is expected.

**Step 6: Commit**
```bash
git add src/components/BooksHome.tsx
git commit -m "refactor: rewrite renderItem for flat 3-type list"
```

---

### Task 3: Configure FlashList for masonry + mixed spans

**Files:**
- Modify: `src/components/BooksHome.tsx`

**Step 1: Add keyExtractor**

```typescript
const keyExtractor = useCallback((item: FlatListItem) => {
  switch (item.type) {
    case 'sectionHeader': return `header-${item.sectionId}`;
    case 'horizontalRow': return `row-${item.sectionId}`;
    case 'book': return item.bookId;
  }
}, []);
```

**Step 2: Add overrideItemLayout**

```typescript
const overrideItemLayout = useCallback(
  (layout: { span?: number }, item: FlatListItem, _index: number, maxColumns: number) => {
    if (item.type !== 'book') {
      layout.span = maxColumns;
    }
  },
  [],
);
```

**Step 3: Add getItemType**

```typescript
const getItemType = useCallback((item: FlatListItem) => item.type, []);
```

**Step 4: Update the FlashList JSX**

Replace the FlashList element with:

```tsx
<FlashList
  ref={listRef}
  data={flatData}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  getItemType={getItemType}
  overrideItemLayout={overrideItemLayout}
  masonry
  optimizeItemArrangement
  numColumns={numColumns}
  drawDistance={150}
  overrideProps={{ initialDrawBatchSize: 8 }}
  onScroll={onScroll}
  scrollEventThrottle={16}
  ListHeaderComponent={ListHeaderComponent}
  ListEmptyComponent={/* keep existing */}
  contentContainerStyle={{ paddingBottom: 58 }}
  showsVerticalScrollIndicator={false}
/>
```

**Step 5: Update the FlashList ref type**

Change `useRef<React.ComponentRef<typeof FlashList<ListDataItem>>>` to `useRef<React.ComponentRef<typeof FlashList<FlatListItem>>>`.

**Step 6: Verify** — Reload Metro. The grid should now display correctly:
- Section headers: full width
- Horizontal rows (collapsed): full width, 220px height, scrollable
- Book items (expanded): in numColumns masonry grid
- Test expanding/collapsing a section

**Step 7: Commit**
```bash
git add src/components/BooksHome.tsx
git commit -m "feat: configure FlashList masonry with mixed spans"
```

---

### Task 4: Fix scroll restoration for flat data

**Files:**
- Modify: `src/components/BooksHome.tsx`

**Step 1: Update PendingScroll type**

Change from index-based to sectionId-based:

```typescript
type PendingScroll = {
  sectionId: string;
  relativeY: number;
} | null;
```

**Step 2: Rewrite handleSectionPress**

The key change: store `sectionId` instead of `index`, and after state update, find the header's new index in `flatData`:

```typescript
const handleSectionPress = useCallback(
  (sectionId: string, _index: number, pageY: number) => {
    listContainerRef.current?.measureInWindow((_x, listTopY) => {
      const relativeY = pageY - listTopY;
      pendingScrollRef.current = { sectionId, relativeY };

      setActiveGridSection((prev) => {
        const newValue = prev === sectionId ? null : sectionId;

        requestAnimationFrame(() => {
          if (pendingScrollRef.current && listRef.current) {
            // Find the header's index in the current flat data
            // Note: flatData hasn't been recalculated yet at this point,
            // so we need to search the NEW data which will be available after render.
            // Use a short timeout to allow the useMemo to recalculate.
            setTimeout(() => {
              if (!pendingScrollRef.current || !listRef.current) return;
              const targetId = pendingScrollRef.current.sectionId;
              const newFlatData = listRef.current.props.data;
              if (!newFlatData) return;
              const headerIndex = newFlatData.findIndex(
                (item) => item.type === 'sectionHeader' && item.sectionId === targetId,
              );
              if (headerIndex >= 0) {
                listRef.current.scrollToIndex({
                  index: headerIndex,
                  animated: false,
                  viewOffset:
                    -pendingScrollRef.current.relativeY + CONTAINER_PADDING_TOP,
                });
              }
              pendingScrollRef.current = null;
            }, 50);
          }
        });

        return newValue;
      });
    });
  },
  [setActiveGridSection],
);
```

Note: The `setTimeout(50)` allows the React re-render (with new flatData) to complete before we read the new data from the FlashList ref. This matches the commented-out pattern already in the existing code (line 98-109 of current BooksHome.tsx).

**Step 2: Verify** — Reload Metro. Test:
1. Scroll down to an author section
2. Tap to expand — the section header should stay at the same visual position
3. Tap to collapse — same behavior
4. Test with "Recently Added" section
5. Test expanding one section while another is already expanded

**Step 3: Commit**
```bash
git add src/components/BooksHome.tsx
git commit -m "fix: update scroll restoration for flat data indices"
```

---

### Task 5: Add containerGap styling for section headers

**Files:**
- Modify: `src/components/BooksHome.tsx`

**Step 1: Add spacing**

The old `AuthorSection` and `RecentlyAddedSection` wrappers applied `styles.containerGap` (12px gap). Since we removed those wrappers, we need to add equivalent spacing. The cleanest approach is to add `marginTop` to the sectionHeader render case and `marginBottom` to horizontalRow:

Update the `sectionHeader` case in renderItem to wrap in the gap container:

```typescript
case 'sectionHeader':
  return (
    <View style={styles.sectionHeaderContainer}>
      <SectionHeader
        title={item.title}
        sectionId={item.sectionId}
        isActive={activeGridSection === item.sectionId}
        index={index}
        onSectionPress={handleSectionPress}
      />
    </View>
  );
```

Add to StyleSheet:
```typescript
sectionHeaderContainer: {
  paddingTop: 4,
},
```

And for horizontal rows, add a small bottom gap for visual separation from the next section:
```typescript
case 'horizontalRow':
  return (
    <View style={styles.horizontalRowContainer}>
      <BooksHorizontal
        books={item.books}
        authors={item.authors}
        flowDirection='row'
        preserveOrder={item.preserveOrder}
      />
    </View>
  );
```

```typescript
horizontalRowContainer: {
  paddingBottom: 4,
},
```

**Step 2: Verify** — Visual inspection. Spacing between sections should look identical to the original.

**Step 3: Commit**
```bash
git add src/components/BooksHome.tsx
git commit -m "style: restore section spacing in flat layout"
```

---

### Task 6: Clean up unused imports and styles

**Files:**
- Modify: `src/components/BooksHome.tsx`

**Step 1:** Remove the `BooksGrid` import (line 8) since it's no longer used in this file.

**Step 2:** Remove the `containerGap` style from the StyleSheet if no longer referenced.

**Step 3:** Remove any temporary `console.log` from Task 1.

**Step 4: Verify** — Reload Metro, confirm no import warnings. Test the full flow:
1. Library loads with all sections collapsed (horizontal rows)
2. Tap a section header to expand — books appear in masonry grid
3. Scroll through the expanded grid — smooth, items virtualize properly
4. Tap the header again to collapse — returns to horizontal row
5. Switch to toggle view 2 (standalone BooksGrid) — still works
6. Change numColumns in settings — grid updates correctly

**Step 5: Commit**
```bash
git add src/components/BooksHome.tsx
git commit -m "chore: clean up unused imports after BooksHome flatten"
```

---

### Task 7: Performance verification

**No code changes.** Run Flashlight CLI tests.

**Step 1:** Test the same 100-book author that previously showed RenderThread ~91%, JS Thread ~55%.

**Step 2:** Compare before/after:

| Metric | Before (nested) | Expected After (flat) |
|---|---|---|
| RenderThread | ~91% | Significantly lower (items virtualized) |
| JS Thread | ~55% | Significantly lower (fewer simultaneous mounts) |
| Items mounted | ~100 (all at once) | ~8-12 (visible + draw distance) |

**Step 3:** If masonry mode causes issues with mixed spans (sectionHeader + book items), the fallback is to remove the `masonry` prop and use standard `numColumns` grid. This loses masonry packing but maintains virtualization.

---

## Verification Checklist

- [ ] Library screen loads — all sections show horizontal rows (collapsed)
- [ ] Tapping a section expands it — books show in masonry grid
- [ ] Tapping again collapses — returns to horizontal row
- [ ] Scroll position preserved on expand/collapse
- [ ] 100-book author section: books virtualize (only ~12 mounted, not 100)
- [ ] Expanding one section while another is expanded — previous collapses, new one opens
- [ ] "Recently Added" section expand/collapse works
- [ ] Toggle view 2 (standalone BooksGrid) still works
- [ ] Changing numColumns in settings updates the grid
- [ ] FloatingPlayer still visible and functional
- [ ] No visual regression in spacing/styling
- [ ] Flashlight CPU metrics improved for large sections

## Risks

1. **Masonry + mixed spans:** FlashList v2's masonry mode with `overrideItemLayout` span has not been battle-tested in this codebase. If full-width items break the masonry layout, remove the `masonry` prop and use standard grid. This is a visual-only tradeoff (uniform row heights vs packed columns).

2. **Scroll restoration timing:** The `setTimeout(50)` in `handleSectionPress` is a timing heuristic. If scroll jumps are observed, increase to 100ms or use `onLoad` callback from FlashList to trigger the scroll.

3. **`optimizeItemArrangement` with mixed types:** This prop reorders items to balance columns. With full-width items breaking the flow, the reordering only applies within contiguous runs of `book` items. This should work correctly but needs visual verification.
