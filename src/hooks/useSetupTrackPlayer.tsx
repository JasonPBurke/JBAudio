import { useEffect, useRef } from 'react';
import TrackPlayer, {
	AndroidAudioContentType,
	RepeatMode,
} from 'react-native-track-player';

const setupPlayer = async () => {
	await TrackPlayer.setupPlayer({
		autoHandleInterruptions: true,
		androidAudioContentType: AndroidAudioContentType.Speech,
		maxCacheSize: 1024 * 10, //* more useful for server access of media
	});

	await TrackPlayer.setVolume(0.5);
	await TrackPlayer.setRepeatMode(RepeatMode.Queue); //* probably want this set to off not queue
};

export const useSetupTrackPlayer = ({ onLoad }: { onLoad?: () => void }) => {
	const isInitialized = useRef(false);

	useEffect(() => {
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
