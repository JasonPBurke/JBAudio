import { Text, StyleSheet } from 'react-native';
import { useActiveTrack, useProgress } from 'react-native-track-player';
import { useBookById } from '@/store/library';
import { formatSecondsToHoursMinutes } from '@/helpers/miscellaneous';
import { defaultStyles } from '@/styles';
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack';

export const BookTimeRemaining = () => {
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

  const bookRemainingTime = formatSecondsToHoursMinutes(
    displayedBook.bookDuration - totalPlayedTimeInBook
  );

  return (
    <Text style={styles.bookTimeRemaining}>{bookRemainingTime} left</Text>
  );
};

const styles = StyleSheet.create({
  bookTimeRemaining: {
    ...defaultStyles.text,
    fontSize: 12,
    fontWeight: '400',
  },
});
