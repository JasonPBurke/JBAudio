import { Text, StyleSheet } from 'react-native';
import { useActiveTrack, useProgress } from 'react-native-track-player';
import { useBookById } from '@/store/library';
import { formatSecondsToHoursMinutes } from '@/helpers/miscellaneous';
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack';
import { colors } from '@/constants/tokens';
import { useMemo } from 'react';

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

  //! find a way to call this only when the book changes
  const displayedBook = useBookById(displayedTrack?.bookId ?? '');

  if (!displayedTrack || !displayedBook) {
    return null;
  }

  let totalPlayedTimeInBook = 0;
  if (displayedBook.chapters && displayedBook.bookProgress) {
    const currentChapterIndex =
      displayedBook.bookProgress.currentChapterIndex;
    for (let i = 0; i < currentChapterIndex; i++) {
      totalPlayedTimeInBook += displayedBook.chapters[i].chapterDuration;
    }
    totalPlayedTimeInBook += position;
  }

  const bookRemainingTime = formatSecondsToHoursMinutes(
    displayedBook.bookDuration - totalPlayedTimeInBook
  );

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
  if (displayedBook.chapters && displayedBook.bookProgress) {
    const currentChapterIndex =
      displayedBook.bookProgress.currentChapterIndex;
    for (let i = 0; i < currentChapterIndex; i++) {
      totalPlayedTimeInBook += displayedBook.chapters[i].chapterDuration;
    }
    totalPlayedTimeInBook += position;
  }

  // const bookRemainingTime = formatSecondsToHoursMinutes(
  //   displayedBook.bookDuration - totalPlayedTimeInBook
  // );
  return displayedBook.bookDuration - totalPlayedTimeInBook;
};
