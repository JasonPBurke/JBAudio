import { FlashList, FlashListProps } from '@shopify/flash-list';
import { useCallback, memo, useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';

import { utilsStyles } from '@/styles';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { useProcessedBooks } from '@/hooks/useProcessedBooks';
import { useSettingsStore } from '@/store/settingsStore';

export type BookGridProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
  standAlone?: boolean;
  flowDirection: 'row' | 'column';
};

const BooksGrid = ({
  authors,
  standAlone,
  flowDirection,
}: BookGridProps) => {
  const numColumns = useSettingsStore((state) => state.numColumns);
  const allBooks = useProcessedBooks(authors);

  const { width: screenWidth } = Dimensions.get('window');
  const ITEM_MARGIN_HORIZONTAL = 10;
  const itemWidth = useMemo(
    () =>
      (screenWidth - ITEM_MARGIN_HORIZONTAL * (numColumns + 1)) /
      numColumns,
    [screenWidth, numColumns]
  );

  const renderBookItem = useCallback(
    ({ item: book }: { item: Book }) => (
      <BookGridItem
        book={book}
        flowDirection={flowDirection}
        numColumns={numColumns}
        itemWidth={itemWidth}
      />
    ),
    [flowDirection, numColumns, itemWidth]
  );

  return (
    <FlashList<Book>
      data={allBooks}
      renderItem={renderBookItem}
      masonry
      numColumns={numColumns}
      keyExtractor={(item) => item.bookId!}
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
