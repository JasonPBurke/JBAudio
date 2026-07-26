import { FlashList, FlashListProps } from '@shopify/flash-list';
import { useCallback, memo, useMemo, useRef } from 'react';
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
import { CustomTabs } from '@/types/CustomTabs';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';

const styles = StyleSheet.create({
  container: {
    paddingTop: 6,
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

export type BookGridProps = Partial<FlashListProps<string>> & {
  authors?: Author[];
  books?: Book[];
  standAlone?: boolean;
  flowDirection: 'row' | 'column';
  preserveOrder?: boolean;
  recencyMode?: LibraryRecencyMode;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent?: React.ReactElement;
  selectedTab: CustomTabs;
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
  selectedTab,
}: BookGridProps) => {
  const { colors: themeColors } = useTheme();
  const numColumns = useSettingsStore((state) => state.numColumns);
  const listRef = useRef<React.ComponentRef<typeof FlashList<string>>>(null);
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
      scrollEventThrottle={16}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={ItemSeparator}
      ListFooterComponent={standAlone ? StandaloneFooter : null}
      ListEmptyComponent={emptyComponent}
    />
  );
};

export default memo(BooksGrid);
