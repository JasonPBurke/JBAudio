import { useEffect, useRef, useState } from 'react';
import TrackPlayer, {
	AndroidAudioContentType,
	RepeatMode,
} from 'react-native-track-player';
import * as MediaLibrary from 'expo-media-library';

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

// async function getAudioFiles() {
// 	const { assets } = await MediaLibrary.getAssetsAsync({
// 		mediaType: MediaLibrary.MediaType.audio,
// 		first: 100, // Get the first 100 audio files
// 	});
// 	// console.log('assets', JSON.stringify(assets, null, 2)); // Array of audio file objects

// 	//* albumId's for different chapters still match...group by this??
// 	const audioFiles = assets.filter(
// 		(file) =>
// 			//   file.filename.endsWith(".wav") ||
// 			file.filename.endsWith('.m4b') || file.filename.endsWith('.mp3')
// 	);

// 	// console.log('audioFiles', JSON.stringify(audioFiles, null, 2));

// 	const myBooks = audioFiles.map((book) => {
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
// 	// setLocalBooks(myBooks);
// 	// console.log(localBooks);
// 	return myBooks;
// }

const setupPlayer = async () => {
	await TrackPlayer.setupPlayer({
		autoHandleInterruptions: true,
		androidAudioContentType: AndroidAudioContentType.Speech,
		maxCacheSize: 1024 * 10, //* more useful for server access of media
	});

	// await TrackPlayer.setVolume(0.5);
	await TrackPlayer.setRepeatMode(RepeatMode.Queue); //* probably want this set to off not queue
};

export const useSetupTrackPlayer = ({ onLoad }: { onLoad?: () => void }) => {
	const isInitialized = useRef(false);

	useEffect(() => {
		requestAudioPermission();
		// getAudioFiles();
		setupPlayer()
			.then(() => {
				isInitialized.current = true;
				onLoad?.();
			})
			.catch((error) => {
				isInitialized.current = false;
				console.error(error);
			});
	}, [onLoad]);
};
