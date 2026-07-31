# List FPS Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 50+ FPS (target 58+) during sustained vertical scrolling of the BooksHome library screen by reducing JS thread CPU from 73% to under 45%.

**Architecture:** Four competing approaches are built on separate git branches forking from `fix/list-optimization`. Approach A is the shared foundation of incremental optimizations. Approach B layers deferred rendering on A. Approach C is a full rewrite to a single flat FlashList. Approach D is a last-resort UX redesign. Each branch is independently testable via Flashlight.

**Tech Stack:** React Native 0.79.6, Expo 53, React 19, Hermes, FlashList V2, Zustand 5, expo-image, react-native-reanimated 4.1.3

---

## Pre-Implementation: Profiling Baseline

Before writing any code, capture baseline measurements on the current `fix/list-optimization` branch.

### Task 0: Capture Baseline Flashlight Measurements

**Step 1: Run Flashlight baseline test**

Run the standard profiling protocol:
```bash
# Build a release APK (performance testing must be on release builds)
npx expo run:android --variant release

# Run Flashlight measurement
flashlight measure --bundleId <your.app.bundleId> --duration 15000
```

Test protocol:
1. Cold start the app, navigate to the library screen
2. Wait 2 seconds for initial render
3. Scroll vertically from top to bottom at moderate speed (~3 screens/sec) for 10 seconds
4. Record: FPS avg, JS Thread CPU %, UI Thread CPU %
5. Repeat 3 times, use median values

**Step 2: Save baseline results**

Create a file to track results across branches:
```
docs/plans/2026-02-16-list-fps-results.md
```

Record:
- Branch: `fix/list-optimization` (baseline)
- FPS: avg / p5 / p50
- JS Thread CPU: avg %
- UI Thread CPU: avg %
- Notes: any observations

**Step 3: Commit baseline results**

```bash
# Note: docs/ is gitignored, so this is for local reference only
```

---

## Approach A: Architectural Optimization

### Task A1: Create branch and replace FadeInImage with expo-image

**Files:**
- Modify: `src/components/BookGridItem.tsx` (lines 4, 196-200)
- Reference: `src/components/FadeInImage.tsx` (will no longer be imported here)

**Step 1: Create the branch**

```bash
git checkout fix/list-optimization
git checkout -b fix/list-opt-A
```

**Step 2: Update BookGridItem.tsx imports**

Replace:
```tsx
import { FadeInImage } from '@/components/FadeInImage';
```

With:
```tsx
import { Image } from 'expo-image';
```

**Step 3: Replace FadeInImage usage in BookGridItem render**

Replace (around line 196-200):
```tsx
<FadeInImage
  source={{ uri: artwork ?? unknownBookImageUri }}
  style={styles.bookArtworkImage}
  resizeMode='contain'
/>
```

With:
```tsx
<Image
  source={{ uri: artwork ?? unknownBookImageUri }}
  style={styles.bookArtworkImage}
  contentFit="contain"
  transition={300}
  recyclingKey={bookId}
  cachePolicy="memory-disk"
/>
```

**Step 4: Verify the app compiles and images render**

```bash
npx expo run:android
```

Navigate to library screen, verify book covers still display with a fade-in transition.

**Step 5: Commit**

```bash
git add src/components/BookGridItem.tsx
git commit -m "perf: replace FadeInImage with expo-image in BookGridItem"
```

---

### Task A2: Consolidate Zustand selectors in BookGridItem

**Files:**
- Modify: `src/store/library.tsx` (add new selector at bottom)
- Modify: `src/store/playerState.ts` (no changes needed, just reference)
- Modify: `src/components/BookGridItem.tsx` (replace 4 hooks with 1)

**Step 1: Add consolidated selector to library store**

Add at the bottom of `src/store/library.tsx`:

```tsx
/**
 * Consolidated selector for BookGridItem — returns all display data,
 * the full book object, and active/playing state in a single subscription.
 * Uses useShallow to prevent re-renders when unrelated book fields change.
 */
export const useBookGridItemData = (bookId: string) => {
  const playerState = usePlayerStateStore();
  return useLibraryStore(
    useShallow((state) => {
      const book = state.books[bookId];
      if (!book) return undefined;
      return {
        bookId: book.bookId,
        author: book.author,
        bookTitle: book.bookTitle,
        artwork: book.artwork,
        artworkHeight: book.artworkHeight,
        artworkWidth: book.artworkWidth,
        currentChapterProgress: book.bookProgress.currentChapterProgress,
        fullBook: book,
        isActive: playerState.activeBookId === bookId,
        isPlaying: playerState.activeBookId === bookId && playerState.isPlaying,
      };
    }),
  );
};
```

Wait — this approach creates a dependency on `playerState` outside the selector, which means the selector recalculates on every playerState change for every mounted BookGridItem. Instead, use a combined approach:

Add at the bottom of `src/store/library.tsx`:

