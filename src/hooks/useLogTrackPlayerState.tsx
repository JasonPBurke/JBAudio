import { Event, useTrackPlayerEvents } from 'react-native-track-player';

const events = [
  Event.PlaybackState,
  Event.PlayerError,
  Event.PlaybackActiveTrackChanged,
  // Event.PlaybackProgressUpdated,
];

export const useLogTrackPlayerState = () => {
  useTrackPlayerEvents(events, async (event) => {
    if (event.type === Event.PlaybackError) {
      console.warn('An error occurred:', event);
    }
    if (event.type === Event.PlaybackState) {
      console.warn('Playback state:', event);
    }
    if (event.type === Event.PlaybackActiveTrackChanged) {
      console.warn(
        'Track changed:',
        JSON.stringify(
          {
            index: event.index,
            lastIndex: event.lastIndex,
            lastPosition: event.lastPosition,
            trackTitle: event.track?.title,
            trackUrl: event.track?.url,
            lastTrackTitle: event.lastTrack?.title,
            lastTrackUrl: event.lastTrack?.url,
            bookId: event.track?.bookId,
          },
          null,
          2
        )
      ); // logging out the image file string
    }
  });
};
