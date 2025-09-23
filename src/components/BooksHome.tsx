import {
  FlatList,
  FlatListProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BookGridItem } from '@/components/BookGridItem';
import { utilsStyles } from '@/styles';
import { Track } from 'react-native-track-player';
import { colors, fontSize } from '@/constants/tokens';
import { Feather } from '@expo/vector-icons';
import { FlashList, FlashListProps } from '@shopify/flash-list';

export type BookListProps = Partial<FlashListProps<Track>> & {
  books: Track[];
};

export const BooksHome = ({ books, ...flatListProps }: BookListProps) => {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.titleBar}>
        <Text style={styles.titleText}>Recents</Text>
        <Feather
          name='chevron-right'
          size={24}
          color={colors.icon}
          style={{ marginRight: 12 }}
        />
      </View>
      {/* <View style={{}}> */}
      <FlashList<Track>
        style={{ paddingLeft: 14, height: 200 }} //! try and set height based on bookGridItem image height
        data={books}
        renderItem={({ item: book }) => <BookGridItem book={book} />}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        ListFooterComponent={<View style={{ width: 14 }} />}
        ListEmptyComponent={
          <View>
            <Text style={utilsStyles.emptyComponent}>No books found</Text>
          </View>
        }
        {...flatListProps}
      />
      {/* </View> */}
    </View>
  );
};

const styles = StyleSheet.create({
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 14,
  },
  titleText: {
    fontSize: fontSize.lg,
    color: colors.text,
  },
});
