import { Text, View } from 'react-native';
// import library from '@/assets/data/library.json';
import { BookListItem } from './BookListItem';
import { utilsStyles } from '@/styles';
import { Book, Author } from '@/types/Book';
import { screenPadding } from '@/constants/tokens';
import { FlashList, FlashListProps } from '@shopify/flash-list';
// import TrackPlayer, {
//   Track,
//   useIsPlaying,
// } from 'react-native-track-player';

export type BookListProps = Partial<FlashListProps<Book>> & {
  books: Author[];
};

const ItemDivider = () => (
  <View
    style={{
      ...utilsStyles.itemSeparator,
      marginVertical: 9,
      marginLeft: 60,
    }}
  />
);

export const BooksList = ({ books: authors }: BookListProps) => {
  const allBooks = authors.flatMap((author) => author.books);
  // const { playing } = useIsPlaying();
  // const handleBookSelect = async (track: Track) => {
  // 	//TODO: this is where you will load the book info page instead of
  // 	//TODO: loading the trackPlayer.
  // 	await TrackPlayer.load(track);
  // 	await TrackPlayer.play();
  // };

  return (
    //? need to put a loader if allBooks.length === 0
    <View style={{ paddingHorizontal: screenPadding.horizontal }}>
      {allBooks.length > 0 && (
        <View>
          <FlashList<Book>
            estimatedItemSize={200}
            data={allBooks}
            renderItem={({ item: book }) => <BookListItem book={book} />}
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
