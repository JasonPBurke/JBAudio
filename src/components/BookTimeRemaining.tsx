import { Text } from 'react-native';
import TrackPlayer, {
  useActiveTrack,
  useProgress,
} from 'react-native-track-player';
import { useBookById } from '@/store/library';
import { formatSecondsToHoursMinutes } from '@/helpers/miscellaneous';
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack';
import { colors } from '@/constants/tokens';
import { useEffect, useState } from 'react';

// Normalize URLs to improve matching between TrackPlayer track URLs and stored chapter URLs
const normalizeUrl = (u?: string | null) =>
  u ? u.replace(/^file:\/\//, '') : '';

type BookTimeRemainingProps = {
  size?: number;
  color?: string;
};

export const BookTimeRemaining = ({
  size,
  color,
}: BookTimeRemainingProps) => {
  const { position } = useProgress(1000);
  const activeTrack = useActiveTrack();
  const lastActiveTrack = useLastActiveTrack();
  const displayedTrack = activeTrack ?? lastActiveTrack;

  // Use native active track index for reliable chapter detection
  const [currentIndex, setCurrentIndex] = useState<number | undefined>(
    undefined
  );
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const idx = await TrackPlayer.getActiveTrackIndex();
        if (mounted) setCurrentIndex(idx);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [
    displayedTrack?.bookId,
    (displayedTrack as any)?.url,
    (displayedTrack as any)?.title,
  ]);

  //! find a way to call this only when the book changes
  const displayedBook = useBookById(displayedTrack?.bookId ?? '');

  if (!displayedTrack || !displayedBook) {
    return null;
  }

  let totalPlayedTimeInBook = 0;
  if (displayedBook.chapters) {
    const chapters = displayedBook.chapters;
    const dtUrl = normalizeUrl((displayedTrack as any)?.url);
    const dtTitle = (displayedTrack as any)?.title;

    // Prefer native active index if it belongs to this book's queue range
    let idx: number | undefined =
      typeof currentIndex === 'number' &&
      currentIndex >= 0 &&
      currentIndex < chapters.length
        ? currentIndex
        : undefined;

    // Fallback to matching by URL/title
    if (idx === undefined) {
      const matchIndex = chapters.findIndex(
        (ch) => normalizeUrl(ch.url) === dtUrl || ch.chapterTitle === dtTitle
      );
      if (matchIndex >= 0) idx = matchIndex;
    }

    // Fallback to stored progress if within range
    if (idx === undefined && displayedBook.bookProgress) {
      const stored = displayedBook.bookProgress.currentChapterIndex;
      if (
        typeof stored === 'number' &&
        stored >= 0 &&
        stored < chapters.length
      ) {
        idx = stored;
      }
    }

    // Final fallback
    if (idx === undefined) idx = 0;

    // Sum durations of chapters before the current chapter index
    const upper = Math.min(idx, chapters.length);
    for (let i = 0; i < upper; i++) {
      totalPlayedTimeInBook += chapters[i]?.chapterDuration ?? 0;
    }
    totalPlayedTimeInBook += position;
  }

  const remainingSeconds = Math.max(
    0,
    displayedBook.bookDuration - totalPlayedTimeInBook
  );
  const bookRemainingTime = formatSecondsToHoursMinutes(remainingSeconds);

  return (
    <Text
      style={{
        fontSize: size ?? 12,
        color: color ?? colors.textMuted,
        fontWeight: '400',
      }}
    >
      {bookRemainingTime} left
    </Text>
  );
};

export const bookTimeRemaining = () => {
  const { position } = useProgress(1000);
  const activeTrack = useActiveTrack();
  const lastActiveTrack = useLastActiveTrack();
  const displayedTrack = activeTrack ?? lastActiveTrack;

  const displayedBook = useBookById(displayedTrack?.bookId ?? '');

  if (!displayedTrack || !displayedBook) {
    return null;
  }

  let totalPlayedTimeInBook = 0;
  if (displayedBook.chapters) {
    const chapters = displayedBook.chapters;
    const dtUrl = normalizeUrl((displayedTrack as any)?.url);
    const dtTitle = (displayedTrack as any)?.title;

    let idx: number | undefined = undefined;

    // Try to match by URL or title first for this helper as we don't have native index here
    const matchIndex = chapters.findIndex(
      (ch) => normalizeUrl(ch.url) === dtUrl || ch.chapterTitle === dtTitle
    );
    if (matchIndex >= 0) idx = matchIndex;

    // Fallback to stored progress if within range
    if (idx === undefined && displayedBook.bookProgress) {
      const stored = displayedBook.bookProgress.currentChapterIndex;
      if (
        typeof stored === 'number' &&
        stored >= 0 &&
        stored < chapters.length
      ) {
        idx = stored;
      }
    }

    if (idx === undefined) idx = 0;

    const upper = Math.min(idx, chapters.length);
    for (let i = 0; i < upper; i++) {
      totalPlayedTimeInBook += chapters[i]?.chapterDuration ?? 0;
    }
    totalPlayedTimeInBook += position;
  }

  return Math.max(0, displayedBook.bookDuration - totalPlayedTimeInBook);
};
