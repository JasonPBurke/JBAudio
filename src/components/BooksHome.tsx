import { FlatList, FlatListProps, StyleSheet, Text, View } from 'react-native';
import { BookGridItem } from '@/components/BookGridItem';
import { utilsStyles } from '@/styles';
import { Track } from 'react-native-track-player';
import { colors, fontSize } from '@/constants/tokens';
import { Feather } from '@expo/vector-icons';

export type BookListProps = Partial<FlatListProps<Track>> & {
	books: Track[];
};

export const BooksHome = ({ books, ...flatListProps }: BookListProps) => {
	return (
		<View style={{ paddingLeft: 20, gap: 12 }}>
			<View style={styles.titleBar}>
				<Text style={styles.titleText}>Recents</Text>
				<Feather name='chevron-right' size={24} color={colors.icon} />
			</View>
			<FlatList
				data={books}
				renderItem={({ item: book }) => <BookGridItem book={book} />}
				horizontal={true}
				showsHorizontalScrollIndicator={false}
				ListEmptyComponent={
					<View>
						<Text style={utilsStyles.emptyComponent}>No books found</Text>
					</View>
				}
				{...flatListProps}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	titleBar: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	titleText: {
		fontSize: fontSize.lg,
	},
});
