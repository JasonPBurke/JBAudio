import { FlashList, FlashListProps } from '@shopify/flash-list';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { utilsStyles } from '@/styles';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';

export type BooksProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
  standAlone?: boolean;
  flowDirection: 'row' | 'column';
  numColumns?: number; // For BookGridItem
  masonry?: boolean;
  horizontal?: boolean;
  ListFooterComponent?: React.ComponentType<any>;
  ItemSeparatorComponent?: React.ComponentType<any>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export const Books = ({
  authors,
  standAlone,
  flowDirection,
  numColumns: propNumColumns = 0, // Default to 0, will be handled by BookGridItem
  masonry = false,
  horizontal = false,
  ListFooterComponent,
  ItemSeparatorComponent,
  contentContainerStyle,
}: BooksProps) => {
  const allBooks = authors
    .flatMap((author) => author.books)
    .sort((a, b) => {
      // Sort by creationDate (descending)
      if (a.metadata.ctime && b.metadata.ctime) {
        if (a.metadata.ctime > b.metadata.ctime) return -1;
        if (a.metadata.ctime < b.metadata.ctime) return 1;
      }

      // Then sort by author first name (ascending)
      const authorA = authors.find((author) =>
        author.books.some((book) => book.bookId === a.bookId)
      );
      const authorB = authors.find((author) =>
        author.books.some((book) => book.bookId === b.bookId)
      );

      if (authorA && authorB) {
        return authorA.name.localeCompare(authorB.name);
      }
      return 0;
    });

  return (
    <View style={horizontal ? styles.listContainer : undefined}>
      <FlashList<Book>
        key={horizontal ? 'horizontal-list' : 'vertical-list'}
        data={allBooks}
        keyExtractor={(item) => item.bookId!}
        renderItem={({ item: book }) => (
          <BookGridItem
            book={book}
            flowDirection={flowDirection}
            numColumns={
              masonry && flowDirection === 'column'
                ? 2
                : propNumColumns === 0
                  ? undefined
                  : propNumColumns
            }
          />
        )}
        ListEmptyComponent={
          <View>
            <Text style={utilsStyles.emptyComponent}>No books found</Text>
          </View>
        }
        masonry={masonry}
        numColumns={
          masonry && flowDirection === 'column'
            ? 2
            : propNumColumns === 0
              ? undefined
              : propNumColumns
        }
        contentContainerStyle={contentContainerStyle}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListFooterComponent={ListFooterComponent}
        {...(horizontal && { horizontal: true })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    height: 200,
  },
});
