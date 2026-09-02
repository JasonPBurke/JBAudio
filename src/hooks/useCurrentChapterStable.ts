import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  Event,
  getActiveTrackIndex,
  getProgress,
  subscribe,
} from '@/player/trackPlayer';
import { useBookById, useLibraryStore } from '@/store/library';
import { useAppStateStore } from '@/store/appState';
import { useActiveBookId } from '@/store/playerState';
import { Chapter } from '@/types/Book';
import {
  chapterStartInQueueSeconds,
  locateInBook,
} from '@/helpers/bookLocation';

/**
 * Where the player screen thinks the playhead is: which Chapter, and where
 * that Chapter STARTS in the coordinates the Player reports.
 *
 * ⚠ `chapterStartSeconds` IS IN QUEUE COORDINATES, not Book ones — it is what
 * has to be subtracted from a raw Position to get a Chapter Position, which
 * is `0` on a multi-item Queue (where the Position already is one) and the
 * Chapter's absolute `startMs` on a one-item Queue. Handing the screen that
 * one number is what let the progress bar stop asking which shape it is
 * looking at: see `PlayerProgressBar`, whose animation worklet subtracts it
 * every frame and must never call the translator itself.
 */
export type CurrentChapterLocation = {
  chapter: Chapter;
  chapterStartSeconds: number;
};

/**
 * Context for sharing a single useCurrentChapterStable subscription across
 * multiple consumers (PlayerChaptersModal, PlayerProgressBar). Without this,
 * each consumer would register its own TrackPlayer event listeners and fire
 * its own getProgress() on mount — multiplying the bridge work during the
 * player slide-in.
 *
 * Value of `null` means "no provider above" — consumers should treat that as
 * an error path or fall back to calling the hook directly.
 */
export const CurrentChapterContext = createContext<
  CurrentChapterLocation | undefined | null
>(null);

/**
 * ⚠ THE CHAPTER AND ITS START ARE ONE VALUE, never two nullable fields. They
 * are known together or not at all, and a pair of independently-optional
 * fields would let a caller read a start of `0` for a chapter that was never
 * resolved — the fabricated zero ADR 0004 ruling 3 exists to refuse.
 * `undefined` here is "no Chapter"; `null` is the context's own "no provider
 * above".
 */
export const useCurrentChapterLocation = ():
  | CurrentChapterLocation
  | undefined => {
  const value = useContext(CurrentChapterContext);
  if (value === null) {
    throw new Error(
      'useCurrentChapter must be used inside a CurrentChapterContext.Provider',
    );
  }
  return value;
};

export const useCurrentChapter = (): Chapter | undefined =>
  useCurrentChapterLocation()?.chapter;

/**
 * Returns the current chapter, re-rendering only when it actually changes.
 *
 * ⚠ ONE PATH FOR BOTH QUEUE SHAPES. This hook used to run two: a chapter-queue
 * mode that read the index out of the store and ignored the position, and a
 * legacy single-file mode that derived the chapter from the position and
 * ignored the index — with `queueShapeOf` choosing between them and each mode
 * keeping its own effect, its own state and its own idea of what a Position
 * meant. `locateInBook` takes BOTH numbers and answers for either shape, so
 * there is one subscription and one piece of state. See
 * `docs/adr/0004-queue-shape-answers-in-coordinates.md`.
 *
 * Where the two numbers come from:
 * - the Queue index from the library store's `playbackIndex`, which
 *   `service.ts` keeps current via PlaybackActiveTrackChanged; on mount,
 *   before the store has an entry, `getActiveTrackIndex()` fills the gap. It
 *   is ignored on a one-item Queue, where it can only ever be 0;
 * - the Position from progress and seek events.
 *
 * Never match chapters by URL — clipped queue items all share one URL.
 */
type ChapterPlacement = { index: number; startSeconds: number };

