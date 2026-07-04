import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import TrackPlayer, {
  Event,
  useActiveTrack,
} from 'react-native-track-player';
import { useBookById, useLibraryStore } from '@/store/library';
import { Chapter } from '@/types/Book';
import {
  usesChapterQueue,
  resolveCurrentChapterIndex,
} from '@/helpers/chapterPlayback';

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
export const CurrentChapterContext = createContext<Chapter | undefined | null>(
  null,
);

export const useCurrentChapter = (): Chapter | undefined => {
  const value = useContext(CurrentChapterContext);
  if (value === null) {
    throw new Error(
      'useCurrentChapter must be used inside a CurrentChapterContext.Provider',
    );
  }
  return value;
};

/**
 * Returns the current chapter, re-rendering only when it actually changes.
 *
 * Chapter identity (see helpers/chapterPlayback.ts):
 * - Chapter-queue mode (multi-file books, and clipped single-file books under
 *   the spike): current chapter = chapters[queue index]. The queue index
 *   comes from the library store's playbackIndex, which service.js keeps
 *   current via PlaybackActiveTrackChanged; on mount, before the store has an
 *   entry, TrackPlayer.getActiveTrackIndex() fills the gap.
 * - Legacy single-file mode (spike off / no chapter offsets): the book is one
 *   queue item with absolute positions, so the chapter is derived from
 *   progress/seek events. Never match chapters by URL — clipped queue items
 *   all share one URL.
 */
export const useCurrentChapterStable = () => {
  const activeTrack = useActiveTrack();
  const bookId = activeTrack?.bookId ?? '';
  const book = useBookById(bookId);
  const chapters = book?.chapters;

  const chapterQueue = useMemo(() => usesChapterQueue(chapters), [chapters]);

  // --- Chapter-queue mode: index straight from the store ---
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

  useEffect(() => {
    if (!chapterQueue || typeof storeIndex === 'number') return;

    let mounted = true;
    TrackPlayer.getActiveTrackIndex()
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
  }, [chapterQueue, storeIndex, bookId]);

  // --- Legacy single-file mode: index derived from playback position ---
  const [positionIndex, setPositionIndex] = useState<number | undefined>(
    undefined,
  );
  const positionIndexRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (chapterQueue || !chapters?.length) {
      positionIndexRef.current = undefined;
      setPositionIndex(undefined);
      return;
    }

    const applyPosition = (position: number) => {
      const index = resolveCurrentChapterIndex(chapters, undefined, position);
      if (index !== positionIndexRef.current) {
        positionIndexRef.current = index;
        setPositionIndex(index);
      }
    };

    const updateFromProgress = async () => {
      try {
        const { position } = await TrackPlayer.getProgress();
        applyPosition(position);
      } catch {
        // Player might not be initialized yet
      }
    };

    // Initialize on mount
    updateFromProgress();

    const subscriptions = [
      // Chapter boundary detection while playing
      TrackPlayer.addEventListener(
        Event.PlaybackProgressUpdated,
        ({ position }) => applyPosition(position),
      ),
      // Seeks and play/pause: refresh immediately
      TrackPlayer.addEventListener(Event.PlaybackState, updateFromProgress),
      // Re-initialize after cold start / queue swaps
      TrackPlayer.addEventListener(
        Event.PlaybackActiveTrackChanged,
        updateFromProgress,
      ),
    ];

    return () => subscriptions.forEach((sub) => sub.remove());
  }, [chapterQueue, chapters]);

  return useMemo(() => {
    if (!chapters?.length) return undefined;

    const index = chapterQueue
      ? typeof storeIndex === 'number'
        ? storeIndex
        : queueIndexFallback
      : positionIndex;

    if (typeof index !== 'number' || index < 0) return undefined;
    return chapters[Math.min(index, chapters.length - 1)];
  }, [chapters, chapterQueue, storeIndex, queueIndexFallback, positionIndex]);
};
