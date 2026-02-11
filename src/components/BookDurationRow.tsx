import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { ProgressCapsule } from '@/components/ProgressCapsule';
import { computeBookProgress } from '@/helpers/bookProgressUtils';
import { BookProgressState } from '@/helpers/handleBookPlay';
import { useLibraryStore } from '@/store/library';
import { Book } from '@/types/Book';

type BookDurationRowProps = {
  book: Book;
  fontSize?: number;
  barHeight?: number;
  textColor?: string;
  style?: ViewStyle;
};

/**
 * Not wrapped in React.memo — re-renders when its parent does (on play/pause),
 * which is when we read the latest progress via getState() (no subscription).
 */
export function BookDurationRow({
  book,
  fontSize = 12,
  barHeight = 4,
  textColor,
  style,
}: BookDurationRowProps) {
  const { colors: themeColors } = useTheme();

  // Read live playback values imperatively — no subscription, no re-renders.
  // Values refresh whenever the parent re-renders (e.g. on play/pause).
  const { playbackProgress, playbackIndex } = useLibraryStore.getState();
  const progress = computeBookProgress(book, {
    liveProgress: playbackProgress[book.bookId],
    liveIndex: playbackIndex[book.bookId],
  });

  const color = textColor ?? themeColors.textMuted;

  const textStyle = {
    fontSize,
    color,
    fontFamily: 'Rubik' as const,
    letterSpacing: 0.7,
    opacity: 0.75,
  };

  if (progress.progressState === BookProgressState.NotStarted) {
    return (
      <View style={style}>
        <Text style={textStyle}>{progress.totalDurationText}</Text>
      </View>
    );
  }

  const displayText =
    progress.progressState === BookProgressState.Finished
      ? progress.totalDurationText
      : `${progress.remainingText} left`;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>
      <ProgressCapsule
        progress={progress.progressFraction}
        fillColor={themeColors.primary}
        trackColor={withOpacity(themeColors.textMuted, 0.25)}
        height={barHeight}
        style={{ flex: 1 }}
      />
      <Text style={textStyle}>{displayText}</Text>
    </View>
  );
}
