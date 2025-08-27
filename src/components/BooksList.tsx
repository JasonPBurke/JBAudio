import { FlatList, FlatListProps, View } from 'react-native';
import library from '@/assets/data/library.json';
import { BookListItem } from './BookListItem';
import { utilsStyles } from '@/styles';

export type BookListProps = Partial<FlatListProps<unknown>> & {
	books: any[];
};

const ItemDivider = () => (
	<View
		style={{ ...utilsStyles.itemSeparator, marginVertical: 9, marginLeft: 60 }}
	/>
);

export const BookList = ({ books, ...flatListProps }: BookListProps) => {
	return (
		<FlatList
			data={books}
			contentContainerStyle={{ paddingTop: 64, paddingBottom: 128 }}
			ListFooterComponent={ItemDivider}
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
