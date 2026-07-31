# Category Transition Fade-Out Animation

## Problem

When a book moves between categories (unplayed -> playing -> finished), it immediately disappears from one list and appears in another. This is jarring — the user has no visual confirmation of what happened.

## Solution

Use Reanimated's `exiting` prop (`FadeOut.delay(200).duration(500)`) on book item components so they fade out before unmounting when removed from a filtered list.

## Scope

- Only animates on category tabs (Unplayed, Playing, Finished) — not on "All" tab
- Only the fade-out (departure) is animated; appearance in the new category stays instant
- Affects `BookGridItem` and `BookListItem`

## Architecture

### Data flow

`LibraryScreen` passes `selectedTab` down through the list components:

```
LibraryScreen (selectedTab state)
  -> BooksHome -> BooksGrid/BooksHorizontal -> BookGridItem (exiting animation)
  -> BooksList -> BookListItem (exiting animation)
  -> BooksGrid -> BookGridItem (exiting animation)
```

### Animation wrapper

Each item component wraps its root element in `Animated.View` with:
- `exiting={FadeOut.delay(200).duration(500)}` when `selectedTab !== CustomTabs.All`
- `exiting={undefined}` on the "All" tab (no animation overhead)

### Files changed

1. **`src/app/(drawer)/(library)/index.tsx`** — Pass `selectedTab` to BooksHome, BooksList, BooksGrid
2. **`src/components/BooksGrid.tsx`** — Accept `selectedTab`, forward to BookGridItem
3. **`src/components/BooksList.tsx`** — Accept `selectedTab`, forward to BookListItem
4. **`src/components/BooksHome.tsx`** — Accept `selectedTab`, forward to BooksGrid and BooksHorizontal
5. **`src/components/BooksHorizontal.tsx`** — Accept `selectedTab`, forward to BookGridItem
6. **`src/components/BookGridItem.tsx`** — Wrap in Animated.View with conditional exiting
7. **`src/components/BookListItem.tsx`** — Wrap in Animated.View with conditional exiting

## Performance

- Animation runs entirely on UI thread (Reanimated worklets)
- Zero JS thread cost during animation
- No overhead when not animating (exiting only fires on unmount)
- FlashList cell recycling is unaffected (recycled cells don't unmount)
- Conditional: no Reanimated overhead on "All" tab

## Risks

- FlashList cell recycling could theoretically cause spurious fade-outs during rapid scrolling. Mitigation: test on device; fallback is using `CellRendererComponent` prop if needed.
