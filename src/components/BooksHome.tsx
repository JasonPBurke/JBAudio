import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookGridItem } from '@/components/BookGridItem';
import { utilsStyles } from '@/styles';
import { Book, Author } from '@/types/Book';
import { colors, fontSize } from '@/constants/tokens';
import { Feather } from '@expo/vector-icons';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { BooksList } from '@/components/BooksList';
import { useState } from 'react';
// import { Track } from 'react-native-track-player';

export type BookListProps = Partial<FlashListProps<Book>> & {
  books: Author[];
};

export const BooksHome = ({ books: authors }: BookListProps) => {
  const allBooks = authors.flatMap((author) => author.books);

  authors.sort((a, b) => {
    const nameA = a.authorName.toUpperCase();
    const nameB = b.authorName.toUpperCase();

    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

  // const handleRecentlyAddedPress = (authors: Author[]) => {
  //   <BooksList books={authors} />;
  // };

  return (
    //? need to put a loader if allBooks.length === 0
    <View>
      {/* Recently Added Section */}
      {allBooks.length > 0 && (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 12 }}>
            <Pressable
              style={{ paddingVertical: 6 }}
              android_ripple={{
                color: '#cccccc28',
              }}
              onPress={() => {}}
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
                  <BookGridItem book={book} />
                )}
                keyExtractor={(item) => item.chapters[0].url}
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                ListFooterComponent={<View style={{ width: 14 }} />}
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
            <View key={author.authorName} style={{ gap: 12 }}>
              <Pressable
                style={{ paddingVertical: 6 }}
                android_ripple={{
                  color: '#cccccc28',
                }}
                onPress={() => {}}
              >
                <View style={styles.titleBar}>
                  <Text numberOfLines={1} style={styles.titleText}>
                    {author.authorName}
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
                  contentContainerStyle={{ paddingLeft: 14 }}
                  data={author.books}
                  renderItem={({ item: book }) => (
                    <BookGridItem book={book} />
                  )}
                  keyExtractor={(item) => item.bookTitle}
                  horizontal={true}
                  showsHorizontalScrollIndicator={false}
                  ListFooterComponent={<View style={{ width: 14 }} />}
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
    </View>
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
});
