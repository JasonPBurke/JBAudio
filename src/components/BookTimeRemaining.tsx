import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { Text } from 'react-native';
import TrackPlayer, {
  useActiveTrack,
  Event,
} from 'react-native-track-player';
import { useBookById } from '@/store/library';
import { formatSecondsToHoursMinutes } from '@/helpers/miscellaneous';
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack';
import { colors } from '@/constants/tokens';
import { Book, Chapter } from '@/types/Book';

type BookTimeRemainingProps = {
  size?: number;
  color?: string;
};

/**
 * Calculates remaining book time based on position and book structure.
 * For single-file books (one audio file with chapters via startMs), position is the book position.
 * For multi-file books, position is the current chapter position.
 */
function calculateRemainingTime(
  book: Book,
  position: number,
  currentIndex: number | undefined,
  isSingleFileBook: boolean
): number {
  if (!book.chapters) {
    return Math.max(0, book.bookDuration - position);
  }

  let totalPlayedTime: number;

  if (isSingleFileBook) {
    totalPlayedTime = position;
  } else {
    const chapters = book.chapters;
    const idx =
      typeof currentIndex === 'number' &&
      currentIndex >= 0 &&
      currentIndex < chapters.length
        ? currentIndex
        : 0;

    totalPlayedTime = position;
    for (let i = 0; i < idx; i++) {
      totalPlayedTime += chapters[i]?.chapterDuration ?? 0;
    }
  }

  return Math.max(0, book.bookDuration - totalPlayedTime);
}

/**
 * Detects if a book is a single-file book (one audio file with multiple chapters via startMs).
 */
function isSingleFile(chapters: Chapter[] | undefined): boolean {
  if (!chapters || chapters.length <= 1) return false;
  return chapters.every((c) => c.url === chapters[0].url);
}

/**
 * Inner component that handles the progress-dependent time calculation.
 * This is separated from the outer component to isolate re-renders.
 *
 * Uses event-based progress updates instead of polling, and only
 * updates the display every 5 seconds to minimize re-renders.
 */
const BookTimeRemainingInner = React.memo(
  ({
    book,
    currentIndex,
    size,
    color,
  }: {
    book: NonNullable<ReturnType<typeof useBookById>>;
    currentIndex: number | undefined;
    size?: number;
    color?: string;
  }) => {
    const [remainingText, setRemainingText] = useState('');
    const lastUpdateRef = useRef(0);

    const isSingleFileBook = useMemo(() => isSingleFile(book?.chapters), [book]);

    const calculateRemaining = useCallback(
      (position: number) => {
        const remaining = calculateRemainingTime(book, position, currentIndex, isSingleFileBook);
        return formatSecondsToHoursMinutes(remaining);
      },
      [book, currentIndex, isSingleFileBook]
    );

    // Initial calculation and event-based updates
    useEffect(() => {
      // Get initial position
      const initializeRemaining = async () => {
        try {
          const { position } = await TrackPlayer.getProgress();
          setRemainingText(calculateRemaining(position));
          lastUpdateRef.current = Math.floor(position / 5);
        } catch (error) {
          // Player might not be initialized
        }
      };

      initializeRemaining();

      // Subscribe to progress updates via event
      const subscription = TrackPlayer.addEventListener(
        Event.PlaybackProgressUpdated,
        ({ position }) => {
          // Only update every 5 seconds to reduce re-renders
          const currentBucket = Math.floor(position / 5);
          if (currentBucket !== lastUpdateRef.current) {
            lastUpdateRef.current = currentBucket;
            setRemainingText(calculateRemaining(position));
          }
        }
      );

      return () => subscription.remove();
    }, [calculateRemaining]);

    return (
      <Text
        style={{
          fontSize: size ?? 12,
          color: color ?? colors.textMuted,
          fontWeight: '400',
        }}
      >
        {remainingText} left
      </Text>
    );
  }
);

BookTimeRemainingInner.displayName = 'BookTimeRemainingInner';

/**
 * Optimized BookTimeRemaining component.
 *
 * Key optimizations:
 * 1. Split into outer (track/book resolution) and inner (progress-dependent) components
 * 2. Inner component uses event-based progress updates instead of useProgress hook
 * 3. Only updates display every 5 seconds instead of every 1 second
 * 4. Both components wrapped in React.memo
 */
export const BookTimeRemaining = React.memo(
  ({ size, color }: BookTimeRemainingProps) => {
    const activeTrack = useActiveTrack();
    const lastActiveTrack = useLastActiveTrack();
    const displayedTrack = activeTrack ?? lastActiveTrack;
    const displayedBook = useBookById(displayedTrack?.bookId ?? '');

    // Track current index for chapter calculations
    const [currentIndex, setCurrentIndex] = useState<number | undefined>(
      undefined
    );

    // Update current index when track changes
    useEffect(() => {
      let mounted = true;

      const updateIndex = async () => {
        try {
          const idx = await TrackPlayer.getActiveTrackIndex();
          if (mounted) setCurrentIndex(idx);
        } catch {
          // ignore
        }
      };

      updateIndex();

      // Also listen for track changes
      const subscription = TrackPlayer.addEventListener(
        Event.PlaybackActiveTrackChanged,
        async () => {
          try {
            const idx = await TrackPlayer.getActiveTrackIndex();
            if (mounted) setCurrentIndex(idx);
          } catch {
            // ignore
          }
        }
      );

      return () => {
        mounted = false;
        subscription.remove();
      };
    }, [displayedTrack?.bookId]);

    if (!displayedTrack || !displayedBook) {
      return null;
    }

    return (
      <BookTimeRemainingInner
        book={displayedBook}
        currentIndex={currentIndex}
        size={size}
        color={color}
      />
    );
  }
);

BookTimeRemaining.displayName = 'BookTimeRemaining';

/**
 * Utility function to calculate book time remaining.
 * This is a non-hook version for use outside of React components.
 */
export async function bookTimeRemaining(
  bookId: string,
  getBook: (id: string) => ReturnType<typeof useBookById>
): Promise<number | null> {
  const book = getBook(bookId);
  if (!book) return null;

  try {
    const [{ position }, currentIndex] = await Promise.all([
      TrackPlayer.getProgress(),
      TrackPlayer.getActiveTrackIndex(),
    ]);

    return calculateRemainingTime(
      book,
      position,
      currentIndex ?? undefined,
      isSingleFile(book.chapters)
    );
  } catch {
    return null;
  }
}
