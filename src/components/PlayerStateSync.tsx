import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  isPlaying,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { usePlayerStateStore } from '@/store/playerState';

// Temporary — remove with the [flood] diagnostics in src/setup/service.js.
const FLOOD_DIAG = true;

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
    if (FLOOD_DIAG) {
      console.log(`[flood] playing=${playing} t=${Date.now()}`);
    }
    setIsPlaying(playing ?? false);
  }, [playing, setIsPlaying]);

  useEffect(() => {
    setActiveBookId(activeTrack?.bookId ?? null);
  }, [activeTrack?.bookId, setActiveBookId]);

  // useIsPlaying() is purely event-derived, so after extended background the
  // store mirrors whatever the last delivered event said until the backlog
  // drains. On foreground, fetch the authoritative state directly so store
  // consumers are correct immediately.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      isPlaying()
        .then(({ playing: fresh }) => {
          if (FLOOD_DIAG) {
            console.log(
              `[flood] foreground refresh playing=${fresh} t=${Date.now()}`,
            );
          }
          if (fresh !== undefined) {
            setIsPlaying(fresh);
          }
        })
        .catch(() => {
          // Non-critical — the event-derived sync above will catch up.
        });
    });
    return () => sub.remove();
  }, [setIsPlaying]);

  return null; // This is a sync component, renders nothing
};
