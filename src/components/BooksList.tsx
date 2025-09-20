import { FlatList, FlatListProps, Text, View } from 'react-native';
// import library from '@/assets/data/library.json';
import { BookListItem } from './BookListItem';
import { utilsStyles } from '@/styles';
import TrackPlayer, {
  Track,
  useIsPlaying,
} from 'react-native-track-player';
import { screenPadding } from '@/constants/tokens';
import { FlashList } from '@shopify/flash-list';

export type BookListProps = Partial<FlatListProps<any>> & {
  books: Track[];
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

export const BooksList = ({ books, ...flatListProps }: BookListProps) => {
  // const { playing } = useIsPlaying();
  // const handleBookSelect = async (track: Track) => {
  // 	//TODO: this is where you will load the book info page instead of
  // 	//TODO: loading the trackPlayer.
  // 	await TrackPlayer.load(track);
  // 	await TrackPlayer.play();
  // };

  return (
    <FlatList
      style={{ paddingHorizontal: screenPadding.horizontal }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 128 }}
      ListFooterComponent={books.length > 0 ? ItemDivider : null}
      ItemSeparatorComponent={ItemDivider}
      ListEmptyComponent={
        <View>
          <Text style={utilsStyles.emptyComponent}>No books found</Text>
        </View>
      }
      data={books}
      renderItem={({ item: book }) => (
        // <BookListItem book={book} onBookSelect={handleBookSelect} />
        <BookListItem book={book} />
      )}
      {...flatListProps}
    />
  );
};
