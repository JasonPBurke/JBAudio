import { BookListProps, BooksList } from '@/components/BooksList';
import { screenPadding } from '@/constants/tokens';
import { useNavigationSearch } from '@/hooks/useNavigationSearch';
import { defaultStyles, utilsStyles } from '@/styles';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import library from '@/assets/data/library.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bookTitleFilter } from '@/helpers/filter';
import Header from '@/components/Header';
import { BooksHome } from '@/components/BooksHome';
import { Track } from 'react-native-track-player';
import * as MediaLibrary from 'expo-media-library';
// import * as RNFS from '@dr.pogodin/react-native-fs';

const LibraryScreen = () => {
	// const [localBooks, setLocalBooks] = useState<Track[]>(library);

	const search = useNavigationSearch({
		searchBarOptions: {
			placeholder: 'Search in library',
		},
	});

	const filteredBooks = useMemo(() => {
		if (!search) return library;
		return library.filter(bookTitleFilter(search));
	}, [search]);

	// async function getAudioFiles() {
	// 	const { assets } = await MediaLibrary.getAssetsAsync({
	// 		mediaType: MediaLibrary.MediaType.audio,
	// 		first: 200, // Get the first 100 audio files
	// 	});
	// 	// console.log('assets', JSON.stringify(assets, null, 2)); // Array of audio file objects

	// 	//* albumId's for different chapters still match...group by this??
	// 	const audioFiles = assets.filter(
	// 		(file) => file.filename.endsWith('.m4b') || file.filename.endsWith('.mp3')
	// 	);

	// 	// console.log('audioFiles', JSON.stringify(audioFiles, null, 2));

	// 	const myBooks: any = audioFiles.map((book) => {
	// 		return {
	// 			id: book.id,
	// 			title: book.filename,
	// 			author: book.filename,
	// 			audio_url: book.uri,
	// 			thumbnail_url:
	// 				'https://m.media-amazon.com/images/I/71FTb9X6wsL._AC_UF1000,1000_QL80_.jpg',
	// 		};
	// 	});
	// 	// console.log('myBooks', JSON.stringify(myBooks, null, 2));
	// 	setLocalBooks(myBooks);
	// 	// console.log(localBooks);
	// 	// return myBooks;
	// }
	// getAudioFiles();

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
					<BooksHome books={filteredBooks} />
					<View
						style={{
							...utilsStyles.itemSeparator,
							marginVertical: 29,
							marginLeft: 0,
						}}
					/>
					<BooksList books={filteredBooks} scrollEnabled={false} />
				</ScrollView>
			</SafeAreaView>
		</View>
	);
};

export default LibraryScreen;
