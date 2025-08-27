import { FlatList, FlatListProps, View } from 'react-native';
import library from '@/assets/data/library.json';
import { BookListItem } from './BookListItem';
import { utilsStyles } from '@/styles';

export type BookListProps = Partial<FlatListProps<unknown>>;

const ItemDivider = () => (
	<View
		style={{ ...utilsStyles.itemSeparator, marginVertical: 9, marginLeft: 60 }}
	/>
);

export const BookList = ({ ...flatListProps }: BookListProps) => {
	return (
		<FlatList
			data={library}
			ItemSeparatorComponent={ItemDivider}
			renderItem={({ item: book }) => (
				<BookListItem
					book={{
						...book,
						image: book.artwork,
					}}
				/>
			)}
			{...flatListProps}
		/>
	);
};