```tsx
import { usePlayerStateStore } from '@/store/playerState';

/**
 * Consolidated selector for BookGridItem.
 * Combines library data + player state into a single hook call.
 * Each sub-selector only triggers re-renders when its specific values change.
 */
export const useBookGridItemData = (bookId: string) => {
  const bookData = useLibraryStore(
    useShallow((state) => {
      const book = state.books[bookId];
      if (!book) return undefined;
      return {
        bookId: book.bookId,
        author: book.author,
        bookTitle: book.bookTitle,
        artwork: book.artwork,
        artworkHeight: book.artworkHeight,
        artworkWidth: book.artworkWidth,
        currentChapterProgress: book.bookProgress.currentChapterProgress,
        fullBook: book,
      };
    }),
  );

  const isActive = usePlayerStateStore(
    (state) => state.activeBookId === bookId,
  );
  const isPlaying = usePlayerStateStore(
    (state) => state.activeBookId === bookId && state.isPlaying,
  );

  if (!bookData) return undefined;
  return { ...bookData, isActive, isPlaying };
};
```

Note: This is still 3 separate store subscriptions under the hood, but it's a single hook call from the component's perspective. The key optimization is that `useBookDisplayData` and `useBookById` are consolidated — the fullBook is now part of the shallow-compared selector, and we avoid the redundant `useBookById` call that returned the entire Book object without shallow comparison.

**Step 2: Update BookGridItem to use consolidated hook**

In `src/components/BookGridItem.tsx`, replace:

```tsx
import { useBookById, useBookDisplayData } from '@/store/library';
import {
  useIsBookActive,
  useIsBookActiveAndPlaying,
} from '@/store/playerState';
```

With:

```tsx
import { useBookGridItemData } from '@/store/library';
```

Replace the hook calls (around lines 42-57):

```tsx
const bookData = useBookDisplayData(bookId);
const fullBook = useBookById(bookId);

if (!bookId || !bookData || !fullBook) return null;

const { author, bookTitle, artwork, artworkHeight, artworkWidth } =
  bookData;

// ...
const { setActiveBookId, activeBookId } = useQueueStore();
const isActiveBook = useIsBookActive(bookId);
const isActiveAndPlaying = useIsBookActiveAndPlaying(bookId);
```

With:

```tsx
const data = useBookGridItemData(bookId);
const { setActiveBookId, activeBookId } = useQueueStore();

if (!bookId || !data) return null;

const {
  author,
  bookTitle,
  artwork,
  artworkHeight,
  artworkWidth,
  fullBook,
  isActive: isActiveBook,
  isPlaying: isActiveAndPlaying,
} = data;
```

**Step 3: Verify no regressions**

```bash
npx expo run:android
```

Navigate to library, verify:
- Book covers display correctly
- Play/pause icons appear on the correct (active) book
- Tapping a book navigates to details
- Tapping play starts playback

**Step 4: Commit**

```bash
git add src/store/library.tsx src/components/BookGridItem.tsx
git commit -m "perf: consolidate BookGridItem selectors into single hook"
```

---

### Task A3: FlashList tuning — drawDistance and overrideItemLayout

**Files:**
- Modify: `src/components/BooksHorizontal.tsx` (add drawDistance)
- Modify: `src/components/BooksHome.tsx` (add overrideItemLayout to outer list)

**Step 1: Add drawDistance to BooksHorizontal**

In `src/components/BooksHorizontal.tsx`, add `drawDistance={250}` to the FlashList:

```tsx
<FlashList
  contentContainerStyle={{
    paddingBottom: 6,
  }}
  scrollEventThrottle={16}
  drawDistance={250}
  data={bookIds}
  renderItem={renderBookItem}
  // ... rest unchanged
/>
```

**Step 2: Add overrideItemLayout to outer FlashList in BooksHome**

In `src/components/BooksHome.tsx`, add a memoized `overrideItemLayout` callback:

```tsx
const overrideItemLayout = useCallback(
  (layout: { size?: number }, item: ListDataItem) => {
    // Collapsed sections have a predictable height: header (~40px) + horizontal list (220px) + gap (12px)
    layout.size = 272;
  },
  [],
);
```

Add it to the FlashList props:

```tsx
<FlashList
  ref={listRef}
  data={listData}
  renderItem={renderItem}
  overrideItemLayout={overrideItemLayout}
  // ... rest unchanged
/>
```

Note: When a section is expanded to grid view, its height will differ. The overrideItemLayout should account for this:

```tsx
const overrideItemLayout = useCallback(
  (layout: { size?: number }, item: ListDataItem) => {
    if (item.type === 'author' && activeGridSection === item.author.name) {
      // Expanded: estimate based on book count and numColumns
      // Don't set size — let FlashList measure dynamically
      return;
    }
    if (item.type === 'recentlyAdded' && activeGridSection === 'recentlyAdded') {
      return;
    }
    // Collapsed sections: header + horizontal list + gap
    layout.size = 272;
  },
  [activeGridSection],
);
```

**Step 3: Verify scroll behavior**

```bash
npx expo run:android
```

