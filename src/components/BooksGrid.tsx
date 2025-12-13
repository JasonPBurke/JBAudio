import { FlashList, FlashListProps } from '@shopify/flash-list';
import { useCallback, memo, useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';

import { utilsStyles } from '@/styles';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { useSettingsStore } from '@/store/settingsStore';

export type BookGridProps = Partial<FlashListProps<string>> & {
  authors?: Author[];
  books?: Book[];
  standAlone?: boolean;
  flowDirection: 'row' | 'column';
};

const BooksGrid = ({
  authors,
  books,
  standAlone,
  flowDirection,
}: BookGridProps) => {
  const numColumns = useSettingsStore((state) => state.numColumns);

  const { width: screenWidth } = Dimensions.get('window');
  const ITEM_MARGIN_HORIZONTAL = 10;
  const itemWidth = useMemo(
    () =>
      (screenWidth - ITEM_MARGIN_HORIZONTAL * (numColumns + 1)) /
      numColumns,
    [screenWidth, numColumns]
  );

  // This is the core change. We now create a stable list of book IDs.
  // useMemo ensures this list is only recalculated when the `authors` array changes.
  const bookIds = useMemo(() => {
    if (books) {
      return books.map((book) => book.bookId).filter((bookId) => !!bookId);
    }
    if (authors) {
      return authors
        .flatMap((author) => author.books.map((book) => book.bookId))
        .filter((bookId): bookId is string => !!bookId); // Filter out null/undefined and assert type
    }
    return [];
  }, [authors, books]);

  const renderBookItem = useCallback(
    ({ item: bookId }: { item: string }) => (
      <BookGridItem
        bookId={bookId}
        flowDirection={flowDirection}
        numColumns={numColumns}
        itemWidth={itemWidth}
      />
    ),
    [flowDirection, numColumns, itemWidth]
  );

  return (
    <FlashList
      data={bookIds}
      renderItem={renderBookItem}
      masonry
      numColumns={numColumns}
      keyExtractor={(item) => item}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListFooterComponent={
        standAlone ? <View style={{ height: 82 }} /> : null
      }
      ListEmptyComponent={
        <Text style={utilsStyles.emptyComponent}>No books found</Text>
      }
    />
  );
};

export default memo(BooksGrid);
