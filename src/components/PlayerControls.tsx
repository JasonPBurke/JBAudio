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
import { pause, play, seekBy } from '@/player/trackPlayer';
import {
  Play,
  Pause,
  IterationCcw,
  IterationCw,
  CircleGauge,
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
import PlaybackSpeedOptions from '../modals/PlaybackSpeedOptions';
import { formatRate, resolveSpeedTap } from '@/helpers/playbackRate';
import CountdownTimer from './CountdownTimer';
import AnimatedZZZ from './animations/AnimatedZZZ';
import {
  recordActiveBookPlayFootprint,
  recordPreviousPressFootprint,
} from '@/helpers/activeBookFootprints';
import database from '@/db';
import { useObserveSettings } from '@/hooks/useObserveSettings';
import { resolveTimerGesture } from '@/helpers/sleepTimerSelection';
import { applyTimerCommand } from '@/setup/applyTimerCommand';
import { remainingChapterCount } from '@/helpers/remainingChapterCount';
import {
  useActiveBookId,
  useIsPlayerPlaying,
  usePlayerStateStore,
} from '@/store/playerState';
import { useSleepTimer } from '@/hooks/useSleepTimer';
import { useBookById } from '@/store/library';
import { useSettingsStore } from '@/store/settingsStore';
import { seekBack, seekForward } from '@/helpers/relativeSeek';
import { skipToPreviousChapter } from '@/helpers/chapterSkip';
import { pressNext } from '@/helpers/nextPress';

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
  // Icon source is the store, not RNTP's event-only useIsPlaying(). The store
  // is force-refreshed on foreground (PlayerStateSync), so the icon is correct
  // on resume instead of showing a stale glyph until events re-deliver.
  const playing = useIsPlayerPlaying();
  const playButtonScale = useSharedValue(playing ? 0 : 1);
  const pauseButtonScale = useSharedValue(playing ? 1 : 0);

  // Optimistic-with-reconcile: act on the user's intent (the opposite of what
  // they see) instantly. We flip the store immediately — the crossfade effect
  // below animates the icon — and fire the command without awaiting anything,
  // so the press never waits on a slow bridge (e.g. right after resume). The
  // engine's PlaybackState event reconciles the store back to truth via
  // PlayerStateSync a beat later (and corrects us if the command failed).
  const onButtonPress = () => {
    const intent = !playing; // true => start playing
    usePlayerStateStore.getState().setIsPlaying(intent);

    if (intent) {
      (async () => {
        await recordActiveBookPlayFootprint();
        // QoL: repeat 1s of audio on resume.
        await seekBy(-1);
        await play();
      })();
    } else {
      pause();
    }
  };

  // Reconcile: animate the crossfade whenever the store's playing state
  // changes — whether from our optimistic write above or from the engine's
  // event landing in PlayerStateSync. Using withTiming here (not an instant
  // assignment) means external state changes animate smoothly too.
  useEffect(() => {
    playButtonScale.value = withTiming(playing ? 0 : 1, { duration: 200 });
    pauseButtonScale.value = withTiming(playing ? 1 : 0, { duration: 200 });
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
  const seekDuration = useSettingsStore((s) => s.skipBackDuration);
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

    // Shared with the RemoteJumpBackward handler in setup/service.ts so the
    // in-app button, notification and Android Auto all cross chapter
    // boundaries identically.
    await seekBack(seekDuration);
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
          allowFontScaling={false}
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
  const seekDuration = useSettingsStore((s) => s.skipForwardDuration);
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

    // Shared with the RemoteJumpForward handler in setup/service.ts so the
    // in-app button, notification and Android Auto all cross chapter
    // boundaries identically.
    await seekForward(seekDuration);
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
          allowFontScaling={false}
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
  const activeBookId = useActiveBookId();

  const handlePress = async () => {
    // Shared with the RemotePrevious handler in setup/service.ts: >15s into
    // a chapter restarts it, within the first 15s goes to the previous
    // chapter — notification, Android Auto and in-app behave identically.
    //
    // The footprint is the second half of "identically", and it is the same
    // call the service makes: the PRESS TYPE decides whether a breadcrumb is
    // written, not which surface the press arrived from. The label has to
    // come from the resolved kind, because a restart and a chapter change
    // are the same press until `skipToPreviousChapter` decides.
    await skipToPreviousChapter((kind) =>
      recordPreviousPressFootprint(activeBookId, kind),
    );
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
  const activeBookId = useActiveBookId();
  const book = useBookById(activeBookId ?? '');

  const handlePress = async () => {
    // Nothing loaded, so there is no press to make. Event.RemoteNext falls
    // back to a bare skipToNext() here instead, because a remote press can
    // arrive on the cold-start path before any Book is active; a button the
    // user can see cannot be in that state.
    if (!activeBookId) return;

    // The whole press — the chapter/skip/finish/none decision, the footprint
    // that has to be written BEFORE the transport call, the already-Finished
    // guard and the rewind — lives in helpers/nextPress.ts, which is also
    // what Event.RemoteNext calls. This button used to carry its own copy,
    // and that copy had drifted in five ways by the time it was noticed.
    await pressNext(activeBookId, book);
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

// Gauge needle choreography: the icon rests rotated -45° when inactive
// (rate = 1x) and sweeps to 0° when a custom speed is active.
const GAUGE_INACTIVE_DEG = -45;
const GAUGE_ACTIVE_DEG = 0;

export function PlaybackSpeed({ iconSize = 30 }: PlayerButtonProps) {
  const { colors: themeColors } = useTheme();
  const rate = useSettingsStore((s) => s.playbackRate);
  const setPlaybackRate = useSettingsStore((s) => s.setPlaybackRate);
  const isActive = rate !== 1;

  const [mountSheet, setMountSheet] = useState(false);
  const { bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['20%'], []);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const rotation = useSharedValue(
    isActive ? GAUGE_ACTIVE_DEG : GAUGE_INACTIVE_DEG,
  );
  const labelOpacity = useSharedValue(0);
  const labelScale = useSharedValue(0.8);
  const didMount = useRef(false);

  // State-driven (not press-driven): activation always originates in the
  // sheet — tap at 1x only opens it — so animate on the rate transition.
  useEffect(() => {
    if (!didMount.current) {
      // No mount wiggle: snap straight to the resting pose.
      didMount.current = true;
      rotation.value = isActive ? GAUGE_ACTIVE_DEG : GAUGE_INACTIVE_DEG;
      labelOpacity.value = isActive ? 0.5 : 0;
      labelScale.value = isActive ? 1 : 0.2;
      return;
    }
    if (isActive) {
      // Rock slightly left, then sweep right to the active pose
      rotation.value = withSequence(
        withTiming(GAUGE_INACTIVE_DEG - 10, { duration: 100 }),
        withTiming(GAUGE_ACTIVE_DEG, { duration: 250 }),
      );
      labelOpacity.value = withTiming(0.5, { duration: 300 });
      labelScale.value = withTiming(1, { duration: 300 });
    } else {
      // Mirror: rock slightly right, then sweep back to rest
      rotation.value = withSequence(
        withTiming(GAUGE_ACTIVE_DEG + 10, { duration: 100 }),
        withTiming(GAUGE_INACTIVE_DEG, { duration: 250 }),
      );
      labelOpacity.value = withTiming(0, { duration: 300 });
      labelScale.value = withTiming(0.2, { duration: 300 });
    }
  }, [isActive, rotation, labelOpacity, labelScale]);

  const animatedGaugeStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ scale: labelScale.value }],
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

  const handlePresentModalPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!mountSheet) setMountSheet(true);
    requestAnimationFrame(() => bottomSheetModalRef.current?.present());
  }, [mountSheet]);

  const handlePress = useCallback(() => {
    // Active → 1x; at 1x → restore the saved speed; nothing saved yet
    // (fresh install) → open the options sheet. See resolveSpeedTap.
    const { playbackRate, lastNonDefaultRate } =
      useSettingsStore.getState();
    const action = resolveSpeedTap(playbackRate, lastNonDefaultRate);
    if (action.kind === 'set') {
      setPlaybackRate(action.rate);
    } else {
      handlePresentModalPress();
    }
  }, [setPlaybackRate, handlePresentModalPress]);

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
                styles.speedSheetHandle,
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
          <PlaybackSpeedOptions />
        </BottomSheetModal>
      )}

      {/* Label lives OUTSIDE the rotating view — the gauge holds a
          persistent tilt, and the text must stay level. */}
      <Animated.View style={animatedGaugeStyle}>
        <CircleGauge
          size={iconSize}
          color={isActive ? themeColors.primary : themeColors.lightIcon}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />
      </Animated.View>
      {isActive && (
        <Animated.View
          style={[styles.speedLabelContainer, animatedLabelStyle]}
          pointerEvents='none'
        >
          <Text allowFontScaling={false} style={styles.speedLabelText}>
            {formatRate(rate)}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

export function SleepTimer({ iconSize = 30 }: PlayerButtonProps) {
  // Defer the WatermelonDB settings subscription until the slide-in
  // settles. The Zustand `useSleepTimer` store already provides live
  // state for the bell icon; the DB row is only needed for the
  // user-configured `timerDuration` (which gates single-tap activation
  // vs. opening the modal). Within the slide window, that field stays
  // null and a single tap opens the modal — acceptable, since a tap
  // landing inside the slide window is essentially impossible.
  const [settingsEnabled, setSettingsEnabled] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSettingsEnabled(true), 250);
    return () => clearTimeout(id);
  }, []);

  const { colors: themeColors } = useTheme();
  const settings = useObserveSettings(settingsEnabled ? database : null);
  const isPlaying = useIsPlayerPlaying();

  // Live timer state from the sleep timer module (updated immediately on activate/cancel)
  const {
    isActive: storeActive,
    endTimeMs: storeEndTimeMs,
    frozenRemainingMs,
    remainingChapters: storeChapters,
  } = useSleepTimer();

  // Store takes precedence for live updates; DB observation is the fallback for initial state
  const uiActive = storeActive || settings?.timerActive === true;
  // The countdown pill shows what is LEFT, so it reads the remaining count and
  // never the dialed one. Reading `timerChapters` here is what put "ch 2" over
  // the bell the moment the stepper was touched, while a duration timer was the
  // thing actually running.
  const uiChapters: number | null =
    storeChapters ?? settings?.chaptersRemaining ?? null;
  const uiSleepTime: number | null =
    storeEndTimeMs ?? settings?.sleepTime ?? null;
  const timerDuration: number | null = settings?.timerDuration ?? null;

  const [mountSheet, setMountSheet] = useState(false);
  const { bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['40%'], []);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const rotation = useSharedValue(0);
  const countdownOpacity = useSharedValue(0);
  const countdownScale = useSharedValue(0.8);

  useEffect(() => {
    if (uiActive) {
      countdownOpacity.value = withTiming(0.5, { duration: 300 });
      countdownScale.value = withTiming(1, { duration: 300 });
    } else {
      countdownOpacity.value = withTiming(0, { duration: 300 });
      countdownScale.value = withTiming(0.2, { duration: 300 });
    }
  }, [uiActive, countdownOpacity, countdownScale]);

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

  const handlePresentModalPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!mountSheet) setMountSheet(true);
    requestAnimationFrame(() => bottomSheetModalRef.current?.present());
  }, [mountSheet]);

  const handlePress = useCallback(async () => {
    // The bell ARMS. It never writes a selection, which is what makes
    // "disarm from the icon and the highlight stays" true — the command below
    // carries an empty patch by construction.
    const command = resolveTimerGesture(
      {
        mode: settings?.timerMode ?? null,
        durationMs: timerDuration,
        chapters: settings?.timerChapters ?? null,
        active: uiActive,
      },
      // Bounded by the book so a chapter count the current book has outgrown
      // arms at the latest end it can still offer, rather than never firing.
      { kind: 'bell', ceiling: await remainingChapterCount() },
      'modal',
    );

    if ((await applyTimerCommand(command)).kind === 'openOptions') {
      handlePresentModalPress();
    }

    rotation.value = withSequence(
      withTiming(-10, { duration: 100 }),
      withTiming(10, { duration: 200 }),
      withTiming(0, { duration: 100 }),
    );
  }, [
    uiActive,
    timerDuration,
    settings?.timerMode,
    settings?.timerChapters,
    handlePresentModalPress,
    rotation,
  ]);

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
          <SleepTimerOptions bottomSheetModalRef={bottomSheetModalRef} />
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
              frozenTimeMs={frozenRemainingMs}
            />
          </Animated.View>
        )}
      </Animated.View>
      {/* Always mounted. The z's only cycle while the timer is actually
          counting down (armed + playing); otherwise they rest statically at
          the same spots, so the bell's purpose reads with the timer off. */}
      <AnimatedZZZ timerActive={uiActive} animate={uiActive && isPlaying} />
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
  speedLabelContainer: {
    position: 'absolute',
    top: -20,
    left: -8,
    width: 42,
    alignItems: 'center',
  },
  // Mirrors CountdownTimer's timerText over the sleep-timer bell
  speedLabelText: {
    fontFamily: 'Rubik',
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.7,
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
  // The 20% speed sheet trims the handle margins the 40% timer sheet keeps
  speedSheetHandle: {
    marginTop: 8,
    marginBottom: 2,
  },
});
