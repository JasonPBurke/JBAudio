import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Book, Author } from '@/types/Book';
import { colors, fontSize } from '@/constants/tokens';
import { FlashListProps, useMappingHelper } from '@shopify/flash-list';

import { ChevronRight } from 'lucide-react-native';
import { memo, useState } from 'react';
import { BooksGrid } from './BooksGrid';
import { BooksHorizontal } from './BooksHorizontal';
import { Books } from './Books';
// import { withObservables } from '@nozbe/watermelondb/react';

export type BookListProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
};

const BooksHome = ({ authors }: BookListProps) => {
  const numColumns = 2;
  const [activeGridSection, setActiveGridSection] = useState<string | null>(
    null
  );

  const allBooks = authors.flatMap((author) => author.books);
  const { getMappingKey } = useMappingHelper();

  authors.sort((a, b) => {
    const nameA = a.name.toUpperCase();
    const nameB = b.name.toUpperCase();

    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

  const gridProps = {
    masonry: true,
    ListFooterComponent: () => <View style={{ height: 82 }} />,
    ItemSeparatorComponent: () => <View style={{ height: 12 }} />,
    contentContainerStyle: {},
    numColumns: numColumns,
    flowDirection: 'column' as const,
  };

  const horizontalProps = {
    masonry: false,
    ListFooterComponent: () => <View style={{ width: 12 }} />,
    ItemSeparatorComponent: () => <View style={{ width: 12 }} />,
    contentContainerStyle: { paddingLeft: 14 },
    horizontal: true,
    flowDirection: 'row' as const,
  };

  return (
    //? need to put a loader if allBooks.length === 0
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
                  style={{
                    marginRight: 12,
                    transform:
                      activeGridSection === 'recentlyAdded'
                        ? [{ rotate: '90deg' }]
                        : [],
                  }}
                />
              </View>
            </Pressable>
            {activeGridSection === 'recentlyAdded' ? (
              <BooksGrid authors={authors} flowDirection='column' />
            ) : (
              <BooksHorizontal authors={authors} flowDirection='row' />
            )}
            //! Books was made to attempt animating between vert/horiz...
            {/* <Books
              {...(activeGridSection === 'recentlyAdded'
                ? gridProps
                : horizontalProps)}
              authors={authors}
            /> */}
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
                    style={{
                      marginRight: 12,
                      transform:
                        activeGridSection === author.name
                          ? [{ rotate: '90deg' }]
                          : [],
                    }}
                  />
                </View>
              </Pressable>
              {activeGridSection === author.name ? (
                <BooksGrid authors={[author]} flowDirection='column' />
              ) : (
                <BooksHorizontal authors={[author]} flowDirection='row' />
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
