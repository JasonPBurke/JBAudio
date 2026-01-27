import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
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
  useActiveTrack,
} from 'react-native-track-player';
import {
  Play,
  Pause,
  IterationCcw,
  IterationCw,
  Gauge,
  Bell,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import { colors } from '@/constants/tokens';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
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
import * as Haptics from 'expo-haptics';
import SleepTimerOptions from '../modals/SleepTimerOptions';
import CountdownTimer from './CountdownTimer';
import AnimatedZZZ from './animations/AnimatedZZZ';
import {
  getTimerSettings,
  updateSleepTime,
  updateTimerActive,
  updateTimerFadeoutDuration,
} from '@/db/settingsQueries';
import { recordFootprint } from '@/db/footprintQueries';
import { getBookById } from '@/db/bookQueries';
import { BookProgressState } from '@/helpers/handleBookPlay';
import database from '@/db';
import { useObserveSettings } from '@/hooks/useObserveSettings';
import {
  useIsPlayerPlaying,
  useRemainingSleepTimeMs,
  usePlayerStateStore,
} from '@/store/playerState';
import { useBookById } from '@/store/library';
import { findChapterIndexByPosition } from '@/helpers/singleFileBook';

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
  color?: string;
};

/**
 * Optimized PlayerControls component.
 * Wrapped in React.memo to prevent re-renders from parent.
 * Child button components use Reanimated for animations,
 * which don't cause React re-renders.
 */
export const PlayerControls = memo(({ style }: PlayerControlsProps) => {
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
});

PlayerControls.displayName = 'PlayerControls';

export function PlayPauseButton({
  style,
  iconSize = 50,
  top = 10,
  left = 10,
}: PlayerButtonProps) {
  const { colors: themeColors } = useTheme();
  const { playing } = useIsPlaying();
  const playButtonScale = useSharedValue(playing ? 0 : 1);
  const pauseButtonScale = useSharedValue(playing ? 1 : 0);

  const onButtonPress = async () => {
    if (playing) {
      playButtonScale.value = withTiming(1, { duration: 200 });
      pauseButtonScale.value = withTiming(0, { duration: 200 });
      await TrackPlayer.pause();
    } else {
      // Record footprint before playing
      try {
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (activeTrack?.bookId) {
          await recordFootprint(activeTrack.bookId, 'play');
        }
      } catch {
        // Silently fail if footprint recording fails
      }

      playButtonScale.value = withTiming(0, { duration: 200 });
      pauseButtonScale.value = withTiming(1, { duration: 200 });
      await TrackPlayer.seekBy(-1);
      await TrackPlayer.play();
    }
  };

  useEffect(() => {
    playButtonScale.value = playing ? 0 : 1;
    pauseButtonScale.value = playing ? 1 : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

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
          borderRadius: 50,
        },
        style,
      ]}
      onPress={onButtonPress}
    >
      <Animated.View style={animatedPlayButtonStyle}>
        <Play
          size={iconSize}
          color={themeColors.primary}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />
      </Animated.View>
      <Animated.View style={animatedPauseButtonStyle}>
        <Pause
          size={iconSize}
          color={themeColors.primary}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />
      </Animated.View>
    </Pressable>
  );
}

