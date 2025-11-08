import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ViewStyle,
  Pressable,
} from 'react-native';
import TrackPlayer, {
  useIsPlaying,
  // useProgress,
} from 'react-native-track-player';
import {
  Play,
  Pause,
  IterationCcw,
  IterationCw,
  Gauge,
  Bell,
  // Hourglass,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import { colors } from '@/constants/tokens';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SleepTimerOptions from './SleepTimerOptions';
import Settings from '@/db/models/Settings';
import { getTimerSettings, updateTimerActive } from '@/db/settingsQueries';
import { useDatabase, withObservables } from '@nozbe/watermelondb/react';
import database from '@/db';
import { useObserveWatermelonData } from '@/hooks/useObserveWatermelonData';

type PlayerControlsProps = {
  style?: ViewStyle;
};

type PlayerButtonProps = {
  style?: ViewStyle;
  iconSize?: number;
  fontSize?: number;
  top?: number;
  right?: number;
  left?: number;
};

export const PlayerControls = ({ style }: PlayerControlsProps) => {
  return (
    <View style={[styles.controlsContainer, style]}>
      <View style={styles.playerRow}>
        <PlaybackSpeed iconSize={25} />
        <SeekBackButton iconSize={42} top={17} right={22} fontSize={15} />

        <PlayPauseButton iconSize={70} />

        <SeekForwardButton
          iconSize={42}
          top={17}
          right={22}
          fontSize={15}
        />
        <SleepTimer iconSize={25} />
      </View>
    </View>
  );
};

export const PlayPauseButton = ({
  style,
  iconSize = 50,
  top = 10,
  left = 10,
}: PlayerButtonProps) => {
  const { playing } = useIsPlaying();
  const playButtonScale = useSharedValue(playing ? 0 : 1);
  const pauseButtonScale = useSharedValue(playing ? 1 : 0);

  const onButtonPress = async () => {
    if (playing) {
      playButtonScale.value = withTiming(1, { duration: 200 });
      pauseButtonScale.value = withTiming(0, { duration: 200 });
      await TrackPlayer.pause();
    } else {
      playButtonScale.value = withTiming(0, { duration: 200 });
      pauseButtonScale.value = withTiming(1, { duration: 200 });
      await TrackPlayer.play();
    }
  };

  // Initialize scales on mount and update if 'playing' changes externally
  useEffect(() => {
    playButtonScale.value = playing ? 0 : 1;
    pauseButtonScale.value = playing ? 1 : 0;
  }, [playing, playButtonScale, pauseButtonScale]); // Re-run effect if playing reference changes

  const animatedPlayButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: playButtonScale.value,
      transform: [{ scale: playButtonScale.value }],
      position: 'absolute',
      left: left,
      top: top,
    };
  });

  const animatedPauseButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: pauseButtonScale.value,
      transform: [{ scale: pauseButtonScale.value }],
      position: 'absolute',
      left: left,
      top: top,
    };
  });

  return (
    <Pressable
      style={[
        {
          height: iconSize * 1.35,
          width: iconSize * 1.35,
        },
        style,
      ]}
      // hitSlop={30}
      onPress={onButtonPress}
    >
      <Animated.View style={animatedPlayButtonStyle}>
        <Play
          size={iconSize}
          color={colors.primary}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />
      </Animated.View>
      <Animated.View style={animatedPauseButtonStyle}>
        <Pause
          size={iconSize}
          color={colors.primary}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />
      </Animated.View>
    </Pressable>
  );
};

export const SeekBackButton = ({
  iconSize = 30,
  top = 7,
  right = 12,
  fontSize,
}: PlayerButtonProps) => {
  const seekDuration = 30;

  return (
    <Pressable
      style={{ padding: 10 }}
      // hitSlop={30}
      onPress={async () => {
        const currentPosition = await TrackPlayer.getProgress().then(
          (progress) => progress.position
        );
        const newPosition = currentPosition - seekDuration;

        if (newPosition < 0) {
          await TrackPlayer.skipToPrevious();
          const { duration } = await TrackPlayer.getProgress();
          //? newPosition is negative, so we need to add it to the duration
          await TrackPlayer.seekTo(duration + newPosition);
        } else {
          await TrackPlayer.seekTo(newPosition);
        }
      }}
    >
      <IterationCw
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />

      <Text
        style={{
          ...styles.seekTime,
          fontSize: fontSize,
          top: top,
          right: right,
          color: colors.icon,
        }}
      >
        {seekDuration}
      </Text>
    </Pressable>
  );
};

export const SeekForwardButton = ({
  iconSize = 30,
  top = 7,
  right = 12,
  fontSize,
}: PlayerButtonProps) => {
  const seekDuration = 30;

  return (
    <Pressable
      style={{ padding: 10 }}
      // hitSlop={30}
      onPress={async () => {
        const { position, duration } = await TrackPlayer.getProgress();
        const newPosition = position + seekDuration;

        if (newPosition > duration) {
          const seekToTime = newPosition - duration;
          await TrackPlayer.skipToNext();
          //? newPosition is negative, so we need to add it to the duration
          await TrackPlayer.seekTo(seekToTime);
        } else {
          await TrackPlayer.seekTo(position + seekDuration);
        }
      }}
    >
      <IterationCcw
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />

      <Text
        style={{
          ...styles.seekTime,
          fontSize: fontSize,
          top: top,
          right: right,
          color: colors.icon,
        }}
      >
        {seekDuration}
      </Text>
    </Pressable>
  );
};

