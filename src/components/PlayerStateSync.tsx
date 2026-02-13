import { useEffect } from 'react';
import { useActiveTrack, useIsPlaying } from 'react-native-track-player';
import { usePlayerStateStore } from '@/store/playerState';

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
    setIsPlaying(playing ?? false);
  }, [playing, setIsPlaying]);

  useEffect(() => {
    setActiveBookId(activeTrack?.bookId ?? null);
  }, [activeTrack?.bookId, setActiveBookId]);

  return null; // This is a sync component, renders nothing
};