Verify:
- Scrolling feels the same or smoother
- No visual glitches (blank areas, missing items)
- Expand/collapse still works correctly

**Step 4: Commit**

```bash
git add src/components/BooksHorizontal.tsx src/components/BooksHome.tsx
git commit -m "perf: add drawDistance and overrideItemLayout to FlashLists"
```

---

### Task A4: Extract inline styles in BookDurationRow

**Files:**
- Modify: `src/components/BookDurationRow.tsx` (extract inline styles)

**Step 1: Replace inline style objects with StyleSheet**

In `src/components/BookDurationRow.tsx`, replace the inline style on line 64:

```tsx
<View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>
```

With a static StyleSheet entry. Add to bottom of file:

```tsx
const styles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
```

And update the View:

```tsx
<View style={[styles.progressRow, style]}>
```

Also extract the `textStyle` object. Since it depends on `fontSize` and `color` props, memoize it:

Replace:
```tsx
const textStyle = {
  fontSize,
  color,
  fontFamily: 'Rubik' as const,
  letterSpacing: 0.7,
  opacity: 0.75,
};
```

With:
```tsx
const textStyle = useMemo(
  () => ({
    fontSize,
    color,
    fontFamily: 'Rubik' as const,
    letterSpacing: 0.7,
    opacity: 0.75,
  }),
  [fontSize, color],
);
```

Add `useMemo` to the import from React and add `StyleSheet` to the RN import.

**Step 2: Commit**

```bash
git add src/components/BookDurationRow.tsx
git commit -m "perf: extract inline styles in BookDurationRow"
```

---

### Task A5: Move child components out of 'use no memo' scope

**Files:**
- Create: `src/components/SectionHeader.tsx`
- Modify: `src/components/BooksHome.tsx` (remove SectionHeader definition, import from new file)

**Step 1: Extract SectionHeader to its own file**

Create `src/components/SectionHeader.tsx` with the full SectionHeader component from BooksHome.tsx (lines 238-294), but **without** the `'use no memo'` directive so the React Compiler can optimize it:

```tsx
import { memo, useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { fontSize, screenPadding } from '@/constants/tokens';

type SectionHeaderProps = {
  title: string;
  sectionId: string;
  isActive: boolean;
  index: number;
  onSectionPress: (sectionId: string, index: number, pageY: number) => void;
};

export const SectionHeader = memo(
  ({ title, sectionId, isActive, index, onSectionPress }: SectionHeaderProps) => {
    const headerRef = useRef<View>(null);
    const { colors: themeColors } = useTheme();

    const handlePress = useCallback(() => {
      headerRef.current?.measureInWindow((_x, y) => {
        onSectionPress(sectionId, index, y);
      });
    }, [sectionId, index, onSectionPress]);

    const chevronStyle = useMemo(
      () => [styles.chevronBase, isActive && styles.chevronRotated],
      [isActive],
    );

    return (
      <Pressable
        ref={headerRef}
        style={styles.sectionHeaderPressable}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
        onPress={handlePress}
      >
        <View style={styles.titleBar}>
          <Text
            numberOfLines={1}
            style={[styles.titleText, { color: themeColors.text }]}
          >
            {title}
          </Text>
          <ChevronRight
            size={24}
            color={themeColors.icon}
            style={chevronStyle}
          />
        </View>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  sectionHeaderPressable: {
    paddingVertical: 4,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: screenPadding.horizontal,
  },
  titleText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    maxWidth: '95%',
  },
  chevronBase: {
    marginRight: 12,
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
});
```

**Step 2: Update BooksHome.tsx**

In `src/components/BooksHome.tsx`:
- Add import: `import { SectionHeader } from './SectionHeader';`
- Remove the `SectionHeader` component definition (lines 238-294)
- Remove the duplicate style entries that are now in `SectionHeader.tsx` (`sectionHeaderPressable`, `titleBar`, `titleText`, `chevronBase`, `chevronRotated`)

**Step 3: Verify**

```bash
npx expo run:android
```

Verify section headers still render, chevron rotates on expand, press ripple works.

**Step 4: Commit**

```bash
git add src/components/SectionHeader.tsx src/components/BooksHome.tsx
git commit -m "refactor: extract SectionHeader from BooksHome for React Compiler coverage"
```

---

### Task A6: Run Flashlight measurement for Approach A

**Step 1: Build release APK**

```bash
npx expo run:android --variant release
```

**Step 2: Run Flashlight with same protocol as baseline**

```bash
flashlight measure --bundleId <your.app.bundleId> --duration 15000
```

**Step 3: Record results in results file**

Update `docs/plans/2026-02-16-list-fps-results.md` with Approach A results.

**Step 4: Compare against baseline and success criteria**

| Metric | Baseline | Approach A | Target |
|--------|----------|------------|--------|
| FPS avg | 30-35 | ??? | 50+ |
| JS CPU % | 73% | ??? | <45% |
| UI CPU % | 48% | ??? | <35% |

---

