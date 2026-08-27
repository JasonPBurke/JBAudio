import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { Text } from 'react-native';
import {
  Event,
  getActiveTrackIndex,
  getProgress,
  State,
  subscribe,
} from '@/player/trackPlayer';
import { useBookById } from '@/store/library';
import { useLastActiveBookId } from '@/store/playerState';
import { useAppStateStore } from '@/store/appState';
import { useSettingsStore } from '@/store/settingsStore';
import { formatSecondsToHoursMinutes } from '@/helpers/miscellaneous';
import { formatRate } from '@/helpers/playbackRate';
import { calculateRemainingBookTime } from '@/helpers/chapterPlayback';
import { colors } from '@/constants/tokens';

type BookTimeRemainingProps = {
  size?: number;
  color?: string;
};

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
    const rate = useSettingsStore((s) => s.playbackRate);

    const calculateRemaining = useCallback(
      (position: number) => {
        const remaining = calculateRemainingBookTime(
          book,
          position,
          currentIndex,
        );
        // Wall-clock listening time at the current playback speed
        return formatSecondsToHoursMinutes(remaining / rate);
      },
      [book, currentIndex, rate],
    );

    // Initial calculation and event-based updates
    useEffect(() => {
      // Get initial position
      const initializeRemaining = async () => {
        try {
          const { position } = await getProgress();
          setRemainingText(calculateRemaining(position));
          lastUpdateRef.current = Math.floor(position / 5);
        } catch (error) {
          // Player might not be initialized
        }
      };

      initializeRemaining();

      // Subscribe to progress updates via event
      const subscription = subscribe(
        Event.PlaybackProgressUpdated,
        ({ position }) => {
          // Dormant while backgrounded — this bar (in both the player screen
          // and the FloatingPlayer) is invisible, so skip the recompute/render.
          if (!useAppStateStore.getState().isActive) return;
          // Only update every 5 seconds to reduce re-renders
          const currentBucket = Math.floor(position / 5);
          if (currentBucket !== lastUpdateRef.current) {
            lastUpdateRef.current = currentBucket;
            setRemainingText(calculateRemaining(position));
          }
        },
      );

      // Progress events are the ONLY other input, and they stop arriving the
      // moment playback does — so without this the last value ever computed
      // sticks. That is visible at the end of a book: PlaybackQueueEnded
      // resets the position to 0:00, but it does so through seekTo/skip and
      // the DB, none of which emit a progress event, leaving "0m left" on
      // screen next to a book sitting at the beginning. (Closing and
      // reopening the player hid it, because that remounts and re-runs the
      // initial read above.) Recomputing whenever playback stops covers the
      // whole class, not just the queue-ended case, and it runs after the
      // service's seekTo(0) because stop() is the last thing that handler
      // does.
      const stateSubscription = subscribe(
        Event.PlaybackState,
        async ({ state }) => {
          if (
            state !== State.Paused &&
            state !== State.Stopped &&
            state !== State.Ended &&
            state !== State.None
          ) {
            return;
          }
          try {
            const { position } = await getProgress();
            // Identical strings bail out of the re-render, so a pause that
            // changes nothing costs nothing.
            setRemainingText(calculateRemaining(position));
            lastUpdateRef.current = Math.floor(position / 5);
          } catch {
            // Player torn down — nothing to show.
          }
        },
      );

      return () => {
        subscription.remove();
        stateSubscription.remove();
      };
    }, [calculateRemaining]);

    return (
      <Text
        style={{
          fontSize: size ?? 12,
          color: color ?? colors.textMuted,
          fontFamily: 'Rubik',
          letterSpacing: 0.7,
          opacity: 0.75,
        }}
      >
        {remainingText} left
        {rate !== 1 ? ` (${formatRate(rate)})` : ''}
      </Text>
    );
  },
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
    // Sticky, not Active -- see `lastActiveBookId` in store/playerState.
    const displayedBookId = useLastActiveBookId();
    const displayedBook = useBookById(displayedBookId ?? '');

    // Track current index for chapter calculations
    const [currentIndex, setCurrentIndex] = useState<number | undefined>(
      undefined,
    );

    // Update current index when track changes
    useEffect(() => {
      let mounted = true;

      const updateIndex = async () => {
        try {
          const idx = await getActiveTrackIndex();
          if (mounted) setCurrentIndex(idx);
        } catch {
          // ignore
        }
      };

      updateIndex();

      // Also listen for track changes
      const subscription = subscribe(
        Event.PlaybackActiveTrackChanged,
        async () => {
          try {
            const idx = await getActiveTrackIndex();
            if (mounted) setCurrentIndex(idx);
          } catch {
            // ignore
          }
        },
      );

      return () => {
        mounted = false;
        subscription.remove();
      };
    }, [displayedBookId]);

    if (!displayedBookId || !displayedBook) {
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
  },
);

BookTimeRemaining.displayName = 'BookTimeRemaining';

/**
 * Utility function to calculate book time remaining.
 * This is a non-hook version for use outside of React components.
 */
export async function bookTimeRemaining(
  bookId: string,
  getBook: (id: string) => ReturnType<typeof useBookById>,
): Promise<number | null> {
  const book = getBook(bookId);
  if (!book) return null;

  try {
    const [{ position }, currentIndex] = await Promise.all([
      getProgress(),
      getActiveTrackIndex(),
    ]);

    return calculateRemainingBookTime(book, position, currentIndex ?? undefined);
  } catch {
    return null;
  }
}
