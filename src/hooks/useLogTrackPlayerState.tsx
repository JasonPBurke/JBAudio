import { useEffect } from 'react';
import { Event, subscribe } from '@/player/trackPlayer';

/**
 * Debug logger for Player events. Off by default — its one call site in
 * `app/_layout.tsx` is commented out; uncomment it to watch state, errors and
 * track changes go by.
 *
 * Uses the adapter's `subscribe` rather than the library's `useTrackPlayerEvents`
 * hook: after ticket 09 the only component permitted to hold a Player React
 * subscription is `components/PlayerStateSync`. One subscription per event
 * rather than one handler over a list, because `subscribe` types the payload
 * per event — which is what removes the `event.type` narrowing this used to do
 * by hand.
 */
export const useLogTrackPlayerState = () => {
  useEffect(() => {
    // Event.PlaybackProgressUpdated is deliberately absent: at
    // progressUpdateEventInterval: 1 it would emit a console.warn every second.
    const subscriptions = [
      // Previously this branch tested Event.PlaybackError while the hook was
      // subscribed to Event.PlayerError — two distinct RNTP events, so it
      // never fired. Subscribing per event makes that unrepresentable.
      subscribe(Event.PlayerError, (event) => {
        console.warn('An error occurred:', event);
      }),
      subscribe(Event.PlaybackState, (event) => {
        console.warn('Playback state:', event);
      }),
      subscribe(Event.PlaybackActiveTrackChanged, (event) => {
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
            2,
          ),
        );
      }),
    ];

    return () => subscriptions.forEach((sub) => sub.remove());
  }, []);
};
