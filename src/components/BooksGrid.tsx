import { FlashList, FlashListProps } from '@shopify/flash-list';
import { useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
} from 'react-native';

import { utilsStyles } from '@/styles';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { compareBookTitles } from '@/helpers/miscellaneous';
import {
  LibraryRecencyMode,
  RECENCY_KEY_FOR_MODE,
  sortBooksByRecency,
} from '@/helpers/bookRecency';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import type { LadderListProps } from '@/types/ladderList';

const styles = StyleSheet.create({
  /*
   * The first row's top edge is pinned to the SAME 8-point inset the sectioned
   * home and the Series shelf give theirs (device pass, ticket 04). Each
   * `BookGridItem` carries 14 points of slack above its cover (4 pressable + 10
   * image box) as inter-row rhythm, which the first row has no use for, so the
   * list-level number that lands the cover at 8 is 8 - 14. Yoga drops negative
   * padding; a negative margin on the scroll view does the same job, and the
   * six points it lifts are the shared search-bar spacer, already hidden under
   * the bar. The spacer itself is untouched -- D6 pins it.
   */
  container: {
    marginTop: -6,
  },
  separator: {
    height: 12,
  },
  footer: {
    height: 82,
  },
});

// Module-level constants — stable references across all renders
const ItemSeparator = () => <View style={styles.separator} />;
const StandaloneFooter = <View style={styles.footer} />;
const keyExtractor = (item: string) => item;

export type BookGridProps = Partial<FlashListProps<string>> &
  LadderListProps & {
    authors?: Author[];
    books?: Book[];
    standAlone?: boolean;
    flowDirection: 'row' | 'column';
    preserveOrder?: boolean;
    recencyMode?: LibraryRecencyMode;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    ListHeaderComponent?: React.ReactElement;
  };

const BooksGrid = ({
  authors,
  books,
  standAlone,
  flowDirection,
  preserveOrder,
  recencyMode = null,
  onScroll,
  ListHeaderComponent,
  listRef,
  selectedTab,
  onMomentumScrollEnd,
  onScrollEndDrag,
}: BookGridProps) => {
  const { colors: themeColors } = useTheme();
  const numColumns = useSettingsStore((state) => state.numColumns);
  // §H6 -- the list ref belongs to the LIBRARY SCREEN and this component keeps
  // no fallback. `LadderListProps` says why.
  useResetScrollOnTabChange(listRef, selectedTab);

  const { width: screenWidth } = Dimensions.get('window');
  const ITEM_MARGIN_HORIZONTAL = 10;
  const itemWidth = useMemo(
    () =>
      (screenWidth - ITEM_MARGIN_HORIZONTAL * (numColumns + 1)) /
      numColumns,
    [screenWidth, numColumns],
  );

  // This is the core change. We now create a stable list of book IDs.
  // useMemo ensures this list is only recalculated when the `authors` array changes.
  // Books are sorted by title within each author's collection.
  const bookIds = useMemo(() => {
    if (books) {
      const sorted = preserveOrder
        ? books
        : [...books].sort((a, b) =>
            compareBookTitles(a.bookTitle, b.bookTitle),
          );
      return sorted.map((book) => book.bookId).filter((bookId) => !!bookId);
    }
    if (authors) {
      // Standalone view: sort all books by title regardless of author
      // (or most-recent-first on the Started/Finished tabs)
      // Embedded view (BooksHome): sort within each author group
      if (standAlone) {
        const allBooks = authors.flatMap((author) => author.books);
        const sorted = recencyMode
          ? sortBooksByRecency(allBooks, RECENCY_KEY_FOR_MODE[recencyMode])
          : allBooks.sort((a, b) =>
              compareBookTitles(a.bookTitle, b.bookTitle),
            );
        return sorted
          .map((book) => book.bookId)
          .filter((bookId): bookId is string => !!bookId);
      }
      return authors
        .flatMap((author) =>
          [...author.books]
            .sort((a, b) => compareBookTitles(a.bookTitle, b.bookTitle))
            .map((book) => book.bookId),
        )
        .filter((bookId): bookId is string => !!bookId);
    }
    return [];
  }, [authors, books, preserveOrder, recencyMode, standAlone]);

  const renderBookItem = useCallback(
    ({ item: bookId }: { item: string }) => (
      <BookGridItem
        bookId={bookId}
        flowDirection={flowDirection}
        numColumns={numColumns}
        itemWidth={itemWidth}
      /> // DIAGNOSTIC D
    ),
    [flowDirection, numColumns, itemWidth],
  );

  const emptyComponent = useMemo(
    () => (
      <Text
        style={[
          utilsStyles.emptyComponent,
          { color: themeColors.textMuted },
        ]}
      >
        No books found
      </Text>
    ),
    [themeColors.textMuted],
  );

  return (
    <FlashList
      ref={listRef}
      style={styles.container}
      data={bookIds}
      renderItem={renderBookItem}
      masonry
      optimizeItemArrangement
      numColumns={numColumns}
      keyExtractor={keyExtractor}
      drawDistance={150}
      overrideProps={{ initialDrawBatchSize: 6 }}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onScrollEndDrag={onScrollEndDrag}
      scrollEventThrottle={16}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={ItemSeparator}
      ListFooterComponent={standAlone ? StandaloneFooter : null}
      ListEmptyComponent={emptyComponent}
    />
  );
};

export default memo(BooksGrid);
