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

  // const handleBookSelect = async (selectedBook: Book) => {
  //   const chapterIndex = selectedBook.bookProgress.currentChapterIndex;
  //   if (chapterIndex === -1) return;
  // };

  const viewableItems = useSharedValue<ViewToken[]>([]);

  // console.log('book.bookId', book.bookId)

  return (
    //? need to put a loader if allBooks.length === 0
    <View style={{ flex: 1, paddingHorizontal: screenPadding.horizontal }}>
      {allBooks.length > 0 && (
        <View style={{ flex: 1 }}>
          <FlashList<Book>
            estimatedItemSize={200}
            data={allBooks}
            //! onViewableItemsChanged is a reanimated function to animate the list
            // onViewableItemsChanged={({ viewableItems: vItems }) => {
            //   viewableItems.value = vItems;
            // }}
            renderItem={({ item: book }) => (
              // console.log('book.bookId', book.bookId), //undefined
              <BookListItem
                viewableItems={viewableItems}
                book={book}
                bookId={book.chapters[0].url}
              />
            )}
            keyExtractor={(item) =>
              // console.log('item.chapters[0].url', item.chapters[0].url),
              item.chapters[0].url
            }
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
