import { Text, View } from 'react-native';
import { BookListItem } from './BookListItem';
import { utilsStyles } from '@/styles';
import { Book, Author } from '@/types/Book';
import { screenPadding } from '@/constants/tokens';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { useLibraryStore } from '@/store/library';
import { useEffect, memo } from 'react';
import { useProcessedBooks } from '@/hooks/useProcessedBooks';

export type BookListProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
};

const BooksList = ({ authors }: BookListProps) => {
  const allBooks = useProcessedBooks(authors);
  const setAuthors = useLibraryStore((state) => state.setAuthors);

  useEffect(() => {
    if (authors) {
      setAuthors(authors);
    }
  }, [authors, setAuthors]);

  return (
    //? need to put a loader if allBooks.length === 0
    <View style={{ flex: 1, paddingHorizontal: screenPadding.horizontal }}>
      {allBooks.length > 0 && (
        <View style={{ flex: 1 }}>
          <FlashList<Book>
            data={allBooks}
            renderItem={({ item: book }) => <BookListItem book={book} />}
            keyExtractor={(item) => item.bookId!}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 82 }}
            ListFooterComponent={allBooks.length > 0 ? ItemDivider : null}
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