## Approach B: Deferred Section Rendering

### Task B1: Create branch from Approach A

**Step 1: Create branch**

```bash
git checkout fix/list-opt-A
git checkout -b fix/list-opt-B
```

---

### Task B2: Add visibility tracking to BooksHome

**Files:**
- Modify: `src/components/BooksHome.tsx`

**Step 1: Add visible sections state and onViewableItemsChanged**

Add state and callback to BooksHome (inside the component, after existing refs):

```tsx
const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
const BUFFER_SIZE = 2; // Mount sections ±2 above/below viewport

const viewabilityConfig = useRef({
  itemVisiblePercentThreshold: 1, // Consider visible if even 1% is showing
}).current;

const onViewableItemsChanged = useCallback(
  ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const indices = viewableItems
      .map((item) => item.index)
      .filter((i): i is number => i !== null);

    if (indices.length === 0) return;

    const minIndex = Math.max(0, Math.min(...indices) - BUFFER_SIZE);
    const maxIndex = Math.max(...indices) + BUFFER_SIZE;

    const newVisibleSet = new Set<number>();
    for (let i = minIndex; i <= maxIndex; i++) {
      newVisibleSet.add(i);
    }

    setVisibleIndices(newVisibleSet);
  },
  [],
);
```

Add the props to the outer FlashList:

```tsx
<FlashList
  ref={listRef}
  data={listData}
  renderItem={renderItem}
  onViewableItemsChanged={onViewableItemsChanged}
  viewabilityConfig={viewabilityConfig}
  // ... rest unchanged
/>
```

**Step 2: Commit**

```bash
git add src/components/BooksHome.tsx
git commit -m "perf: add visibility tracking for deferred section rendering"
```

---

### Task B3: Create SectionPlaceholder component and conditional rendering

**Files:**
- Modify: `src/components/BooksHome.tsx` (update renderItem and section components)

**Step 1: Pass `isVisible` to section components**

Update `renderItem` to pass visibility info:

```tsx
const renderItem = useCallback(
  ({ item, index }: { item: ListDataItem; index: number }) => {
    const isVisible = visibleIndices.has(index);

    if (item.type === 'recentlyAdded') {
      return (
        <RecentlyAddedSection
          books={item.books}
          activeGridSection={activeGridSection}
          index={index}
          onSectionPress={handleSectionPress}
          isVisible={isVisible}
        />
      );
    }
    if (item.type === 'author') {
      return (
        <AuthorSection
          author={item.author}
          activeGridSection={activeGridSection}
          index={index}
          onSectionPress={handleSectionPress}
          isVisible={isVisible}
        />
      );
    }
    return null;
  },
  [activeGridSection, handleSectionPress, visibleIndices],
);
```

**Step 2: Update section components to defer rendering**

Update `RecentlyAddedSection`:

```tsx
const RecentlyAddedSection = memo(
  ({ books, activeGridSection, index, onSectionPress, isVisible }: SectionProps & { isVisible: boolean }) => (
    <View style={styles.containerGap}>
      <SectionHeader
        title='Recently Added'
        sectionId='recentlyAdded'
        isActive={activeGridSection === 'recentlyAdded'}
        index={index}
        onSectionPress={onSectionPress}
      />
      {!isVisible ? (
        <View style={styles.placeholderHeight} />
      ) : activeGridSection === 'recentlyAdded' ? (
        <BooksGrid books={books} flowDirection='column' preserveOrder />
      ) : (
        <BooksHorizontal books={books} flowDirection='row' preserveOrder />
      )}
    </View>
  ),
);
```

Update `AuthorSection` similarly:

```tsx
const AuthorSection = memo(
  ({ author, activeGridSection, index, onSectionPress, isVisible }: AuthorSectionProps & { isVisible: boolean }) => (
    <View style={styles.containerGap}>
      <SectionHeader
        title={author.name}
        sectionId={author.name}
        isActive={activeGridSection === author.name}
        index={index}
        onSectionPress={onSectionPress}
      />
      {!isVisible ? (
        <View style={styles.placeholderHeight} />
      ) : activeGridSection === author.name ? (
        <BooksGrid authors={[author]} flowDirection='column' />
      ) : (
        <BooksHorizontal authors={[author]} flowDirection='row' />
      )}
    </View>
  ),
);
```

**Step 3: Add placeholder style**

Add to the styles object:

```tsx
placeholderHeight: {
  height: 220, // Same height as BooksHorizontal container
},
```

**Step 4: Wrap visibility state update in startTransition**

To prevent the mount of nested FlashLists from blocking scroll frames, wrap the state update:

```tsx
import { startTransition } from 'react';

// In onViewableItemsChanged:
const onViewableItemsChanged = useCallback(
  ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const indices = viewableItems
      .map((item) => item.index)
      .filter((i): i is number => i !== null);

    if (indices.length === 0) return;

    const minIndex = Math.max(0, Math.min(...indices) - BUFFER_SIZE);
    const maxIndex = Math.max(...indices) + BUFFER_SIZE;

    const newVisibleSet = new Set<number>();
    for (let i = minIndex; i <= maxIndex; i++) {
      newVisibleSet.add(i);
    }

    startTransition(() => {
      setVisibleIndices(newVisibleSet);
    });
  },
  [],
);
```

