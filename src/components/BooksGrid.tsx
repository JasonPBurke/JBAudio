import { FlashList, FlashListProps } from '@shopify/flash-list';
import { View, Text } from 'react-native';
import { utilsStyles } from '@/styles';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';

export type BookGridProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
  // allBooks: Book[];
};

export const BooksGrid = ({ authors }: BookGridProps) => {
  const allBooks = authors.flatMap((author) => author.books);
  // console.log('allBooks in grid', allBooks.length);
  const numColumns = 3;

  return (
    <View>
      <FlashList<Book>
        data={allBooks}
        renderItem={({ item: book }) => (
          <BookGridItem
            book={book}
            bookId={book.chapters[0].url}
            flowDirection='column'
            numColumns={numColumns}
          />
        )}
        masonry
        numColumns={numColumns}
        keyExtractor={(item) => item.chapters[0].url}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={<View style={{ height: 82 }} />}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        ListEmptyComponent={
          <View>
            <Text style={utilsStyles.emptyComponent}>No books found</Text>
          </View>
        }
      />
    </View>
  );
};