export const useCurrentChapterStable = ():
  | CurrentChapterLocation
  | undefined => {
  const bookId = useActiveBookId() ?? '';
  const book = useBookById(bookId);
  const chapters = book?.chapters;

  const storeIndex = useLibraryStore(
    useCallback(
      (state) => (bookId ? state.playbackIndex[bookId] : undefined),
      [bookId],
    ),
  );

  // Mount fallback for a cold store (e.g. right after app start, before the
  // service has processed its first track-changed event).
  const [queueIndexFallback, setQueueIndexFallback] = useState<
    number | undefined
  >(undefined);

  // ⚠ THE ONLY PLAYER READ THAT IS NOT PART OF A DECISION. It fires only when
  // the store has no index yet, and its answer is stored rather than combined
  // with a position — the steady-state index comes from the store, so the
  // hook makes no per-tick index read at all.
  useEffect(() => {
    if (typeof storeIndex === 'number') return;

    let mounted = true;
    getActiveTrackIndex()
      .then((index) => {
        if (mounted && typeof index === 'number') {
          setQueueIndexFallback(index);
        }
      })
      .catch(() => {
        // Player might not be initialized yet
      });
    return () => {
      mounted = false;
    };
  }, [storeIndex, bookId]);

  const queueIndex =
    typeof storeIndex === 'number' ? storeIndex : queueIndexFallback;

  const [placement, setPlacement] = useState<ChapterPlacement | undefined>(
    undefined,
  );
  const placementRef = useRef<ChapterPlacement | undefined>(undefined);

  /**
   * The live effect's `updateFromProgress`, reachable from the resume
   * subscription below. Held in a ref so the foreground flag never enters the
   * main effect's deps — it would tear down and re-register all three player
   * subscriptions on every background transition.
   */
  const refreshRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!chapters?.length) {
      placementRef.current = undefined;
      refreshRef.current = undefined;
      setPlacement(undefined);
      return;
    }

    const applyPosition = (position: number) => {
      // Dormant while backgrounded — no chapter re-derivation / re-render for
      // an invisible screen.
      //
      // ⚠ THIS GATE NOW COVERS BOTH SHAPES. A chapter Queue used to read its
      // index straight out of the store in a `useMemo`, so it updated while
      // backgrounded and updated synchronously. It now waits for a position,
      // like the one-item path always did — and a PAUSED player emits no
      // position, so the resume effect below supplies the event a playing one
      // would have supplied at 1 Hz.
      if (!useAppStateStore.getState().isActive) return;

      const located = locateInBook(chapters, {
        from: 'queue',
        queueIndex,
        positionSeconds: position,
      })?.chapter;

      // The Chapter's start in the Player's own coordinates — one shared
      // expression, right on both shapes without asking which one this is.
      const next: ChapterPlacement | undefined = located
        ? {
            index: located.index,
            startSeconds: chapterStartInQueueSeconds(position, located),
          }
        : undefined;

      if (
        next?.index !== placementRef.current?.index ||
        next?.startSeconds !== placementRef.current?.startSeconds
      ) {
        placementRef.current = next;
        setPlacement(next);
      }
    };

    const updateFromProgress = async () => {
      if (!useAppStateStore.getState().isActive) return;
      try {
        const { position } = await getProgress();
        applyPosition(position);
      } catch {
        // Player might not be initialized yet
      }
    };
    refreshRef.current = updateFromProgress;

    // Initialize on mount, and again whenever the Queue index moves.
    updateFromProgress();

    const subscriptions = [
      // Chapter boundary detection while playing
      subscribe(Event.PlaybackProgressUpdated, ({ position }) =>
        applyPosition(position),
      ),
      // Seeks and play/pause: refresh immediately
      subscribe(Event.PlaybackState, updateFromProgress),
      // Re-initialize after cold start / queue swaps
      subscribe(Event.PlaybackActiveTrackChanged, updateFromProgress),
    ];

    return () => {
      refreshRef.current = undefined;
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [chapters, queueIndex]);

  /**
   * ⚠ THE RESUME IS THE EVENT. `applyPosition` drops every position while
   * backgrounded and self-heals only if another one follows: a PLAYING player
   * supplies that at 1 Hz, a PAUSED one never does. Without this, a Book whose
   * Chapter advanced while backgrounded and was then paused from the
   * notification shows the PREVIOUS Chapter — title, chapters modal and
   * progress bar alike — until the next play or seek. Device-verified on a
   * multi-item Book.
   *
   * The transition guard is load-bearing: `_layout.tsx` calls `setActive` on
   * EVERY AppState change, including `inactive -> active`, where the flag has
   * not moved and nothing needs re-deriving.
   */
  useEffect(
    () =>
      useAppStateStore.subscribe((state, prev) => {
        if (state.isActive && !prev.isActive) refreshRef.current?.();
      }),
    [],
  );

  return useMemo(() => {
    const chapter = placement ? chapters?.[placement.index] : undefined;
    if (!chapter || !placement) return undefined;
    return { chapter, chapterStartSeconds: placement.startSeconds };
  }, [chapters, placement]);
};
