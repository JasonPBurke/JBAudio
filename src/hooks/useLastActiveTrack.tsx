import { useEffect, useState } from 'react';
import { useActiveTrack } from 'react-native-track-player';
import type { Track } from '@/player/trackPlayer';

export const useLastActiveTrack = () => {
	const activeTrack = useActiveTrack();
	const [lastActiveTrack, setLastActiveTrack] = useState<Track>();

	useEffect(() => {
		if (!activeTrack) return;

		setLastActiveTrack(activeTrack);
	}, [activeTrack]);

	return lastActiveTrack;
};
