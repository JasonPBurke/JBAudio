import { StyleSheet, Text, View } from 'react-native';
import React, { memo, useCallback, useMemo } from 'react';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { utilsStyles } from '@/styles';
import { compareBookTitles } from '@/helpers/miscellaneous';

export type BookHorizontalProps = Partial<FlashListProps<string>> & {
  authors?: Author[];
  books?: Book[];
  flowDirection: 'row' | 'column';
  preserveOrder?: boolean;
};

const BooksHorizontal = ({
  authors,
  books,
  flowDirection,
  preserveOrder,
}: BookHorizontalProps) => {
  // This is the core change. We now create a stable list of book IDs.
  // useMemo ensures this list is only recalculated when the `authors` array changes.
  // Books are sorted by title within each author's collection.
  const bookIds = useMemo(() => {
    if (books) {
      const sorted = preserveOrder
        ? books
        : [...books].sort((a, b) => compareBookTitles(a.bookTitle, b.bookTitle));
      return sorted.map((book) => book.bookId).filter((bookId) => !!bookId);
    }
    if (authors) {
      return authors
        .flatMap((author) =>
          [...author.books]
            .sort((a, b) => compareBookTitles(a.bookTitle, b.bookTitle))
            .map((book) => book.bookId),
        )
        .filter((bookId): bookId is string => !!bookId); // Filter out null/undefined and assert type
    }
    return [];
  }, [authors, books, preserveOrder]);

  const renderBookItem = useCallback(
    ({ item: bookId }: { item: string }) => (
      <BookGridItem bookId={bookId} flowDirection={flowDirection} />
    ),
    [flowDirection],
  );

  return (
    <View style={styles.listContainer}>
      <FlashList
        contentContainerStyle={{
          paddingBottom: 6,
        }}
        scrollEventThrottle={16}
        data={bookIds}
        renderItem={renderBookItem}
        keyExtractor={(item) => item}
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