**Step 5: Verify**

```bash
npx expo run:android
```

Verify:
- Sections appear as you scroll (may be brief blank space for very fast scrolling)
- Section headers always visible even for non-mounted sections
- Expand/collapse still works correctly
- Scroll position is stable

**Step 6: Commit**

```bash
git add src/components/BooksHome.tsx
git commit -m "perf: defer nested FlashList mounting for off-screen sections"
```

---

### Task B4: Run Flashlight measurement for Approach B

Same protocol as Task A6. Record results and compare.

---

## Approach C: Flat List with Section Rendering

### Task C1: Create branch and design flattened data model

**Files:**
- Create: `src/components/BooksHomeFlat.tsx` (new component — keep original for comparison)
- Modify: parent screen that renders BooksHome (swap import for testing)

**Step 1: Create branch from base**

```bash
git checkout fix/list-optimization
git checkout -b fix/list-opt-C
```

**Step 2: Cherry-pick Approach A optimizations**

Cherry-pick the shared optimizations from Approach A (expo-image, consolidated selectors, BookDurationRow styles, SectionHeader extraction):

```bash
git cherry-pick <commit-hash-A1> <commit-hash-A2> <commit-hash-A4> <commit-hash-A5>
```

If cherry-pick conflicts, resolve manually. The key commits are:
- A1: expo-image replacement in BookGridItem
- A2: consolidated selector hook
- A4: BookDurationRow inline style extraction
- A5: SectionHeader extraction

**Step 3: Commit merge resolution if needed**

```bash
git add -A && git commit -m "chore: cherry-pick Approach A optimizations into Approach C"
```

---

### Task C2: Build the flattened data model

**Files:**
- Create: `src/components/BooksHomeFlat.tsx`

**Step 1: Create BooksHomeFlat.tsx with type definitions and data flattening**

