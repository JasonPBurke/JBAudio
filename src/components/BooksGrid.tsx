import { FlashList, FlashListProps } from '@shopify/flash-list';
import { View, Text } from 'react-native';
import { utilsStyles } from '@/styles';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';

export type BookGridProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
  standAlone?: boolean;
  flowDirection: 'row' | 'column';
};

export const BooksGrid = ({
  authors,
  standAlone,
  flowDirection,
}: BookGridProps) => {
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

  const numColumns = 2;

  return (
    <View>
      <FlashList<Book>
        data={allBooks}
        renderItem={({ item: book }) => (
          <BookGridItem
            book={book}
            flowDirection={flowDirection}
            numColumns={numColumns} //! to calc item width
          />
        )}
        masonry
        numColumns={numColumns}
        keyExtractor={(item) => item.bookId!}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          standAlone ? <View style={{ height: 82 }} /> : null //! will only be standalone
        }
        ListEmptyComponent={
          <View>
            <Text style={utilsStyles.emptyComponent}>No books found</Text>
          </View>
        }
      />
    </View>
  );
};
