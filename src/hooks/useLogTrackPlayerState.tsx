import {
  Event,
  State,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { jbaLog } from '@/helpers/debugLog';

const stateNames: Record<number, string> = {
  [State.None]: 'None',
  [State.Ready]: 'Ready',
  [State.Playing]: 'Playing',
  [State.Paused]: 'Paused',
  [State.Stopped]: 'Stopped',
  [State.Buffering]: 'Buffering',
  [State.Loading]: 'Loading',
  [State.Error]: 'Error',
  [State.Ended]: 'Ended',
  [State.Connecting]: 'Connecting',
};

const events = [
  Event.PlaybackState,
  Event.PlayerError,
  Event.PlaybackActiveTrackChanged,
];

export const useLogTrackPlayerState = () => {
  useTrackPlayerEvents(events, async (event) => {
    if (event.type === Event.PlaybackError) {
      jbaLog('HOOK', 'PlayerError (UI-side)', {
        message: (event as any).message,
        code: (event as any).code,
      });
    }
    if (event.type === Event.PlaybackState) {
      jbaLog('HOOK', 'PlaybackState (UI-side)', {
        state: stateNames[(event as any).state] ?? (event as any).state,
      });
    }
    if (event.type === Event.PlaybackActiveTrackChanged) {
      jbaLog('HOOK', 'ActiveTrackChanged (UI-side)', {
        index: (event as any).index,
        lastIndex: (event as any).lastIndex,
        trackTitle: (event as any).track?.title,
        bookId: (event as any).track?.bookId,
      });
    }
  });
};
