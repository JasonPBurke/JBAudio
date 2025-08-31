import { BooksList } from '@/components/BooksList';
import { screenPadding } from '@/constants/tokens';
import { useNavigationSearch } from '@/hooks/useNavigationSearch';
import { defaultStyles } from '@/styles';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import library from '@/assets/data/library.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookTitleFilter } from '@/helpers/filter';
import Header from '@/components/Header';
import { BooksHome } from '@/components/BooksHome';

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
				// style={
				// 	{
				// 		paddingHorizontal: screenPadding.horizontal,
				// 	}
				// }
				>
					{/* MOVE HEADER ABOVE SCROLL VIEW TO DOCK IT AT TOP OF SCREEN */}
					<Header />
					{/* SWITCH LIBRARY VIEW HERE FROM HOME TO LIST BASED ON <Header> BUTTON CLICK */}
					{/* <BooksList books={filteredBooks} scrollEnabled={false} /> */}
					<BooksHome books={filteredBooks} />
					<BooksHome books={filteredBooks} />
					<BooksHome books={filteredBooks} />
					<BooksHome books={filteredBooks} />
				</ScrollView>
			</SafeAreaView>
		</View>
	);
};

export default LibraryScreen;
