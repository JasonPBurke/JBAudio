'use no memo'; // Receives Reanimated scroll handler

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
import React from 'react';

export type BookGridProps = Partial<FlashListProps<string>> & {
  authors?: Author[];
  books?: Book[];
  standAlone?: boolean;
  flowDirection: 'row' | 'column';
  preserveOrder?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent?: React.ReactElement;
};

const BooksGrid = ({
  authors,
  books,
  standAlone,
  flowDirection,
  preserveOrder,
  onScroll,
  ListHeaderComponent,
}: BookGridProps) => {
  const { colors: themeColors } = useTheme();
  const numColumns = useSettingsStore((state) => state.numColumns);

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
        : [...books].sort((a, b) => a.bookTitle.localeCompare(b.bookTitle));
      return sorted
        .map((book) => book.bookId)
        .filter((bookId) => !!bookId);
    }
    if (authors) {
      return authors
        .flatMap((author) =>
          [...author.books]
            .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle))
            .map((book) => book.bookId),
        )
        .filter((bookId): bookId is string => !!bookId); // Filter out null/undefined and assert type
    }
    return [];
  }, [authors, books, preserveOrder]);

  const renderBookItem = useCallback(
    ({ item: bookId }: { item: string }) => (
      <BookGridItem
        bookId={bookId}
        flowDirection={flowDirection}
        numColumns={numColumns}
        itemWidth={itemWidth}
      />
    ),
    [flowDirection, numColumns, itemWidth],
  );

  return (
    <FlashList
      style={styles.container}
      data={bookIds}
      renderItem={renderBookItem}
      masonry
      numColumns={numColumns}
      keyExtractor={(item) => item}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListFooterComponent={
        standAlone ? <View style={{ height: 82 }} /> : null
      }
      ListEmptyComponent={
        <Text
          style={[
            utilsStyles.emptyComponent,
            { color: themeColors.textMuted },
          ]}
        >
          No books found
        </Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 6,
  },
});

export default memo(BooksGrid);