export const SkipToPreviousButton = ({
  iconSize = 30,
}: PlayerButtonProps) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => TrackPlayer.skipToPrevious()}
    >
      <SkipBack
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />
    </TouchableOpacity>
  );
};

export const SkipToNextButton = ({ iconSize = 30 }: PlayerButtonProps) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => TrackPlayer.skipToNext()}
    >
      <SkipForward
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />
    </TouchableOpacity>
  );
};

export const PlaybackSpeed = ({ iconSize = 30 }: PlayerButtonProps) => {
  const speedRates = [0.5, 1.0, 1.5];
  const [currentIndex, setCurrentIndex] = useState(1);

  const handleSpeedRate = async () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % speedRates.length);
    //! crashing app...look at docs for implementation
    // await TrackPlayer.setRate(currentIndex);
    // console.log('currentSpeedIndex', currentIndex);
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handleSpeedRate}>
      <Gauge
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />

      <Text
        style={{
          position: 'absolute',
          bottom: 14,
          left: 22,
          fontSize: 10,
          color: colors.icon,
        }}
      >
        {speedRates[currentIndex]}x
      </Text>
    </TouchableOpacity>
  );
};

export const SleepTimer = ({ iconSize = 30 }: PlayerButtonProps) => {
  const isTimerActive = useObserveWatermelonData(database, 'settings');
  const timerActiveValue = isTimerActive?.[0]?.timerActive;
  const { bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['40%'], []);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const rotation = useSharedValue(0); // For Hourglass rotation
  const opacity1 = useSharedValue(0);
  const opacity2 = useSharedValue(0);
  const opacity3 = useSharedValue(0);

  // console.log('in SleepTimer');

  useEffect(() => {
    if (timerActiveValue) {
      opacity1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.linear }),
          withTiming(0, { duration: 1500, easing: Easing.linear }),
          withTiming(0, { duration: 3000, easing: Easing.linear }) // Hold for 2nd and 3rd z to fade in/out
        ),
        -1,
        false
      );
      opacity2.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1500, easing: Easing.linear }), // Delay for first z
          withTiming(1, { duration: 1500, easing: Easing.linear }),
          withTiming(0, { duration: 1500, easing: Easing.linear }),
          withTiming(0, { duration: 1500, easing: Easing.linear }) // Hold for 3rd z to fade in/out
        ),
        -1,
        false
      );
      opacity3.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 3000, easing: Easing.linear }), // Delay for first and second z
          withTiming(1, { duration: 1500, easing: Easing.linear }),
          withTiming(0, { duration: 1500, easing: Easing.linear })
        ),
        -1,
        false
      );
    } else {
      opacity1.value = 0;
      opacity2.value = 0;
      opacity3.value = 0;
    }
  }, [timerActiveValue, opacity1, opacity2, opacity3]);

  const animatedStyle1 = useAnimatedStyle(() => {
    return { opacity: opacity1.value };
  });

  const animatedStyle2 = useAnimatedStyle(() => {
    return { opacity: opacity2.value };
  });

  const animatedStyle3 = useAnimatedStyle(() => {
    return { opacity: opacity3.value };
  });

  const animatedBellStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}deg` }],
    };
  });

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        pressBehavior={'close'}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  const handlePress = async () => {
    const { timerDuration, timerActive, timerChapters } =
      await getTimerSettings();
    if (timerDuration !== null && timerActive === false) {
      await updateTimerActive(true);
    } else if (timerDuration !== null && timerActive === true) {
      await updateTimerActive(false);
    } else if (timerChapters !== null && timerActive === false) {
      await updateTimerActive(true);
    } else if (timerChapters !== null && timerActive === true) {
      await updateTimerActive(false);
    } else if (timerDuration === null && timerActive === false) {
      handlePresentModalPress();
    }
    rotation.value = withSequence(
      withTiming(-10, { duration: 100 }),
      withTiming(10, { duration: 200 }),
      withTiming(0, { duration: 100 })
      //! for Hourglass rotation
      // rotation.value = withTiming(rotation.value + 180, { duration: 300 });
    );
  };

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      onLongPress={handlePresentModalPress}
    >
      <BottomSheetModal
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#151520' }}
        style={{ paddingBottom: bottom + 10, marginBottom: bottom + 10 }}
        handleIndicatorStyle={{
          // backgroundColor: colors.textMuted,
          borderColor: colors.textMuted,
          borderWidth: StyleSheet.hairlineWidth,
        }}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
      >
        <SleepTimerOptions bottomSheetModalRef={bottomSheetModalRef} />
      </BottomSheetModal>

      <Animated.View style={animatedBellStyle}>
        <Bell
          size={iconSize}
          color={timerActiveValue ? colors.primary : colors.icon}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />
      </Animated.View>
      {/* {timerActiveValue && (
        <View>
          <Animated.Text
            style={[
              {
                position: 'absolute',
                bottom: 14,
                left: 22,
                fontSize: 10,
                color: colors.primary,
              },
              animatedStyle1,
            ]}
          >
            z
          </Animated.Text>
          <Animated.Text
            style={[
              {
                position: 'absolute',
                bottom: 17,
                left: 28,
                fontSize: 11,
                color: colors.primary,
              },
              animatedStyle2,
            ]}
          >
            z
          </Animated.Text>
          <Animated.Text
            style={[
              {
                position: 'absolute',
                bottom: 21,
                left: 34,
                fontSize: 12,
                color: colors.primary,
              },
              animatedStyle3,
            ]}
          >
            z
          </Animated.Text>
        </View>
      )} */}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  controlsContainer: {
    width: '100%',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  seekTime: {
    position: 'absolute',
  },
});