```tsx
'use no memo'; // Receives Reanimated scroll handler
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { BookGridItem } from './BookGridItem';
import { SectionHeader } from './SectionHeader';
import { Book, Author } from '@/types/Book';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { withOpacity } from '@/helpers/colorUtils';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';

// --- Types ---

type FlatListItem =
  | { type: 'sectionHeader'; sectionId: string; title: string; bookCount: number }
  | { type: 'horizontalRow'; sectionId: string; bookIds: string[]; totalCount: number }
  | { type: 'gridBook'; sectionId: string; bookId: string };

export type BooksHomeFlatProps = {
  authors?: Author[];
  setActiveGridSection: React.Dispatch<React.SetStateAction<string | null>>;
  activeGridSection: string | null;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent?: React.ReactElement;
};

const MAX_HORIZONTAL_ITEMS = 8;

// --- Main Component ---

const BooksHomeFlat = ({
  authors = [],
  setActiveGridSection,
  activeGridSection,
  onScroll,
  ListHeaderComponent,
}: BooksHomeFlatProps) => {
  const { colors: themeColors } = useTheme();
  const numColumns = useSettingsStore((state) => state.numColumns);
  const listRef = useRef<React.ComponentRef<typeof FlashList<FlatListItem>>>(null);
  const listContainerRef = useRef<View>(null);
  const pendingScrollRef = useRef<{ index: number; relativeY: number } | null>(null);
  const CONTAINER_PADDING_TOP = 8;

  const { width: screenWidth } = Dimensions.get('window');
  const ITEM_MARGIN_HORIZONTAL = 10;
  const itemWidth = useMemo(
    () => (screenWidth - ITEM_MARGIN_HORIZONTAL * (numColumns + 1)) / numColumns,
    [screenWidth, numColumns],
  );

  // Sort authors alphabetically
  const sortedAuthors = useMemo(() => {
    return [...authors].sort((a, b) => a.name.toUpperCase().localeCompare(b.name.toUpperCase()));
  }, [authors]);

  // Build recently added books (top 25 by ctime)
  const recentlyAddedBooks = useMemo(() => {
    const allBooks = sortedAuthors.flatMap((author) => author.books);
    allBooks.sort((a, b) => {
      const timeA = typeof a.metadata.ctime === 'number' ? a.metadata.ctime : new Date(a.metadata.ctime).getTime();
      const timeB = typeof b.metadata.ctime === 'number' ? b.metadata.ctime : new Date(b.metadata.ctime).getTime();
      return timeB - timeA;
    });
    return allBooks.slice(0, 25);
  }, [sortedAuthors]);

  // Flatten all sections into a single list of FlatListItems
  const flatListData: FlatListItem[] = useMemo(() => {
    if (recentlyAddedBooks.length === 0 && sortedAuthors.length === 0) return [];

    const items: FlatListItem[] = [];

    // Recently Added section
    if (recentlyAddedBooks.length > 0) {
      const recentBookIds = recentlyAddedBooks.map((b) => b.bookId).filter(Boolean);
      items.push({
        type: 'sectionHeader',
        sectionId: 'recentlyAdded',
        title: 'Recently Added',
        bookCount: recentBookIds.length,
      });

      if (activeGridSection === 'recentlyAdded') {
        // Expanded: emit individual grid books
        for (const bookId of recentBookIds) {
          items.push({ type: 'gridBook', sectionId: 'recentlyAdded', bookId });
        }
      } else {
        // Collapsed: emit single horizontal row
        items.push({
          type: 'horizontalRow',
          sectionId: 'recentlyAdded',
          bookIds: recentBookIds.slice(0, MAX_HORIZONTAL_ITEMS),
          totalCount: recentBookIds.length,
        });
      }
    }

    // Author sections
    for (const author of sortedAuthors) {
      const authorBookIds = [...author.books]
        .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle))
        .map((b) => b.bookId)
        .filter(Boolean);

      items.push({
        type: 'sectionHeader',
        sectionId: author.name,
        title: author.name,
        bookCount: authorBookIds.length,
      });

      if (activeGridSection === author.name) {
        // Expanded: emit individual grid books
        for (const bookId of authorBookIds) {
          items.push({ type: 'gridBook', sectionId: author.name, bookId });
        }
      } else {
        // Collapsed: emit single horizontal row
        items.push({
          type: 'horizontalRow',
          sectionId: author.name,
          bookIds: authorBookIds.slice(0, MAX_HORIZONTAL_ITEMS),
          totalCount: authorBookIds.length,
        });
      }
    }

    return items;
  }, [recentlyAddedBooks, sortedAuthors, activeGridSection]);

  // --- Section press handler (expand/collapse) ---

  const handleSectionPress = useCallback(
    (sectionId: string, index: number, pageY: number) => {
      listContainerRef.current?.measureInWindow((_x, listTopY) => {
        const relativeY = pageY - listTopY;
        pendingScrollRef.current = { index, relativeY };

        setActiveGridSection((prev) => {
          const newValue = prev === sectionId ? null : sectionId;

          requestAnimationFrame(() => {
            if (pendingScrollRef.current && listRef.current) {
              listRef.current.scrollToIndex({
                index: pendingScrollRef.current.index,
                animated: false,
                viewOffset: -pendingScrollRef.current.relativeY + CONTAINER_PADDING_TOP,
              });
              pendingScrollRef.current = null;
            }
          });

          return newValue;
        });
      });
    },
    [setActiveGridSection],
  );

  // --- Render item ---

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
            <HorizontalRow
              bookIds={item.bookIds}
              totalCount={item.totalCount}
              sectionId={item.sectionId}
              onExpand={(pageY: number) => handleSectionPress(item.sectionId, index - 1, pageY)}
            />
          );
        case 'gridBook':
          return (
            <BookGridItem
              bookId={item.bookId}
              flowDirection="column"
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

  // --- Key extractor ---

  const keyExtractor = useCallback(
    (item: FlatListItem) => {
      switch (item.type) {
        case 'sectionHeader':
          return `header-${item.sectionId}`;
        case 'horizontalRow':
          return `hrow-${item.sectionId}`;
        case 'gridBook':
          return `grid-${item.sectionId}-${item.bookId}`;
      }
    },
    [],
  );

  // --- Item type for recycling pools ---

  const getItemType = useCallback(
    (item: FlatListItem) => item.type,
    [],
  );

  return (
    <View ref={listContainerRef} style={{ flex: 1, paddingTop: CONTAINER_PADDING_TOP }}>
      <FlashList
        ref={listRef}
        data={flatListData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        onScroll={onScroll}
        scrollEventThrottle={16}
        drawDistance={250}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          <Text style={[utilsStyles.emptyComponent, { color: themeColors.textMuted }]}>
            No books found
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 58 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default memo(BooksHomeFlat);
```

**Step 2: Commit the skeleton**

```bash
git add src/components/BooksHomeFlat.tsx
git commit -m "feat: add BooksHomeFlat skeleton with flattened data model"
```

---

### Task C3: Build the HorizontalRow and OverflowCard components

**Files:**
- Create: `src/components/HorizontalRow.tsx`
- Create: `src/components/OverflowCard.tsx`

**Step 1: Create OverflowCard component**

Create `src/components/OverflowCard.tsx`:

