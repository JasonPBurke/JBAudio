import React, { useEffect, useRef, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { AppState, View } from 'react-native';
// import { colors } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';

type AnimatedZZZProps = {
  /**
   * Timer is armed. Drives the tint only (primary, matching the bell) — it
   * does NOT decide whether we animate.
   */
  timerActive: boolean;
  /**
   * Run the staggered fade cycle. When false the z's stay mounted and settle
   * at restingOpacity() rather than unmounting.
   */
  animate: boolean;
};

// Resting opacities for the hint state (timer off). Deliberately staggered
// rather than equal: it freezes the pair mid-cycle — the lead z on its way
// out, the trailing z near peak — so the static hint implies the motion it
// stands in for. Dim enough to read as affordance, not active status.
const STATIC_OPACITY_1 = 0.5;
const STATIC_OPACITY_2 = 0.7;

// Where a z sits when the fade cycle isn't running.
//  - timer off      → its staggered hint opacity, showing what the bell does
//  - armed + paused → hidden; the countdown is frozen, so a resting z would
//                     wrongly imply the timer is still counting down
const restingOpacity = (timerActive: boolean, staticOpacity: number) =>
  timerActive ? 0 : staticOpacity;

const AnimatedZZZ = ({ timerActive, animate }: AnimatedZZZProps) => {
  // animate implies timerActive, so this is already 0 on an animating mount.
  const opacity1 = useSharedValue(
    restingOpacity(timerActive, STATIC_OPACITY_1),
  );
  const opacity2 = useSharedValue(
    restingOpacity(timerActive, STATIC_OPACITY_2),
  );
  // const opacity3 = useSharedValue(0);
  const { colors: themeColors } = useTheme();
  // Shared lightTextMuted keeps the hint z's subordinate to the primary-tinted
  // active ones, and reads on both light and dark mesh backgrounds.
  const zColor = timerActive
    ? themeColors.primary
    : themeColors.lightTextMuted;

  // Force the animation effect to re-run on background→active transitions.
  // Reanimated's global ReducedMotionConfig (in _layout.tsx) flips to
  // ReduceMotion.Always while backgrounded, which collapses any animation
  // created during that window to its final value. When shake-to-reset
  // re-arms the timer in the background, this component mounts with a
  // stuck animation; we need to recreate it once motion is restored.
  const [foregroundTick, setForegroundTick] = useState(0);
  const lastAppStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        lastAppStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        setForegroundTick((n) => n + 1);
      }
      lastAppStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (animate) {
      // Rewind to hidden BEFORE arming the loop. withRepeat captures its
      // startValue once, when the repeat begins, and restarts every
      // repetition from that captured value — so beginning at the static
      // hint opacity would make z1 run 0.6→1 and z2 run 0.6→0 on every
      // cycle, forever. The old conditional render got this for free by
      // remounting; now that we stay mounted, reset explicitly.
      opacity1.value = 0;
      opacity2.value = 0;

      // Start animations
      opacity1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.linear }),
          withTiming(0, { duration: 1500, easing: Easing.linear }),
          withTiming(0, { duration: 3000, easing: Easing.linear }),
        ),
        -1,
        false,
      );
      opacity2.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1500, easing: Easing.linear }),
          withTiming(1, { duration: 1500, easing: Easing.linear }),
          withTiming(0, { duration: 3000, easing: Easing.linear }),
        ),
        -1,
        false,
      );
      // opacity3.value = withRepeat(
      //   withSequence(
      //     withTiming(0, { duration: 3000, easing: Easing.linear }),
      //     withTiming(1, { duration: 1500, easing: Easing.linear }),
      //     withTiming(0, { duration: 1500, easing: Easing.linear }),
      //   ),
      //   -1,
      //   false,
      // );
    } else {
      // PROPERLY CANCEL animations before resetting, then park both z's at
      // the resting value for this state — the static hint when the timer is
      // off, fully hidden when it's armed but paused.
      cancelAnimation(opacity1);
      cancelAnimation(opacity2);
      // cancelAnimation(opacity3);
      opacity1.value = restingOpacity(timerActive, STATIC_OPACITY_1);
      opacity2.value = restingOpacity(timerActive, STATIC_OPACITY_2);
      // opacity3.value = 0;
    }

    // CRITICAL: Cleanup on unmount
    return () => {
      cancelAnimation(opacity1);
      cancelAnimation(opacity2);
      // cancelAnimation(opacity3);
    };
    // timerActive only ever changes in lockstep with animate (animate =
    // armed && playing), so listing it here can't restart a running loop
    // mid-cycle — it only re-picks the resting value.
  }, [animate, timerActive, foregroundTick, opacity1, opacity2]); //, opacity3

  const animatedStyle1 = useAnimatedStyle(() => {
    return { opacity: opacity1.value };
  });

  const animatedStyle2 = useAnimatedStyle(() => {
    return { opacity: opacity2.value };
  });

  // const animatedStyle3 = useAnimatedStyle(() => {
  //   return { opacity: opacity3.value };
  // });

  return (
    <View pointerEvents='none'>
      <Animated.Text
        style={[
          {
            position: 'absolute',
            bottom: 14,
            left: 22,
            fontSize: 10,
            color: zColor,
            fontFamily: 'Rubik',
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
            color: zColor,
            fontFamily: 'Rubik',
          },
          animatedStyle2,
        ]}
      >
        z
      </Animated.Text>
      {/* <Animated.Text
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
      </Animated.Text> */}
    </View>
  );
};

export default AnimatedZZZ;
