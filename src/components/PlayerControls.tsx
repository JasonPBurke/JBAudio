import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  ViewStyle,
  Pressable,
} from 'react-native';
import TrackPlayer, { useIsPlaying } from 'react-native-track-player';
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
} from 'react-native-reanimated';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SleepTimerOptions from '../modals/SleepTimerOptions';
import CountdownTimer from './CountdownTimer';
import AnimatedZZZ from './animations/AnimatedZZZ';
import {
  getTimerSettings,
  updateSleepTime,
  updateTimerActive,
} from '@/db/settingsQueries';
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
        <SeekBackButton iconSize={42} top={6} right={12} fontSize={15} />

        <PlayPauseButton iconSize={70} />

        <SeekForwardButton iconSize={42} top={6} right={12} fontSize={15} />
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
      await TrackPlayer.setVolume(0);
      setTimeout(async () => {
        await TrackPlayer.pause();
      }, 100);
    } else {
      playButtonScale.value = withTiming(0, { duration: 200 });
      pauseButtonScale.value = withTiming(1, { duration: 200 });
      await TrackPlayer.play();
      await TrackPlayer.setVolume(0.5);
      setTimeout(async () => {
        await TrackPlayer.setVolume(1);
      }, 100);
    }
  };

  useEffect(() => {
    playButtonScale.value = playing ? 0 : 1;
    pauseButtonScale.value = playing ? 1 : 0;
  }, [playing, playButtonScale, pauseButtonScale]);
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
      // android_ripple={{
      //   color: '#cccccc28',
      // }}
      style={[
        {
          height: iconSize * 1.35,
          width: iconSize * 1.35,
          // borderColor: 'red',
          // borderWidth: 1,
          borderRadius: 50,
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
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}deg` }],
    };
  });

  const handlePress = async () => {
    rotation.value = withSequence(
      withTiming(4, { duration: 100 }),
      withTiming(-2, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );

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
  };

  return (
    <Pressable
      // android_ripple={{
      //   color: '#cccccc28',
      // }}
      style={{ padding: 10 }}
      // hitSlop={30}
      onPress={handlePress}
    >
      <Animated.View style={animatedStyle}>
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
      </Animated.View>
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
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}deg` }],
    };
  });

  const handlePress = async () => {
    rotation.value = withSequence(
      withTiming(-4, { duration: 100 }),
      withTiming(2, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );

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
  };

  return (
    <Pressable
      // android_ripple={{
      //   color: '#cccccc28',
      // }}
      style={{ padding: 10 }}
      // hitSlop={30}
      onPress={handlePress}
    >
      <Animated.View style={animatedStyle}>
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
      </Animated.View>
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
    <Pressable
      // android_ripple={{
      //   color: '#cccccc28',
      // }}
      onPress={handleSpeedRate}
    >
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
    </Pressable>
  );
};

export const SleepTimer = ({ iconSize = 30 }: PlayerButtonProps) => {
  const settingsCollection = useObserveWatermelonData(database, 'settings');
  const timerActiveValue = settingsCollection?.[0]?.timerActive;
  const timerDuration: number | null =
    settingsCollection?.[0]?.timerDuration;
  const timerChapters: number | null =
    settingsCollection?.[0]?.timerChapters;
  const { bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['40%'], []);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const rotation = useSharedValue(0); // For Hourglass rotation
  const countdownOpacity = useSharedValue(0);
  const countdownScale = useSharedValue(0.8);

  useEffect(() => {
    if (timerActiveValue) {
      countdownOpacity.value = withTiming(0.5, { duration: 300 });
      countdownScale.value = withTiming(1, { duration: 300 });
    } else {
      countdownOpacity.value = withTiming(0, { duration: 300 });
      countdownScale.value = withTiming(0.2, { duration: 300 });
    }
  }, [timerActiveValue, countdownOpacity, countdownScale]);

  const animatedCountdownStyle = useAnimatedStyle(() => {
    return {
      opacity: countdownOpacity.value,
      transform: [{ scale: countdownScale.value }],
    };
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
      //! THIS RESETS THE TIMER..IF I WANT TO USE THIS TO PAUSE THE TIMER AND LET IT
      //! RESUME ON ACTIVATE PRESS, I NEED TO STORE THE TIMER DURATION MINUS ELAPSED
      //! TIME IN THE DB
      await updateSleepTime(Date.now() + timerDuration);
    } else if (timerDuration !== null && timerActive === true) {
      await updateTimerActive(false);
      await updateSleepTime(null);
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
    <Pressable
      // android_ripple={{
      //   color: '#cccccc28',
      // }}
      hitSlop={20}
      onPress={handlePress}
      onLongPress={handlePresentModalPress}
    >
      <BottomSheetModal
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#151520' }}
        style={{ paddingBottom: bottom + 10, marginBottom: bottom + 10 }}
        handleComponent={() => {
          return (
            <Pressable
              hitSlop={10}
              style={styles.handleIndicator}
              onPress={() => bottomSheetModalRef.current?.dismiss()}
            />
          );
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
        {timerActiveValue && (
          <Animated.View
            style={[styles.countdownTimerContainer, animatedCountdownStyle]}
          >
            <CountdownTimer
              initialMilliseconds={timerDuration || 0}
              timerChapters={timerChapters! + 1 || null}
            />
          </Animated.View>
        )}
      </Animated.View>
      {timerActiveValue && (
        <AnimatedZZZ timerActiveValue={timerActiveValue} />
      )}
    </Pressable>
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
  countdownTimerContainer: {
    position: 'absolute',
    top: -20,
    left: -8,
    width: 32,
  },
  handleIndicator: {
    marginBottom: 6,
    marginTop: 12,
    width: 55,
    height: 7,
    backgroundColor: '#1c1c1ca9',
    borderRadius: 50,
    borderColor: colors.textMuted,
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
