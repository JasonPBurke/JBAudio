# Category Transition Fade-Out Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fade out book cards over 500ms when they leave a filtered category tab (Unplayed/Playing/Finished).

**Architecture:** Thread `selectedTab` from LibraryScreen down to BookGridItem/BookListItem. Each item wraps its root in a Reanimated `Animated.View` with a conditional `exiting={FadeOut}` prop that only activates on category tabs (not "All").

**Tech Stack:** react-native-reanimated 4 (`FadeOut`), FlashList, Zustand, React Native

**Design doc:** `docs/plans/2026-02-13-category-transition-fadeout-design.md`

---

### Task 1: Thread `selectedTab` through BookGridItem

This task adds the `selectedTab` prop to the grid item and wraps it in an animated view with the exiting animation.

**Files:**
- Modify: `src/components/BookGridItem.tsx`

**Step 1: Add import and prop**

Add Reanimated imports and the `selectedTab` prop:

```tsx
// Add to existing imports:
import Animated, { FadeOut } from 'react-native-reanimated';
import { CustomTabs } from '@/components/TabScreen';

// Update the props type:
export type BookGridItemProps = {
  bookId: string;
  flowDirection: 'row' | 'column';
  numColumns?: number;
  itemWidth?: number;
  selectedTab?: CustomTabs;  // <-- add this
};
```

Destructure `selectedTab` in the component params.

**Step 2: Wrap root element in Animated.View with conditional exiting**

Wrap the existing `<PressableScale>` in an `Animated.View`:

```tsx
const exitAnimation = selectedTab != null && selectedTab !== CustomTabs.All
  ? FadeOut.delay(200).duration(500)
  : undefined;

return (
  <Animated.View exiting={exitAnimation}>
    <PressableScale
      rippleRadius={0}
      style={styles.pressableContainer}
      onPress={handlePress}
    >
      {/* ... existing content unchanged ... */}
    </PressableScale>
  </Animated.View>
);
```

Note: `selectedTab` is optional (defaults to `undefined`) so existing callers that don't pass it won't get animations — this is safe for incremental adoption.

**Step 3: Verify the app compiles**

Run: `npx expo start` and confirm no TypeScript errors on the library screen.

**Step 4: Commit**

```bash
git add src/components/BookGridItem.tsx
git commit -m "feat: add conditional fade-out exiting animation to BookGridItem"
```

---

### Task 2: Thread `selectedTab` through BookListItem

Same pattern as Task 1 but for the list view item.

**Files:**
- Modify: `src/components/BookListItem.tsx`

**Step 1: Add import and prop**

```tsx
// Add to existing imports:
import Animated, { FadeOut } from 'react-native-reanimated';
import { CustomTabs } from '@/components/TabScreen';

// Update the props type:
export type BookListItemProps = {
  bookId: string;
  selectedTab?: CustomTabs;  // <-- add this
};
```

Destructure `selectedTab` in the component params.

**Step 2: Wrap root element in Animated.View**

Wrap the existing `<Pressable>` in an `Animated.View`:

```tsx
const exitAnimation = selectedTab != null && selectedTab !== CustomTabs.All
  ? FadeOut.delay(200).duration(500)
  : undefined;

return (
  <Animated.View exiting={exitAnimation}>
    <Pressable
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      onPress={handlePress}
    >
      {/* ... existing content unchanged ... */}
    </Pressable>
  </Animated.View>
);
```

**Step 3: Verify the app compiles**

Run: `npx expo start` and confirm no TypeScript errors.

**Step 4: Commit**

```bash
git add src/components/BookListItem.tsx
git commit -m "feat: add conditional fade-out exiting animation to BookListItem"
```

---

### Task 3: Thread `selectedTab` through BooksGrid

Pass `selectedTab` from BooksGrid down to each BookGridItem it renders.

**Files:**
- Modify: `src/components/BooksGrid.tsx`

**Step 1: Add prop to type and destructure**

```tsx
import { CustomTabs } from '@/components/TabScreen';

export type BookGridProps = Partial<FlashListProps<string>> & {
  authors?: Author[];
  books?: Book[];
  standAlone?: boolean;
  flowDirection: 'row' | 'column';
  preserveOrder?: boolean;
  selectedTab?: CustomTabs;  // <-- add this
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent?: React.ReactElement;
};
```

Destructure `selectedTab` in the component params alongside existing props.

**Step 2: Forward to BookGridItem in renderBookItem**

Update the `renderBookItem` callback:

```tsx
const renderBookItem = useCallback(
  ({ item: bookId }: { item: string }) => (
    <BookGridItem
      bookId={bookId}
      flowDirection={flowDirection}
      numColumns={numColumns}
      itemWidth={itemWidth}
      selectedTab={selectedTab}
    />
  ),
  [flowDirection, numColumns, itemWidth, selectedTab],
);
```

**Step 3: Verify the app compiles**

**Step 4: Commit**

```bash
git add src/components/BooksGrid.tsx
git commit -m "feat: thread selectedTab through BooksGrid to BookGridItem"
```

---

### Task 4: Thread `selectedTab` through BooksList

Pass `selectedTab` from BooksList down to each BookListItem it renders.

**Files:**
- Modify: `src/components/BooksList.tsx`

**Step 1: Add prop to type and destructure**

```tsx
import { CustomTabs } from '@/components/TabScreen';

export type BookListProps = Partial<FlashListProps<string>> & {
  authors: Author[];
  selectedTab?: CustomTabs;  // <-- add this
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent?: React.ReactElement;
};
```

Destructure `selectedTab` in the component params.

**Step 2: Forward to BookListItem in renderBookItem**

