import TrackPlayer, { Event } from 'react-native-track-player';

// const { default: TrackPlayer } = require('react-native-track-player');

export default module.exports = async function () {
	TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
	TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
	TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
	TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
		TrackPlayer.seekTo(position);
	});
	TrackPlayer.addEventListener(Event.RemoteJumpForward, () => {
		TrackPlayer.seekBy(30);
	});
	TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => {
		TrackPlayer.seekBy(-30);
	});
	TrackPlayer.addEventListener(Event.RemoteNext, () =>
		TrackPlayer.skipToNext()
	);
	TrackPlayer.addEventListener(Event.RemotePrevious, () =>
		TrackPlayer.skipToPrevious()
	);
	// Add other remote event listeners as needed (e.g., RemoteStop, RemoteSeek)
};