export function SeekBackButton({
  // style,
  iconSize = 30,
  top = 7,
  right = 12,
  fontSize,
  color,
}: PlayerButtonProps) {
  const seekDuration = 30;
  const rotation = useSharedValue(0);
  const iconColor = color ?? colors.icon;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}deg` }],
    };
  });

  const handlePress = async () => {
    rotation.value = withSequence(
      withTiming(4, { duration: 100 }),
      withTiming(-2, { duration: 100 }),
      withTiming(0, { duration: 100 }),
    );

    const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
    const currentPosition = await TrackPlayer.getProgress().then(
      (progress) => progress.position,
    );
    const newPosition = currentPosition - seekDuration;

    // Check if single-file book
    const queue = await TrackPlayer.getQueue();
    const isSingleFile = queue.length === 1;

    if (newPosition < 0) {
      if (isSingleFile || currentTrackIndex === 0) {
        // Single-file book or first track: clamp to start
        await TrackPlayer.seekTo(0);
      } else {
        // Multi-file book: skip to previous track and seek to appropriate position
        await TrackPlayer.skipToPrevious();
        const { duration } = await TrackPlayer.getProgress();
        await TrackPlayer.seekTo(duration + newPosition);
      }
    } else {
      await TrackPlayer.seekTo(newPosition);
    }
  };

  return (
    <Pressable style={{ padding: 10 }} onPress={handlePress}>
      <Animated.View style={animatedStyle}>
        <IterationCw
          size={iconSize}
          color={iconColor}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />

        <Text
          style={{
            ...styles.seekTime,
            fontSize: fontSize,
            top: top,
            right: right,
            color: iconColor,
            fontFamily: 'Rubik',
          }}
        >
          {seekDuration}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function SeekForwardButton({
  iconSize = 30,
  top = 7,
  right = 12,
  fontSize,
}: PlayerButtonProps) {
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
      withTiming(0, { duration: 100 }),
    );

    const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
    const queue = await TrackPlayer.getQueue();
    const { position, duration } = await TrackPlayer.getProgress();
    const newPosition = position + seekDuration;

    // Check if single-file book
    const isSingleFile = queue.length === 1;

    if (newPosition > duration) {
      if (
        isSingleFile ||
        (currentTrackIndex !== undefined &&
          currentTrackIndex === queue.length - 1)
      ) {
        // Single-file book or last track: mark as finished, reset and stop
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (activeTrack?.bookId) {
          const bookModel = await getBookById(activeTrack.bookId);
          if (bookModel) {
            await bookModel.updateBookProgress(BookProgressState.Finished);
          }
        }
        if (isSingleFile) {
          await TrackPlayer.seekTo(0);
        } else {
          await TrackPlayer.skip(0);
          await TrackPlayer.seekTo(0);
        }
        await TrackPlayer.pause();
      } else {
        // Multi-file book: skip to next track and seek to appropriate position
        const seekToTime = newPosition - duration;
        await TrackPlayer.skipToNext();
        await TrackPlayer.seekTo(seekToTime);
      }
    } else {
      await TrackPlayer.seekTo(position + seekDuration);
    }
  };

  return (
    <Pressable style={{ padding: 10 }} onPress={handlePress}>
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
}

export function SkipToPreviousButton({ iconSize = 30 }: PlayerButtonProps) {
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');

  const handlePress = async () => {
    const queue = await TrackPlayer.getQueue();
    const isSingleFile = queue.length === 1;

    if (isSingleFile && book?.chapters && book.chapters.length > 1) {
      // Single-file book: seek to previous chapter's startMs
      const { position } = await TrackPlayer.getProgress();
      const currentChapterIndex = findChapterIndexByPosition(
        book.chapters,
        position,
      );

      if (currentChapterIndex > 0) {
        // Seek to start of previous chapter
        const prevChapterStart =
          (book.chapters[currentChapterIndex - 1].startMs || 0) / 1000;
        await TrackPlayer.seekTo(prevChapterStart);
      } else {
        // At first chapter: seek to start
        await TrackPlayer.seekTo(0);
      }
    } else {
      // Multi-file book: use default behavior
      await TrackPlayer.skipToPrevious();
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
      <SkipBack
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />
    </TouchableOpacity>
  );
}

export function SkipToNextButton({ iconSize = 30 }: PlayerButtonProps) {
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');

  const handlePress = async () => {
    const queue = await TrackPlayer.getQueue();
    const isSingleFile = queue.length === 1;

    if (isSingleFile && book?.chapters && book.chapters.length > 1) {
      // Single-file book: seek to next chapter's startMs
      const { position } = await TrackPlayer.getProgress();
      const currentChapterIndex = findChapterIndexByPosition(
        book.chapters,
        position,
      );

      if (currentChapterIndex < book.chapters.length - 1) {
        // Seek to start of next chapter
        const nextChapterStart =
          (book.chapters[currentChapterIndex + 1].startMs || 0) / 1000;
        await TrackPlayer.seekTo(nextChapterStart);
      } else {
        // At last chapter: mark finished, reset and stop
        if (activeTrack?.bookId) {
          const bookModel = await getBookById(activeTrack.bookId);
          if (bookModel) {
            await bookModel.updateBookProgress(BookProgressState.Finished);
          }
        }
        await TrackPlayer.seekTo(0);
        await TrackPlayer.pause();
      }
    } else {
      // Multi-file book: use default behavior
      await TrackPlayer.skipToNext();
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
      <SkipForward
        size={iconSize}
        color={colors.icon}
        strokeWidth={1.5}
        absoluteStrokeWidth
      />
    </TouchableOpacity>
  );
}

export function PlaybackSpeed({ iconSize = 30 }: PlayerButtonProps) {
  const speedRates = [0.5, 1.0, 1.5];
  const [currentIndex, setCurrentIndex] = useState(1);

  const handleSpeedRate = async () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % speedRates.length);
    // await TrackPlayer.setRate(currentIndex);
  };

  return (
    <Pressable onPress={handleSpeedRate}>
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
          fontFamily: 'Rubik',
          color: colors.icon,
        }}
      >
        {speedRates[currentIndex]}x
      </Text>
    </Pressable>
  );
}

export function SleepTimer({ iconSize = 30 }: PlayerButtonProps) {
  const { colors: themeColors } = useTheme();
  const settings = useObserveSettings(database);
  const timerActive = settings?.timerActive === true;
  const chaptersCount: number | null = settings?.timerChapters ?? null;
  const sleepTime: number | null = settings?.sleepTime ?? null;
  const isPlaying = useIsPlayerPlaying();
  const remainingSleepTimeMs = useRemainingSleepTimeMs();

  // Optimistic UI state to reflect immediate press feedback
  const [optimistic, setOptimistic] = useState<{
    active: boolean;
    chapters: number | null;
    endTimeMs: number | null;
  } | null>(null);
  const uiActive = optimistic ? optimistic.active : timerActive;
  const uiChapters: number | null = optimistic
    ? optimistic.chapters
    : chaptersCount;
  // Combine optimistic endTimeMs with sleepTime from settings
  const uiSleepTime: number | null = optimistic?.endTimeMs ?? sleepTime;

  const [mountSheet, setMountSheet] = useState(false);
  const { bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['40%'], []);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const rotation = useSharedValue(0);
  const countdownOpacity = useSharedValue(0);
  const countdownScale = useSharedValue(0.8);

  // Reconcile optimistic UI with store updates
  useEffect(() => {
    setOptimistic(null);
  }, [settings]);

  useEffect(() => {
    if (uiActive) {
      countdownOpacity.value = withTiming(0.5, { duration: 300 });
      countdownScale.value = withTiming(1, { duration: 300 });
    } else {
      countdownOpacity.value = withTiming(0, { duration: 300 });
      countdownScale.value = withTiming(0.2, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiActive]);

  const animatedCountdownStyle = useAnimatedStyle(() => ({
    opacity: countdownOpacity.value,
    transform: [{ scale: countdownScale.value }],
  }));

  const animatedBellStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        pressBehavior={'close'}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const onOptimisticUpdate = useCallback(
    (next: {
      active: boolean;
      endTimeMs: number | null;
      chapters: number | null;
    }) => {
      setOptimistic(next);
    },
    [],
  );

  const handlePresentModalPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!mountSheet) setMountSheet(true);
    requestAnimationFrame(() => bottomSheetModalRef.current?.present());
  }, [mountSheet]);

  const handlePress = useCallback(async () => {
    const { timerDuration, timerActive, timerChapters, fadeoutDuration } =
      await getTimerSettings();

    // Helper to record timer activation footprint
    const recordTimerFootprintAsync = async () => {
      try {
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (activeTrack?.bookId) {
          await recordFootprint(activeTrack.bookId, 'timer_activation');
        }
      } catch {
        // Silently fail if footprint recording fails
      }
    };

    // Get current playing state and setRemainingSleepTimeMs from store
    const { isPlaying: currentlyPlaying, setRemainingSleepTimeMs } =
      usePlayerStateStore.getState();

    if (timerDuration !== null && timerActive === false) {
      // Activating duration timer
      if (currentlyPlaying) {
        // Player is playing - set sleepTime to start countdown
        setOptimistic({
          active: true,
          chapters: null,
          endTimeMs: Date.now() + timerDuration,
        });
        await updateSleepTime(Date.now() + timerDuration);
      } else {
        // Player is paused - freeze the timer by setting remainingSleepTimeMs
        setOptimistic({
          active: true,
          chapters: null,
          endTimeMs: null, // Pass null so CountdownTimer uses frozenTimeMs
        });
        setRemainingSleepTimeMs(timerDuration);
        await updateSleepTime(null);
      }

      await recordTimerFootprintAsync();
      await updateTimerActive(true);
      if (fadeoutDuration && fadeoutDuration > timerDuration) {
        await updateTimerFadeoutDuration(timerDuration);
      }
    } else if (timerDuration !== null && timerActive === true) {
      // Optimistically deactivate duration timer
      setOptimistic({ active: false, chapters: null, endTimeMs: null });
      await updateTimerActive(false);
      await updateSleepTime(null);
      await TrackPlayer.setVolume(1);
    } else if (timerChapters !== null && timerActive === false) {
      // Optimistically activate chapter timer
      setOptimistic({
        active: true,
        chapters: timerChapters ?? null,
        endTimeMs: null,
      });
      await recordTimerFootprintAsync();
      await updateTimerActive(true);
    } else if (timerChapters !== null && timerActive === true) {
      // Optimistically deactivate chapter timer
      setOptimistic({ active: false, chapters: null, endTimeMs: null });
      await TrackPlayer.setVolume(1);
      await updateTimerActive(false);
    } else if (timerDuration === null && timerActive === false) {
      handlePresentModalPress();
    }

    rotation.value = withSequence(
      withTiming(-10, { duration: 100 }),
      withTiming(10, { duration: 200 }),
      withTiming(0, { duration: 100 }),
    );
  }, [handlePresentModalPress]);

  return (
    <Pressable
      hitSlop={20}
      onPress={handlePress}
      onLongPress={handlePresentModalPress}
      delayLongPress={400}
    >
      {mountSheet && (
        <BottomSheetModal
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: themeColors.modalBackground }}
          style={{ paddingBottom: bottom + 10, marginBottom: bottom + 10 }}
          handleComponent={() => (
            <Pressable
              hitSlop={10}
              style={[
                styles.handleIndicator,
                {
                  backgroundColor: withOpacity(
                    themeColors.background,
                    0.66,
                  ),
                  borderColor: themeColors.textMuted,
                },
              ]}
              onPress={() => bottomSheetModalRef.current?.dismiss()}
            />
          )}
          enableDynamicSizing={false}
          backdropComponent={renderBackdrop}
          ref={bottomSheetModalRef}
          index={0}
          snapPoints={snapPoints}
        >
          <SleepTimerOptions
            bottomSheetModalRef={bottomSheetModalRef}
            onOptimisticUpdate={onOptimisticUpdate}
          />
        </BottomSheetModal>
      )}

      <Animated.View style={animatedBellStyle}>
        <Bell
          size={iconSize}
          color={uiActive ? themeColors.primary : themeColors.lightIcon}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />
        {uiActive && (
          <Animated.View
            style={[styles.countdownTimerContainer, animatedCountdownStyle]}
            pointerEvents='none'
          >
            <CountdownTimer
              timerChapters={uiChapters != null ? uiChapters + 1 : null}
              endTimeMs={uiSleepTime}
              frozenTimeMs={!isPlaying ? remainingSleepTimeMs : null}
            />
          </Animated.View>
        )}
      </Animated.View>
      {uiActive && isPlaying && <AnimatedZZZ timerActiveValue={uiActive} />}
    </Pressable>
  );
}

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
    borderRadius: 50,
    borderWidth: 1,
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
