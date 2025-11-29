import { FlashList, FlashListProps } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useState, useCallback, memo } from 'react';
import { View, Text } from 'react-native';

import { utilsStyles } from '@/styles';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { getNumColumns } from '@/db/settingsQueries';
import { useProcessedBooks } from '@/hooks/useProcessedBooks';

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
  const [numColumns, setNumColumns] = useState(2);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchNumColumns = async () => {
        try {
          const value = await getNumColumns();
          if (isActive && value) {
            setNumColumns(value);
          }
        } catch (error) {
          console.error('Failed to fetch number of columns:', error);
          // Optionally set a default or handle the error in the UI
        }
      };

      fetchNumColumns();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const allBooks = useProcessedBooks(authors);

  const renderBookItem = useCallback(
    ({ item: book }: { item: Book }) => (
      <BookGridItem
        book={book}
        flowDirection={flowDirection}
        numColumns={numColumns}
      />
    ),
    [flowDirection, numColumns]
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
