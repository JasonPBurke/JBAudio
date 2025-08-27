import { BookList } from '@/components/BooksList';
import { screenPadding } from '@/constants/tokens';
import { useNavigationSearch } from '@/hooks/useNavigationSearch';
import { defaultStyles } from '@/styles';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import library from '@/assets/data/library.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookTitleFilter } from '@/helpers/filter';

const LibraryScreen = () => {
	const search = useNavigationSearch({
		searchBarOptions: {
			placeholder: 'Search in library',
		},
	});

	const filteredBooks = useMemo(() => {
		if (!search) return library;
		return library.filter(bookTitleFilter(search));
	}, [search]);

	return (
		<View style={defaultStyles.container}>
			<SafeAreaView style={{ flex: 1 }}>
				<ScrollView
					style={{
						paddingHorizontal: screenPadding.horizontal,
					}}
				>
					<BookList books={filteredBooks} scrollEnabled={false} />
				</ScrollView>
			</SafeAreaView>
		</View>
	);
};

export default LibraryScreen;
