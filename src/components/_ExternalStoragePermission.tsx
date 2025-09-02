import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

type Book = {
	id: string;
	title: string;
	author: string;
	audio_url: string;
	thumbnail_url?: string;
};

export const ExternalStoragePermissions = () => {
	// const [localBooks, setLocalBooks] = useState();

	useEffect(() => {
		requestAudioPermission();
		getAudioFiles();
	}, []);

	async function requestAudioPermission() {
		const { status } = await MediaLibrary.requestPermissionsAsync();
		if (status === 'granted') {
			// Permission granted, you can now access audio files
			console.log('Audio access granted!');
		} else {
			// Permission denied
			console.log('Audio access denied.');
		}
	}

	async function getAudioFiles() {
		const { assets } = await MediaLibrary.getAssetsAsync({
			mediaType: MediaLibrary.MediaType.audio,
			first: 100, // Get the first 100 audio files
		});
		// console.log(JSON.stringify(assets, null, 2)); // Array of audio file objects

		//* albumId's for different chapters still match...group by this??
		const audioFiles = assets.filter(
			(file) =>
				//   file.filename.endsWith(".wav") ||
				file.filename.endsWith('.m4b') || file.filename.endsWith('.mp3')
		);

		// console.log(JSON.stringify(audioFiles, null, 2));

		const myBooks = audioFiles.map((book) => {
			return {
				id: book.id,
				title: book.filename,
				author: book.filename,
				audio_url: book.uri,
				thumbnail_url:
					'https://m.media-amazon.com/images/I/71FTb9X6wsL._AC_UF1000,1000_QL80_.jpg',
			};
		});
		console.log(JSON.stringify(myBooks, null, 2));
		// setLocalBooks(myBooks);
		// console.log(localBooks);
	}
};
