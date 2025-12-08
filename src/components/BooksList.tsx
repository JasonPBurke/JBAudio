import { Text, View } from 'react-native';
import { BookListItem } from './BookListItem';
import { utilsStyles } from '@/styles';
import { Author } from '@/types/Book';
import { screenPadding } from '@/constants/tokens';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { memo, useCallback, useMemo } from 'react';

export type BookListProps = Partial<FlashListProps<string>> & {
  authors: Author[];
};

const BooksList = ({ authors }: BookListProps) => {
  const bookIds = useMemo(() => {
    return authors
      .flatMap((author) => author.books.map((book) => book.bookId))
      .filter((bookId): bookId is string => !!bookId); // Filter out null/undefined and assert type
  }, [authors]);

  const renderBookItem = useCallback(
    ({ item: bookId }: { item: string }) => (
      <BookListItem bookId={bookId} />
    ),
    []
  );

  return (
    //? need to put a loader if allBooks.length === 0
    <View style={{ flex: 1, paddingHorizontal: screenPadding.horizontal }}>
      {bookIds.length > 0 && (
        <View style={{ flex: 1 }}>
          <FlashList
            data={bookIds}
            renderItem={renderBookItem}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 82 }}
            ListFooterComponent={bookIds.length > 0 ? ItemDivider : null}
            ItemSeparatorComponent={ItemDivider}
            ListEmptyComponent={
              <View>
                <Text style={utilsStyles.emptyComponent}>
                  No books found
                </Text>
              </View>
            }
          />
        </View>
      )}
    </View>
  );
};

const ItemDivider = () => (
  <View
    style={{
      ...utilsStyles.itemSeparator,
      marginVertical: 9,
      marginLeft: 75,
    }}
  />
);

export default memo(BooksList);