```tsx
const renderBookItem = useCallback(
  ({ item: bookId }: { item: string }) => (
    <BookListItem bookId={bookId} selectedTab={selectedTab} />
  ),
  [selectedTab]
);
```

**Step 3: Verify the app compiles**

**Step 4: Commit**

```bash
git add src/components/BooksList.tsx
git commit -m "feat: thread selectedTab through BooksList to BookListItem"
```

---

### Task 5: Thread `selectedTab` through BooksHorizontal

BooksHorizontal renders BookGridItems inside BooksHome sections. It needs the prop too.

**Files:**
- Modify: `src/components/BooksHorizontal.tsx`

**Step 1: Add prop to type and destructure**

```tsx
import { CustomTabs } from '@/components/TabScreen';

export type BookHorizontalProps = Partial<FlashListProps<string>> & {
  authors?: Author[];
  books?: Book[];
  flowDirection: 'row' | 'column';
  preserveOrder?: boolean;
  selectedTab?: CustomTabs;  // <-- add this
};
```

Destructure `selectedTab` in the component params.

**Step 2: Forward to BookGridItem in renderBookItem**

```tsx
const renderBookItem = useCallback(
  ({ item: bookId }: { item: string }) => (
    <BookGridItem bookId={bookId} flowDirection={flowDirection} selectedTab={selectedTab} />
  ),
  [flowDirection, selectedTab]
);
```

**Step 3: Verify the app compiles**

**Step 4: Commit**

```bash
git add src/components/BooksHorizontal.tsx
git commit -m "feat: thread selectedTab through BooksHorizontal to BookGridItem"
```

---

### Task 6: Thread `selectedTab` through BooksHome

BooksHome renders BooksGrid and BooksHorizontal inside sections. Thread the prop through.

**Files:**
- Modify: `src/components/BooksHome.tsx`

**Step 1: Add prop to BookListProps type**

```tsx
import { CustomTabs } from '@/components/TabScreen';

export type BookListProps = Partial<FlashListProps<Book>> & {
  authors?: Author[];
  books?: Book[];
  setActiveGridSection: React.Dispatch<React.SetStateAction<string | null>>;
  activeGridSection: string | null;
  selectedTab?: CustomTabs;  // <-- add this
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent?: React.ReactElement;
};
```

Destructure `selectedTab` in the BooksHome component params.

**Step 2: Pass selectedTab to RecentlyAddedSection and AuthorSection**

Add `selectedTab` to the `SectionProps` and `AuthorSectionProps` types, and pass it through from `renderItem`.

In `renderItem`:
```tsx
if (item.type === 'recentlyAdded') {
  return (
    <RecentlyAddedSection
      books={item.books}
      activeGridSection={activeGridSection}
      index={index}
      onSectionPress={handleSectionPress}
      selectedTab={selectedTab}
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
      selectedTab={selectedTab}
    />
  );
}
```

**Step 3: Forward from section components to BooksGrid/BooksHorizontal**

In `RecentlyAddedSection`, add `selectedTab` to `SectionProps` type and pass through:
```tsx
{activeGridSection === 'recentlyAdded' ? (
  <BooksGrid books={books} flowDirection='column' preserveOrder selectedTab={selectedTab} />
) : (
  <BooksHorizontal books={books} flowDirection='row' preserveOrder selectedTab={selectedTab} />
)}
```

In `AuthorSection`, add `selectedTab` to `AuthorSectionProps` type and pass through:
```tsx
{activeGridSection === author.name ? (
  <BooksGrid authors={[author]} flowDirection='column' selectedTab={selectedTab} />
) : (
  <BooksHorizontal authors={[author]} flowDirection='row' selectedTab={selectedTab} />
)}
```

**Step 4: Update renderItem dependency array**

Add `selectedTab` to the `renderItem` useCallback dependency array:
```tsx
[activeGridSection, handleSectionPress, selectedTab]
```

**Step 5: Verify the app compiles**

**Step 6: Commit**

```bash
git add src/components/BooksHome.tsx
git commit -m "feat: thread selectedTab through BooksHome to child list components"
```

---

### Task 7: Pass `selectedTab` from LibraryScreen to all list components

This is the final wiring step — connect the prop source to all three list views.

**Files:**
- Modify: `src/app/(drawer)/(library)/index.tsx`

**Step 1: Add selectedTab prop to all three list components**

```tsx
{toggleView === 0 && (
  <BooksHome
    authors={tabFilteredLibrary}
    setActiveGridSection={setActiveGridSection}
    activeGridSection={activeGridSection}
    onScroll={onScroll}
    ListHeaderComponent={ListSpacer}
    selectedTab={selectedTab}
  />
)}
{toggleView === 1 && (
  <BooksList
    authors={tabFilteredLibrary}
    onScroll={onScroll}
    ListHeaderComponent={ListSpacer}
    selectedTab={selectedTab}
  />
)}
{toggleView === 2 && (
  <BooksGrid
    authors={tabFilteredLibrary}
    standAlone={true}
    flowDirection='column'
    onScroll={onScroll}
    ListHeaderComponent={ListSpacer}
    selectedTab={selectedTab}
  />
)}
```

No new imports needed — `selectedTab` already exists in this component's state.

**Step 2: Verify the app compiles and test on device**

Test procedure:
1. Open app, select the "Unplayed" tab
2. Press play on an unplayed book
3. Confirm the book card fades out over ~700ms (200ms delay + 500ms fade)
4. Switch to "Playing" tab, confirm the book appeared there
5. Switch to "All" tab, confirm no fade animations occur
6. Test in all three view modes (BooksHome, BooksList, BooksGrid)

**Step 3: Commit**

```bash
git add src/app/(drawer)/(library)/index.tsx
git commit -m "feat: wire selectedTab to list components, completing category fade-out"
```
