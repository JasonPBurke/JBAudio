import { StyleSheet, Text, View } from 'react-native';
import React, { memo } from 'react';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { utilsStyles } from '@/styles';
import { useProcessedBooks } from '@/hooks/useProcessedBooks';

export type BookHorizontalProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
  flowDirection: 'row' | 'column';
};

const BooksHorizontal = ({
  authors,
  flowDirection,
}: BookHorizontalProps) => {
  const allBooks = useProcessedBooks(authors);

  return (
    <View style={styles.listContainer}>
      <FlashList<Book>
        contentContainerStyle={{
          paddingBottom: 6,
        }}
        data={allBooks}
        renderItem={({ item: book }) => (
          <BookGridItem book={book} flowDirection={flowDirection} />
        )}
        keyExtractor={(item) => item.bookId!}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        ListEmptyComponent={
          <View>
            <Text style={utilsStyles.emptyComponent}>No books found</Text>
          </View>
        }
      />
    </View>
  );
};

export default memo(BooksHorizontal);

const styles = StyleSheet.create({
  listContainer: {
    height: 220,
  },
});
