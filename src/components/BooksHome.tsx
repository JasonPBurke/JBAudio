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
import {
  FlashList,
  FlashListProps,
  useMappingHelper,
} from '@shopify/flash-list';

import { ChevronRight } from 'lucide-react-native';
import { memo, useState } from 'react';
import { BooksGrid } from './BooksGrid';
import BooksHorizontal from './BooksHorizontal';
// import { withObservables } from '@nozbe/watermelondb/react';

export type BookListProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
};

const BooksHome = ({ authors }: BookListProps) => {
  const [activeGridSection, setActiveGridSection] = useState<string | null>(
    null
  );

  const allBooks = authors.flatMap((author) => author.books);
  const { getMappingKey } = useMappingHelper();

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
                setActiveGridSection((prev) =>
                  prev === 'recentlyAdded' ? null : 'recentlyAdded'
                );
              }}
            >
              <View style={styles.titleBar}>
                <Text style={styles.titleText}>Recently Added</Text>
                <ChevronRight
                  size={24}
                  color={colors.icon}
                  style={{ marginRight: 12 }}
                />
              </View>
            </Pressable>
            {activeGridSection === 'recentlyAdded' ? (
              <BooksGrid authors={authors} />
            ) : (
              <BooksHorizontal allBooks={allBooks} />
            )}
          </View>

          {/* Authors Sections */}
          {authors.map((author, index) => (
            <View
              key={getMappingKey(author.name, index)}
              style={{ gap: 12 }}
            >
              <Pressable
                style={{ paddingVertical: 6 }}
                android_ripple={{
                  color: '#cccccc28',
                }}
                onPress={() => {
                  setActiveGridSection((prev) =>
                    prev === author.name ? null : author.name
                  );
                }}
              >
                <View style={styles.titleBar}>
                  <Text numberOfLines={1} style={styles.titleText}>
                    {author.name}
                  </Text>
                  <ChevronRight
                    size={24}
                    color={colors.icon}
                    style={{ marginRight: 12 }}
                  />
                </View>
              </Pressable>
              {activeGridSection === author.name ? (
                <BooksGrid authors={[author]} />
              ) : (
                <BooksHorizontal allBooks={author.books} />
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

// const enhance = withObservables(['authors'], ({ authors }) => ({
//   authors,
// }));

export default memo(BooksHome);

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
  containerGap: {
    gap: 12,
  },
});
