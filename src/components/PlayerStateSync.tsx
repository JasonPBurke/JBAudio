import { useEffect } from 'react';
import { useActiveTrack, useIsPlaying } from 'react-native-track-player';
import { usePlayerStateStore } from '@/store/playerState';
import { jbaLog } from '@/helpers/debugLog';

/**
 * This component syncs TrackPlayer state to our Zustand store.
 * It should be rendered ONCE at the app root level.
 *
 * By centralizing the TrackPlayer subscriptions here, we avoid having
 * every BookGridItem/BookListItem subscribe directly to TrackPlayer,
 * which was causing cascading re-renders.
 */
export const PlayerStateSync = () => {
  const { playing } = useIsPlaying();
  const activeTrack = useActiveTrack();

  const setIsPlaying = usePlayerStateStore((s) => s.setIsPlaying);
  const setActiveBookId = usePlayerStateStore((s) => s.setActiveBookId);

  useEffect(() => {
    // Y1
    jbaLog('SYNC', 'playing state sync', {
      playing: playing ?? false,
      prevStoreValue: usePlayerStateStore.getState().isPlaying,
    });
    setIsPlaying(playing ?? false);
  }, [playing, setIsPlaying]);

  useEffect(() => {
    // Y2
    jbaLog('SYNC', 'bookId sync', {
      newBookId: activeTrack?.bookId ?? null,
      prevBookId: usePlayerStateStore.getState().activeBookId,
    });
    setActiveBookId(activeTrack?.bookId ?? null);
  }, [activeTrack?.bookId, setActiveBookId]);

  return null; // This is a sync component, renders nothing
};
