import { StyleSheet, Text, View } from 'react-native';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';
import { utilsStyles } from '@/styles';
import { compareBookTitles } from '@/helpers/miscellaneous';

export type BookHorizontalProps = Partial<FlashListProps<string>> & {
  sectionId: string;
  authors?: Author[];
  books?: Book[];
  flowDirection: 'row' | 'column';
  preserveOrder?: boolean;
};

const BooksHorizontal = ({
  sectionId,
  authors,
  books,
  flowDirection,
  preserveOrder,
}: BookHorizontalProps) => {
  const listRef =
    useRef<React.ComponentRef<typeof FlashList<string>>>(null);

  // Reset scroll position to start when recycled for a different section
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [sectionId]);

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
        ref={listRef}
        contentContainerStyle={{
          paddingBottom: 6,
        }}
        scrollEventThrottle={16}
        data={bookIds}
        renderItem={renderBookItem}
        keyExtractor={(item) => item}
        drawDistance={100}
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
