import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles, utilsStyles } from '@/styles';
import { useEffect, useMemo, useState, memo } from 'react';
import { useCurrentChapter } from '@/hooks/useCurrentChapter';

export const PlayerProgressBar = memo(({ style }: ViewProps) => {
  // Throttle progress updates to 1 Hz to reduce JS churn
  const { duration, position } = useProgress(1000);

  const currentChapter = useCurrentChapter();

  const chapterDuration = currentChapter?.chapterDuration ?? duration;
  const chapterPosition = currentChapter?.startMs
    ? position - currentChapter.startMs / 1000
    : position;

  const isSliding = useSharedValue(false);
  const progress = useSharedValue(0);
  const min = useSharedValue(0);
  const max = useSharedValue(1);

  // Compute display times only when the visible second changes
  const flooredChapterPos = Math.max(0, Math.floor(chapterPosition));
  const memoElapsed = useMemo(
    () => formatSecondsToMinutes(flooredChapterPos),
    [flooredChapterPos]
  );
  const memoRemaining = useMemo(
    () =>
      formatSecondsToMinutes(
        Math.max(0, Math.floor(chapterDuration - flooredChapterPos))
      ),
    [chapterDuration, flooredChapterPos]
  );

  const [bubbleElapsedTime, setBubbleElapsedTime] = useState(memoElapsed);
  const [trackElapsedTime, setTrackElapsedTime] = useState(memoElapsed);
  const [trackRemainingTime, setTrackRemainingTime] = useState(
    memoRemaining
  );

  if (!isSliding.value) {
    progress.value =
      chapterDuration > 0 ? chapterPosition / chapterDuration : 0;
  }

  useEffect(() => {
    if (!isSliding.value) {
      setTrackElapsedTime(memoElapsed);
      setTrackRemainingTime(memoRemaining);
    }
  }, [memoElapsed, memoRemaining, isSliding.value]);

  const handleSeek = async (value: number) => {
    if (isSliding.value) {
      isSliding.value = false;
    }
    const seekPosition = currentChapter?.startMs
      ? currentChapter.startMs / 1000 + value * chapterDuration
      : value * chapterDuration;
    await TrackPlayer.seekTo(seekPosition);
    setTrackElapsedTime(
      formatSecondsToMinutes(Math.floor(value * chapterDuration))
    );
    setTrackRemainingTime(
      formatSecondsToMinutes(
        Math.max(0, Math.floor(chapterDuration - value * chapterDuration))
      )
    );
  };

  return (
    <View style={style}>
      <Slider
        progress={progress}
        minimumValue={min}
        maximumValue={max}
        containerStyle={utilsStyles.slider}
        theme={{
          minimumTrackTintColor: colors.minimumTrackTintColor,
          maximumTrackTintColor: colors.maximumTrackTintColor,
        }}
        thumbTouchSize={20}
        thumbWidth={13}
        renderBubble={() => (
          <View style={{ justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Text style={{ color: colors.textMuted }}>{bubbleElapsedTime}</Text>
          </View>
        )}
        onSlidingStart={() => (isSliding.value = true)}
        onSlidingComplete={handleSeek}
        onValueChange={(value) => {
          setBubbleElapsedTime(
            formatSecondsToMinutes(Math.floor(value * chapterDuration))
          );
        }}
      />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{trackElapsedTime}</Text>
        <Text style={styles.timeText}>
          {'-'}
          {trackRemainingTime}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 10,
  },
  timeText: {
    ...defaultStyles.text,
    color: colors.text,
    opacity: 0.75,
    fontSize: fontSize.xs,
    letterSpacing: 0.7,
    fontWeight: '500',
  },
});
