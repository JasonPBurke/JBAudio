import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  isPlaying,
  useActiveTrackBookId,
  useIsPlaying,
} from '@/player/trackPlayer';
import { usePlayerStateStore } from '@/store/playerState';

/**
 * This component syncs TrackPlayer state to our Zustand store.
 *
 * ⚠ IT IS THE ONLY CALLER OF THE PLAYER LIBRARY'S REACT HOOKS, and the only
 * writer of `store/playerState`. Every other file reads a selector. Counted at
 * `1a04fd7`: eleven `useActiveTrack()` subscriptions across twelve files, all
 * for one field, `?.bookId`; ten of the eleven are gone and this is the
 * survivor. A second one anywhere re-creates the shape.
 *
 * ⚠ NOTHING MECHANICAL ENFORCES THAT ANY MORE, and the change is worth
 * knowing about. Ticket 08's eslint rule was an allow list whose permitted
 * names were the migration tracker, and while it stood, adding a twelfth
 * subscription meant importing a name the list happened to permit. Ticket 10
 * emptied it: the rule now says "nobody outside `player/` imports the
 * library", which this file satisfies by taking the same two hooks off the
 * adapter instead. They are ordinary exports of an ordinary module, so a
 * second caller would lint clean. It would also LOOK clean on screen — a
 * duplicated subscription renders correctly and merely costs renders — which
 * is why the rule is restated here and in the adapter's own hooks section.
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
  const activeBookId = useActiveTrackBookId();

  const setIsPlaying = usePlayerStateStore((s) => s.setIsPlaying);
  const setActiveBookId = usePlayerStateStore((s) => s.setActiveBookId);

  useEffect(() => {
    setIsPlaying(playing ?? false);
  }, [playing, setIsPlaying]);

  // The narrowing that used to live here moved into the adapter with the
  // import, and `useActiveTrackBookId` is where to read about it: RNTP's
  // `Track` carries an `[key: string]: any` index signature, so `.bookid` and
  // `.bookID` compile and read `undefined`, and this one line is the app's
  // single answer to which Book is playing. The hook returns `string | null`
  // already checked, so the `null` below is the adapter's answer rather than a
  // guess made here. Render count is unchanged: RNTP's `useActiveTrack` still
  // runs, one layer down, and still re-renders this component on every track
  // event — the collapse ticket 09 bought is that it re-renders THIS component
  // only.
  useEffect(() => {
    setActiveBookId(activeBookId);
  }, [activeBookId, setActiveBookId]);

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