```tsx
import { memo, useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from 'pressto';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { fontSize } from '@/constants/tokens';

type OverflowCardProps = {
  count: number;
  onExpand: (pageY: number) => void;
};

export const OverflowCard = memo(({ count, onExpand }: OverflowCardProps) => {
  const { colors: themeColors } = useTheme();
  const cardRef = useRef<View>(null);

  const handlePress = useCallback(() => {
    cardRef.current?.measureInWindow((_x, y) => {
      onExpand(y);
    });
  }, [onExpand]);

  return (
    <PressableScale
      rippleRadius={0}
      onPress={handlePress}
      style={styles.container}
    >
      <View
        ref={cardRef}
        style={[
          styles.card,
          { backgroundColor: withOpacity(themeColors.textMuted, 0.08) },
        ]}
      >
        <Text style={[styles.countText, { color: themeColors.text }]}>
          +{count}
        </Text>
        <Text style={[styles.moreText, { color: themeColors.textMuted }]}>
          more
        </Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    alignItems: 'center',
    marginBottom: 8,
  },
  card: {
    height: 140,
    width: 100,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: fontSize.lg,
  },
  moreText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
  },
});
```

**Step 2: Create HorizontalRow component**

Create `src/components/HorizontalRow.tsx`:

```tsx
import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BookGridItem } from './BookGridItem';
import { OverflowCard } from './OverflowCard';

type HorizontalRowProps = {
  bookIds: string[];
  totalCount: number;
  sectionId: string;
  onExpand: (pageY: number) => void;
};

export const HorizontalRow = memo(
  ({ bookIds, totalCount, sectionId, onExpand }: HorizontalRowProps) => {
    const remaining = totalCount - bookIds.length;

    return (
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {bookIds.map((bookId) => (
            <BookGridItem
              key={bookId}
              bookId={bookId}
              flowDirection="row"
            />
          ))}
          {remaining > 0 && (
            <OverflowCard count={remaining} onExpand={onExpand} />
          )}
        </ScrollView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    height: 220,
  },
  scrollContent: {
    paddingBottom: 6,
  },
});
```

**Step 3: Update BooksHomeFlat.tsx imports**

Add to imports in `src/components/BooksHomeFlat.tsx`:

```tsx
import { HorizontalRow } from './HorizontalRow';
```

Remove the inline HorizontalRow reference if it was defined locally. The component is now imported.

**Step 4: Verify**

```bash
npx expo run:android
```

Navigate to library (after swapping BooksHome for BooksHomeFlat in the parent screen — see Task C4). Verify:
- Collapsed sections show horizontal row of book covers
- Scrolling horizontally through 8 books works
- "+X more" card appears at the end of rows with >8 books
- Tapping the overflow card expands the section

**Step 5: Commit**

```bash
git add src/components/HorizontalRow.tsx src/components/OverflowCard.tsx src/components/BooksHomeFlat.tsx
git commit -m "feat: add HorizontalRow and OverflowCard components for flat list"
```

---

### Task C4: Integrate BooksHomeFlat into the parent screen

**Files:**
- Modify: the parent screen that currently imports BooksHome (find with grep)

**Step 1: Find the parent screen**

```bash
# Search for imports of BooksHome
```

Grep for `import.*BooksHome` in `src/` to find the parent.

**Step 2: Swap the import**

Replace:
```tsx
import BooksHome from '@/components/BooksHome';
```

With:
```tsx
import BooksHomeFlat from '@/components/BooksHomeFlat';
```

Update the JSX usage accordingly (the props interface is the same, minus the `books` prop which was already unused).

**Step 3: Verify the full flow**

```bash
npx expo run:android
```

Test:
- Library screen loads with flat list
- Vertical scrolling is smooth
- Horizontal rows scroll
- Overflow cards appear and work
- Section headers expand/collapse
- Expanded sections show grid layout
- Play/pause icons work
- Navigation to book details works

**Step 4: Commit**

```bash
git add <parent-screen-file>
git commit -m "feat: swap BooksHome for BooksHomeFlat in library screen"
```

---

### Task C5: Handle expanded grid layout (Option 1: manual column layout)

**Files:**
- Modify: `src/components/BooksHomeFlat.tsx` (gridBook rendering may need a wrapper)

**Step 1: Verify grid layout behavior**

When a section is expanded, `gridBook` items are emitted individually. Since we're in a single-column FlashList, each `gridBook` renders as a full-width row containing one BookGridItem.

For a proper grid appearance, we need the expanded section's books to flow into a multi-column grid. Two implementation paths:

**Path A — Emit grid rows as composite items:**

Instead of individual `gridBook` items, group them into rows:

```tsx
// In flatListData construction, expanded section:
if (activeGridSection === author.name) {
  // Group bookIds into rows of numColumns
  for (let i = 0; i < authorBookIds.length; i += numColumns) {
    const rowBookIds = authorBookIds.slice(i, i + numColumns);
    items.push({
      type: 'gridRow' as const,
      sectionId: author.name,
      bookIds: rowBookIds,
    });
  }
}
```

Add `gridRow` type:
```tsx
type FlatListItem =
  | { type: 'sectionHeader'; sectionId: string; title: string; bookCount: number }
  | { type: 'horizontalRow'; sectionId: string; bookIds: string[]; totalCount: number }
  | { type: 'gridRow'; sectionId: string; bookIds: string[] };
```

