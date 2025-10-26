import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { utilsStyles } from '@/styles';

export type BookHorizontalProps = Partial<FlashListProps<Book>> & {
  allBooks: Book[];
};

const BooksHorizontal = ({ allBooks }: BookHorizontalProps) => {
  return (
    <View style={styles.listContainer}>
      <FlashList<Book>
        contentContainerStyle={{ paddingLeft: 14 }}
        data={allBooks}
        renderItem={({ item: book }) => (
          <BookGridItem
            book={book}
            bookId={book.chapters[0].url}
            flowDirection='row'
          />
        )}
        keyExtractor={(item) => item.chapters[0].url}
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
