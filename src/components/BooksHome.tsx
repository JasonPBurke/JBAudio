import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BookGridItem } from '@/components/BookGridItem';
import { utilsStyles } from '@/styles';
import { Book, Author } from '@/types/Book';
import { colors, fontSize } from '@/constants/tokens';
import { Feather } from '@expo/vector-icons';
import { FlashList, FlashListProps } from '@shopify/flash-list';

export type BookListProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
};

export const BooksHome = ({ authors }: BookListProps) => {
  const allBooks = authors.flatMap((author) => author.books);

  // const handleBookSelect = async (selectedBook: Book) => {
  //   const chapterIndex = selectedBook.bookProgress.currentChapterIndex;
  //   if (chapterIndex === -1) return;
  // };

  authors.sort((a, b) => {
    const nameA = a.name.toUpperCase();
    const nameB = b.name.toUpperCase();

    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

  // const handleRecentlyAddedPress = (authors: Author[]) => {
  //   console.log('handleRecentlyAddedPress');
  //   return <BooksList authors={authors} />;
  // };

  return (
    //? need to put a loader if allBooks.length === 0
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      {/* Recently Added Section */}
      {allBooks.length > 0 && (
        <View style={{ gap: 12, marginBottom: 82 }}>
          <View style={{ gap: 12 }}>
            <Pressable
              style={{ paddingVertical: 6 }}
              android_ripple={{
                color: '#cccccc28',
              }}
              onPress={() => {
                // handleRecentlyAddedPress(authors);
              }}
            >
              <View style={styles.titleBar}>
                <Text style={styles.titleText}>Recently Added</Text>
                <Feather
                  name='chevron-right'
                  size={24}
                  color={colors.icon}
                  style={{ marginRight: 12 }}
                />
              </View>
            </Pressable>
            <View style={styles.listContainer}>
              <FlashList<Book>
                estimatedItemSize={120}
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
                ItemSeparatorComponent={() => (
                  <View style={{ width: 12 }} />
                )}
                ListFooterComponent={<View style={{ width: 12 }} />}
                ListEmptyComponent={
                  <View>
                    <Text style={utilsStyles.emptyComponent}>
                      No books found
                    </Text>
                  </View>
                }
              />
            </View>
          </View>

          {/* Authors Sections */}
          {authors.map((author) => (
            <View key={author.name} style={{ gap: 12 }}>
              <Pressable
                style={{ paddingVertical: 6 }}
                android_ripple={{
                  color: '#cccccc28',
                }}
                onPress={() => {}}
              >
                <View style={styles.titleBar}>
                  <Text numberOfLines={1} style={styles.titleText}>
                    {author.name}
                  </Text>
                  <Feather
                    name='chevron-right'
                    size={24}
                    color={colors.icon}
                    style={{ marginRight: 12 }}
                  />
                </View>
              </Pressable>
              <View style={styles.listContainer}>
                <FlashList<Book>
                  estimatedItemSize={120}
                  contentContainerStyle={{
                    paddingLeft: 14,
                  }}
                  ItemSeparatorComponent={() => (
                    <View style={{ width: 12 }} />
                  )}
                  data={author.books}
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
                  ListFooterComponent={<View style={{ width: 12 }} />}
                  ListEmptyComponent={
                    <View>
                      <Text style={utilsStyles.emptyComponent}>
                        No books found
                      </Text>
                    </View>
                  }
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 14,
  },
  titleText: {
    fontSize: fontSize.base,
    color: colors.text,
    maxWidth: '95%',
  },
  listContainer: {
    height: 200,
  },
  containerGap: {
    gap: 12,
  },
});
