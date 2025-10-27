import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { utilsStyles } from '@/styles';

export type BookHorizontalProps = Partial<FlashListProps<Book>> & {
  allBooks: Book[];
  authors: Author[];
};

const BooksHorizontal = ({ authors }: BookHorizontalProps) => {
  const allBooks = authors
    .flatMap((author) => author.books)
    .sort((a, b) => {
      // Sort by creationDate (descending)
      if (a.metadata.ctime && b.metadata.ctime) {
        if (a.metadata.ctime > b.metadata.ctime) return -1;
        if (a.metadata.ctime < b.metadata.ctime) return 1;
      }

      // Then sort by author first name (ascending)
      const authorA = authors.find((author) =>
        author.books.some((book) => book.bookId === a.bookId)
      );
      const authorB = authors.find((author) =>
        author.books.some((book) => book.bookId === b.bookId)
      );

      if (authorA && authorB) {
        return authorA.name.localeCompare(authorB.name);
      }
      return 0;
    });

  return (
    <View style={styles.listContainer}>
      <FlashList<Book>
        contentContainerStyle={{ paddingLeft: 14 }}
        data={allBooks}
        renderItem={({ item: book }) => (
          <BookGridItem
            book={book}
            bookId={book.bookId!}
            flowDirection='row'
          />
        )}
        keyExtractor={(item) => item.bookId!}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        ListFooterComponent={<View style={{ width: 12 }} />}
        ListEmptyComponent={
          <View>
            <Text style={utilsStyles.emptyComponent}>No books found</Text>
          </View>
        }
      />
    </View>
  );
};

export default BooksHorizontal;

const styles = StyleSheet.create({
  listContainer: {
    height: 200,
  },
});
