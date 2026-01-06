import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import TrackPlayer, {
  Event,
  useActiveTrack,
} from 'react-native-track-player';
import { useBookById } from '@/store/library';
import { Chapter } from '@/types/Book';

/**
 * A stable version of useCurrentChapter that minimizes re-renders.
 *
 * Key differences from the original useCurrentChapter:
 * 1. Uses event listeners instead of useProgress() polling
 * 2. Only triggers state updates when chapter actually changes
 * 3. Uses refs to track position without causing re-renders
 *
 * This hook will only cause a re-render when:
 * - The active track changes
 * - The book data changes
 * - The current chapter actually changes (for single-file books)
 */
export const useCurrentChapterStable = () => {
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');
  const [currentChapter, setCurrentChapter] = useState<Chapter | undefined>(
    undefined
  );
  const currentChapterRef = useRef<Chapter | undefined>(undefined);
  const positionRef = useRef<number>(0);

  // Determine if this is a single-file book (one audio file with multiple chapters)
  const isSingleFileBook = useMemo(() => {
    if (!book || !book.chapters || book.chapters.length <= 1) return false;
    return book.chapters.every((c) => c.url === book.chapters[0].url);
  }, [book]);

  // Memoize chapter finding logic
  const findChapter = useCallback(
    (position: number): Chapter | undefined => {
      if (!book?.chapters) return undefined;

      if (isSingleFileBook) {
        // For single-file books, find chapter based on playback position
        // Search in reverse to find the last chapter that started before current position
        return [...book.chapters]
          .reverse()
          .find((ch) => (ch.startMs || 0) / 1000 <= position);
      } else {
        // For multi-file books, find chapter based on active track URL
        return book.chapters.find((ch) => ch.url === activeTrack?.url);
      }
    },
    [book, activeTrack?.url, isSingleFileBook]
  );

  // Update chapter only if it actually changed
  const updateChapterIfChanged = useCallback(
    (chapter: Chapter | undefined) => {
      const currentTitle = currentChapterRef.current?.chapterTitle;
      const currentUrl = currentChapterRef.current?.url;
      const newTitle = chapter?.chapterTitle;
      const newUrl = chapter?.url;

      // Only update state if the chapter actually changed
      if (currentTitle !== newTitle || currentUrl !== newUrl) {
        currentChapterRef.current = chapter;
        setCurrentChapter(chapter);
      }
    },
    []
  );

  useEffect(() => {
    if (!book?.chapters) {
      updateChapterIfChanged(undefined);
      return;
    }

    // Get initial position and chapter
    const initializeChapter = async () => {
      try {
        const { position } = await TrackPlayer.getProgress();
        positionRef.current = position;
        const chapter = findChapter(position);
        updateChapterIfChanged(chapter);
      } catch (error) {
        // Player might not be initialized yet
      }
    };

    initializeChapter();

    // For multi-file books, we only need to update on track changes
    // which is already handled by activeTrack dependency
    if (!isSingleFileBook) {
      const chapter = findChapter(0);
      updateChapterIfChanged(chapter);
      return;
    }

    // For single-file books, listen to progress updates but only
    // update state when chapter boundary is crossed
    const progressSubscription = TrackPlayer.addEventListener(
      Event.PlaybackProgressUpdated,
      ({ position }) => {
        positionRef.current = position;
        const chapter = findChapter(position);
        updateChapterIfChanged(chapter);
      }
    );

    // Also listen for seek events to update chapter immediately
    const seekSubscription = TrackPlayer.addEventListener(
      Event.PlaybackState,
      async () => {
        try {
          const { position } = await TrackPlayer.getProgress();
          positionRef.current = position;
          const chapter = findChapter(position);
          updateChapterIfChanged(chapter);
        } catch (error) {
          // Ignore errors
        }
      }
    );

    return () => {
      progressSubscription.remove();
      seekSubscription.remove();
    };
  }, [
    book,
    activeTrack?.url,
    isSingleFileBook,
    findChapter,
    updateChapterIfChanged,
  ]);

  return currentChapter;
};

/**
 * Returns the current chapter's progress information as shared values
 * for use with Reanimated without causing React re-renders.
 */
export const useCurrentChapterInfo = () => {
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');

  return useMemo(() => {
    if (!book?.chapters) {
      return {
        chapters: [] as Chapter[],
        isSingleFileBook: false,
      };
    }

    const isSingleFileBook =
      book.chapters.length > 1 &&
      book.chapters.every((c) => c.url === book.chapters[0].url);

    return {
      chapters: book.chapters,
      isSingleFileBook,
    };
  }, [book]);
};
