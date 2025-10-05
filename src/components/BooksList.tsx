import { Text, View, ViewToken } from 'react-native';
import { BookListItem } from './BookListItem';
import { utilsStyles } from '@/styles';
import { Book, Author } from '@/types/Book';
import { screenPadding } from '@/constants/tokens';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { useSharedValue } from 'react-native-reanimated';

const ItemDivider = () => (
  <View
    style={{
      ...utilsStyles.itemSeparator,
      marginVertical: 9,
      marginLeft: 75,
    }}
  />
);

export type BookListProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
};

export const BooksList = ({ authors }: BookListProps) => {
  const allBooks = authors.flatMap((author) => author.books);

  const handleBookSelect = async (selectedBook: Book) => {
    const chapterIndex = selectedBook.bookProgress.currentChapterIndex;
    if (chapterIndex === -1) return;
  };

  const viewableItems = useSharedValue<ViewToken[]>([]);

  return (
    //? need to put a loader if allBooks.length === 0
    <View style={{ paddingHorizontal: screenPadding.horizontal }}>
      {allBooks.length > 0 && (
        <View>
          <FlashList<Book>
            estimatedItemSize={120}
            data={allBooks}
            //! onViewableItemsChanged is a reanimated function to animate the list
            // onViewableItemsChanged={({ viewableItems: vItems }) => {
            //   viewableItems.value = vItems;
            // }}
            renderItem={({ item: book }) => (
              <BookListItem
                viewableItems={viewableItems}
                book={book}
                bookId={book.chapters[0].url}
              />
            )}
            keyExtractor={(item) => item.chapters[0].url}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 128 }}
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
