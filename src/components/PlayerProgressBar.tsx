import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import {
  useSharedValue,
  useDerivedValue,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import TrackPlayer from 'react-native-track-player';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { fontSize } from '@/constants/tokens';
import { utilsStyles } from '@/styles';
import { useProgressReanimated } from '@/hooks/useProgressReanimated';
import { useCurrentChapterStable } from '@/hooks/useCurrentChapterStable';
import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/library';
import { recordSeekFootprint } from '@/db/footprintQueries';

// Pre-defined styles to avoid inline object creation
const bubbleContainerStyle = {
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  flex: 1,
};

/**
 * Optimized PlayerProgressBar using Reanimated shared values.
 *
 * Key optimizations:
 * 1. Uses useProgressReanimated instead of useProgress - no React re-renders on progress updates
 * 2. Uses useCurrentChapterStable - only re-renders when chapter actually changes
 * 3. Time text updates via useAnimatedReaction - updates only every second
 * 4. Wrapped in React.memo - prevents re-renders from parent
 * 5. Pre-defined styles outside component - no new object references
 * 6. Uses shared values instead of refs for worklet access
 */
export const PlayerProgressBar = React.memo(({ style }: ViewProps) => {
  // Get theme colors
  const { colors: themeColors } = useTheme();

  // Memoized slider theme - responsive to theme changes
  const sliderTheme = useMemo(
    () => ({
      minimumTrackTintColor: themeColors.primary,
      maximumTrackTintColor: themeColors.maximumTrackTintColor,
    }),
    [themeColors.primary, themeColors.maximumTrackTintColor],
  );

  // Memoized bubble text style
  const bubbleTextStyle = useMemo(
    () => ({ color: themeColors.textMuted, fontFamily: 'Rubik' }),
    [themeColors.textMuted],
  );

  // Use Reanimated-based progress hook - updates shared values without React re-renders
  const { position, duration } = useProgressReanimated();

  // Get current chapter info - only triggers re-render when chapter changes
  const currentChapter = useCurrentChapterStable();

  // Use shared values instead of refs for chapter info (worklet-compatible)
  const chapterStart = useSharedValue(0);
  const chapterDuration = useSharedValue(0);

  // Update shared values when chapter changes (on JS thread)
  useEffect(() => {
    if (currentChapter) {
      const start = (currentChapter.startMs ?? 0) / 1000;
      const dur = currentChapter.chapterDuration ?? 0;

      chapterStart.value = start;
      chapterDuration.value = dur;

      // Immediately update time display when chapter data arrives
      // This handles mount case where position is set but chapter wasn't loaded yet
      if (dur > 0) {
        const chapterPos = Math.max(0, position.value - start);
        const remaining = Math.max(0, dur - chapterPos);
        setTrackElapsedTime(formatSecondsToMinutes(chapterPos));
        setTrackRemainingTime('-' + formatSecondsToMinutes(remaining));
      }
    } else {
      chapterStart.value = 0;
      chapterDuration.value = 0;
    }
  }, [currentChapter, chapterStart, chapterDuration, position]);

  // Fallback: when currentChapter is undefined, try to get chapter from track index
  useEffect(() => {
    if (currentChapter || chapterDuration.value > 0) return;

    const initializeChapterFromIndex = async () => {
      try {
        const [trackIndex, activeTrack, { position }] = await Promise.all([
          TrackPlayer.getActiveTrackIndex(),
          TrackPlayer.getActiveTrack(),
          TrackPlayer.getProgress(),
        ]);
        if (trackIndex == null || !activeTrack?.bookId) return;

        const book = useLibraryStore.getState().books[activeTrack.bookId];
        const chapter = book?.chapters?.[trackIndex];
        if (!chapter) return;

        const start = (chapter.startMs ?? 0) / 1000;
        const duration = chapter.chapterDuration ?? 0;
        chapterStart.value = start;
        chapterDuration.value = duration;

        const chapterPos = Math.max(0, position - start);
        const remaining = Math.max(0, duration - chapterPos);
        setTrackElapsedTime(formatSecondsToMinutes(chapterPos));
        setTrackRemainingTime('-' + formatSecondsToMinutes(remaining));
      } catch {
        // Ignore errors during initialization
      }
    };

    initializeChapterFromIndex();
  }, [currentChapter, chapterStart, chapterDuration]);

  // State for time text displays - updated at reduced frequency
  const [trackElapsedTime, setTrackElapsedTime] = useState('0:00');
  const [trackRemainingTime, setTrackRemainingTime] = useState('-0:00');
  const [bubbleElapsedTime, setBubbleElapsedTime] = useState('0:00');

  // Shared values for slider
  const isSliding = useSharedValue(false);
  const slidingProgress = useSharedValue(0);
  const min = useSharedValue(0);
  const max = useSharedValue(1);

  // Derived progress value (0-1) based on chapter position
  const progress = useDerivedValue((): number => {
    // While sliding, keep the slider at the user's position
    if (isSliding.value) {
      return slidingProgress.value;
    }

    const chapterDur =
      chapterDuration.value > 0 ? chapterDuration.value : duration.value;

    if (chapterDur <= 0) return 0;

    const chapterPos = position.value - chapterStart.value;
    const progressValue = Math.max(0, Math.min(1, chapterPos / chapterDur));

    // Update sliding progress so it's ready if user starts sliding
    slidingProgress.value = progressValue;

    return progressValue;
  }, []);

  // Callback to update time display text (runs on JS thread)
  const updateTimeDisplay = useCallback(
    (pos: number, chapStart: number, chapDur: number, totalDur: number) => {
      const effectiveDur = chapDur > 0 ? chapDur : totalDur;
      const chapterPos = Math.max(0, pos - chapStart);
      const remaining = Math.max(0, effectiveDur - chapterPos);

      setTrackElapsedTime(formatSecondsToMinutes(chapterPos));
      setTrackRemainingTime('-' + formatSecondsToMinutes(remaining));
    },
    [],
  );

  // Update time text only every second (not every 250ms)
  useAnimatedReaction(
    () => Math.floor(position.value),
    (currentSecond, previousSecond) => {
      if (currentSecond !== previousSecond && !isSliding.value) {
        runOnJS(updateTimeDisplay)(
          position.value,
          chapterStart.value,
          chapterDuration.value,
          duration.value,
        );
      }
    },
    [],
  );

  // Handle seek completion
  const handleSeek = useCallback(
    async (value: number) => {
      isSliding.value = false;

      // Record footprint with position before the seek
      // TrackPlayer still has the original position since seekTo hasn't been called yet
      try {
        const [activeTrack, { position: currentPos }] = await Promise.all([
          TrackPlayer.getActiveTrack(),
          TrackPlayer.getProgress(),
        ]);
        if (activeTrack?.bookId) {
          // recordSeekFootprint handles chapter detection for single-file books
          // currentPos is in seconds, convert to ms
          await recordSeekFootprint(
            activeTrack.bookId,
            Math.round(currentPos * 1000),
          );
        }
      } catch {
        // Silently fail if footprint recording fails
      }

      const chapStart = chapterStart.value;
      const chapDur =
        chapterDuration.value > 0 ? chapterDuration.value : duration.value;

      const seekPosition = chapStart + value * chapDur;
      await TrackPlayer.seekTo(seekPosition);

      // Update time display immediately after seek
      const chapterPos = value * chapDur;
      setTrackElapsedTime(formatSecondsToMinutes(chapterPos));
      setTrackRemainingTime(
        '-' + formatSecondsToMinutes(chapDur - chapterPos),
      );
    },
    [chapterStart, chapterDuration, duration, isSliding],
  );

  // Handle sliding start
  const handleSlidingStart = useCallback(() => {
    isSliding.value = true;
  }, [isSliding]);

  // Handle value change during sliding (for bubble display)
  const handleValueChange = useCallback(
    (value: number) => {
      // Update sliding progress to keep slider at user's position
      slidingProgress.value = value;

      const chapDur =
        chapterDuration.value > 0 ? chapterDuration.value : duration.value;
      setBubbleElapsedTime(formatSecondsToMinutes(value * chapDur));
    },
    [chapterDuration, duration, slidingProgress],
  );

  // Render bubble component
  const renderBubble = useCallback(
    () => (
      <View style={bubbleContainerStyle}>
        <Text style={bubbleTextStyle}>{bubbleElapsedTime}</Text>
      </View>
    ),
    [bubbleElapsedTime, bubbleTextStyle],
  );

  return (
    <View style={style}>
      <Slider
        progress={progress}
        minimumValue={min}
        maximumValue={max}
        containerStyle={utilsStyles.slider}
        theme={sliderTheme}
        thumbTouchSize={20}
        thumbWidth={13}
        renderBubble={renderBubble}
        onSlidingStart={handleSlidingStart}
        onSlidingComplete={handleSeek}
        onValueChange={handleValueChange}
      />
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: themeColors.lightText }]}>
          {trackElapsedTime}
        </Text>
        <Text style={[styles.timeText, { color: themeColors.lightText }]}>
          {trackRemainingTime}
        </Text>
      </View>
    </View>
  );
});

PlayerProgressBar.displayName = 'PlayerProgressBar';

const styles = StyleSheet.create({
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 10,
  },
  timeText: {
    opacity: 0.75,
    fontSize: fontSize.xs,
    letterSpacing: 0.7,
    fontFamily: 'Rubik-Medium',
  },
});
