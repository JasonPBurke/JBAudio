import {
  MasonryFlashList,
  MasonryFlashListProps,
} from '@shopify/flash-list';
import { View, Text } from 'react-native';
import { utilsStyles } from '@/styles';
import { Author, Book } from '@/types/Book';
import { BookGridItem } from './BookGridItem';

export type BookGridProps = Partial<MasonryFlashListProps<Book>> & {
  authors: Author[];
};

const BooksGrid = ({ authors }: BookGridProps) => {
  const allBooks = authors.flatMap((author) => author.books);

  return (
    <View>
      <MasonryFlashList
        data={allBooks}
        renderItem={({ item: book }) => (
          <BookGridItem book={book} bookId={book.chapters[0].url} />
        )}
        estimatedItemSize={250}
        numColumns={3}
        keyExtractor={(item) => item.chapters[0].url}
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

export default BooksGrid;