Render `gridRow`:
```tsx
case 'gridRow':
  return (
    <View style={styles.gridRow}>
      {item.bookIds.map((bookId) => (
        <BookGridItem
          key={bookId}
          bookId={bookId}
          flowDirection="column"
          numColumns={numColumns}
          itemWidth={itemWidth}
        />
      ))}
    </View>
  );
```

Style:
```tsx
gridRow: {
  flexDirection: 'row',
  justifyContent: 'flex-start',
},
```

**Path B — Use a single `gridContainer` item per expanded section:**

Emit one item whose render contains all the books with `flexWrap`:

```tsx
if (activeGridSection === author.name) {
  items.push({
    type: 'gridContainer' as const,
    sectionId: author.name,
    bookIds: authorBookIds,
  });
}
```

Render:
```tsx
case 'gridContainer':
  return (
    <View style={styles.gridContainer}>
      {item.bookIds.map((bookId) => (
        <BookGridItem
          key={bookId}
          bookId={bookId}
          flowDirection="column"
          numColumns={numColumns}
          itemWidth={itemWidth}
        />
      ))}
    </View>
  );
```

Style:
```tsx
gridContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
},
```

**Recommendation:** Use **Path A (gridRow)** because it gives FlashList uniform-height items for better recycling. Path B puts all books in a single non-virtualized container, which defeats the purpose for large author collections (50+ books).

**Step 2: Implement Path A**

Update the type definition, data flattening logic, and renderItem in `BooksHomeFlat.tsx` as shown above.

**Step 3: Verify grid layout**

```bash
npx expo run:android
```

Expand a section — books should appear in a grid matching the numColumns setting.

**Step 4: Commit**

```bash
git add src/components/BooksHomeFlat.tsx
git commit -m "feat: implement grid row layout for expanded sections"
```

---

### Task C6: Run Flashlight measurement for Approach C

Same protocol as Task A6. Record results and compare against baseline, A, and B.

---

## Approach D: Navigate-to-Author Detail (Last Resort)

Only build this if Approaches A, B, and C all fail to reach the 50+ FPS target.

### Task D1: Create branch and build AuthorCard

**Step 1: Create branch**

```bash
git checkout fix/list-optimization
git checkout -b fix/list-opt-D
```

Cherry-pick Approach A optimizations as in Task C1 Step 2.

**Step 2: Create AuthorCard component**

Create `src/components/AuthorCard.tsx` — a compact card showing author name, book count, and 2-3 fanned cover thumbnails. Tapping navigates to a new author detail screen.

**Step 3: Create author detail screen**

Create a new Expo Router screen at `src/app/authorDetail.tsx` that receives `authorName` as a param, looks up the author from the store, and renders `BooksGrid` with that author's books.

**Step 4: Build simplified BooksHomeSimple**

Create `src/components/BooksHomeSimple.tsx` — a flat FlashList with `recentlyAdded` (using HorizontalRow from Approach C) and `authorCard` item types. Zero nesting.

### Task D2: Run Flashlight measurement for Approach D

Same protocol. This should show near-60fps since there's zero nesting.

---

## Post-Implementation: Results Comparison

### Task Final: Compare all approaches

Create a comparison table:

| Metric | Baseline | A | B | C | D | Target |
|--------|----------|---|---|---|---|--------|
| FPS avg | | | | | | 50+ |
| FPS p5 | | | | | | 40+ |
| JS CPU % | | | | | | <45% |
| UI CPU % | | | | | | <35% |
| Subjective jank | | | | | | Rare |

Choose the best-performing approach that preserves the desired UX. If C hits the target, it's likely the best balance of performance and features. If only D hits the target, revisit C with additional optimizations before accepting the UX trade-off.

---

## Profiling Guide: Deeper Investigation

If the Flashlight numbers don't tell the full story, use these tools:

### React DevTools Profiler

1. Enable: `npx react-devtools` in a separate terminal
2. Open the Profiler tab
3. Click Record, scroll the list for 5 seconds, click Stop
4. Look at the flamegraph — sort by "Self time" to find the slowest components
5. Check "Why did this render?" for unexpected re-renders
6. Key things to look for:
   - Components rendering >5ms
   - Components rendering when they shouldn't (no prop changes)
   - Large "commit" durations (>16ms = dropped frame)

### Android Studio CPU Profiler (Systrace)

1. Open Android Studio > Profiler > CPU
2. Select "System Trace" recording type
3. Scroll the list for 5 seconds
4. Look at the thread timeline:
   - `mqt_js` = JS thread (React, FlashList logic)
   - `UI Thread` = native layout, view creation
   - `RenderThread` = GPU drawing
5. Zoom into a single frame (16ms window) and see which thread is taking longest
6. Look for long "Choreographer#doFrame" durations on the UI thread

### Hermes CPU Profile

1. In dev mode, shake device > "Start/Stop JS Profiling"
2. Pull the profile: `adb pull /data/user/0/<bundleId>/files/ReactNativeDevBundle.cpuprofile`
3. Open in Chrome DevTools (chrome://tracing)
4. Look for hot functions in the JS thread during scroll
