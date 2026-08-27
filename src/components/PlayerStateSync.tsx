import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  isPlaying,
  useActiveTrack,
  useIsPlaying,
} from 'react-native-track-player';
import { usePlayerStateStore } from '@/store/playerState';

/**
 * This component syncs TrackPlayer state to our Zustand store.
 *
 * ⚠ IT IS THE ONLY CALLER OF THE PLAYER LIBRARY'S REACT HOOKS, and the only
 * writer of `store/playerState`. Every other file reads a selector. Counted at
 * `1a04fd7`: eleven `useActiveTrack()` subscriptions across twelve files, all
 * for one field, `?.bookId`; ten of the eleven are gone and this is the
 * survivor. A second one anywhere re-creates the shape. `eslint.config.js`
 * still permits the three names
 * imported below ANYWHERE under `src/` — it is an allow list, not a per-file
 * exemption — so nothing mechanical stops that; ticket 10 closes the hole by
 * emptying the list, at which point this file is the ban's last exception.
 *
 * ⚠ IT MUST STAY MOUNTED AT THE ROOT (`app/_layout.tsx`, above the router).
 * The store's selectors are only correct while it is. See the mount invariant
 * in `store/playerState.ts` — that header is the long version.
 *
 * The sticky last-Active-Book field is derived by the store's own
 * `setActiveBookId` rather than written separately here, so that the "does not
 * clear on null" rule has exactly one place that can get it wrong.
 */
export const PlayerStateSync = () => {
  const { playing } = useIsPlaying();
  const activeTrack = useActiveTrack();

  const setIsPlaying = usePlayerStateStore((s) => s.setIsPlaying);
  const setActiveBookId = usePlayerStateStore((s) => s.setActiveBookId);

  useEffect(() => {
    setIsPlaying(playing ?? false);
  }, [playing, setIsPlaying]);

  // ⚠ THE LAST UNCHECKED READ OF `Track.bookId` IN THE APP, and the narrowing
  // is not decoration. RNTP declares `Track` with an `[key: string]: any` index
  // signature, so `.bookId`, `.bookid` and `.bookID` all compile and two of
  // them yield `undefined`. The adapter narrows the imperative half of this
  // same read the same way (`getActiveBookId`, `player/trackPlayer.ts:97-99`);
  // before ticket 09 a slip here cost one component, and now it would null the
  // Active Book for every consumer of the mirror, with no error and no type
  // change.
  useEffect(() => {
    const bookId = activeTrack?.bookId;
    setActiveBookId(typeof bookId === 'string' ? bookId : null);
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
