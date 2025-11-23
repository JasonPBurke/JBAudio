import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles, utilsStyles } from '@/styles';
import { useEffect, useState } from 'react';

export const PlayerProgressBar = ({ style }: ViewProps) => {
  const { duration, position } = useProgress(250);

  const [bubbleElapsedTime, setBubbleElapsedTime] = useState(
    formatSecondsToMinutes(position)
  );
  const [trackElapsedTime, setTrackElapsedTime] = useState(
    formatSecondsToMinutes(position)
  );
  const [trackRemainingTime, setTrackRemainingTime] = useState(
    formatSecondsToMinutes(duration - position)
  );

  const isSliding = useSharedValue(false);
  const progress = useSharedValue(0);
  const min = useSharedValue(0);
  const max = useSharedValue(1);

  if (!isSliding.value) {
    progress.value = duration > 0 ? position / duration : 0;
  }

  useEffect(() => {
    if (!isSliding.value) {
      setTrackElapsedTime(formatSecondsToMinutes(position));
      setTrackRemainingTime(formatSecondsToMinutes(duration - position));
    }
  }, [position, duration, isSliding.value]);

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
          // cacheTrackTintColor: '#333',
        }}
        thumbTouchSize={20}
        thumbWidth={13}
        renderBubble={() => (
          <View
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              flex: 1,
            }}
          >
            <Text style={{ color: colors.textMuted }}>
              {bubbleElapsedTime}
            </Text>
          </View>
        )}
        onSlidingStart={() => (isSliding.value = true)}
        onSlidingComplete={async (value) => {
          if (!isSliding.value) return;
          isSliding.value = false;

          await TrackPlayer.seekTo(value * duration);
          setTrackElapsedTime(formatSecondsToMinutes(value * duration));
          setTrackRemainingTime(
            formatSecondsToMinutes(duration - value * duration)
          );
        }}
        onValueChange={(value) => {
          setBubbleElapsedTime(formatSecondsToMinutes(value * duration));
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
};

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
