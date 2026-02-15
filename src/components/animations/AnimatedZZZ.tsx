import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { View } from 'react-native';
// import { colors } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';

type AnimatedZZZProps = {
  timerActiveValue: boolean;
};

const AnimatedZZZ = ({ timerActiveValue }: AnimatedZZZProps) => {
  const opacity1 = useSharedValue(0);
  const opacity2 = useSharedValue(0);
  // const opacity3 = useSharedValue(0);
  const { colors: themeColors } = useTheme();

  useEffect(() => {
    if (timerActiveValue) {
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
      // PROPERLY CANCEL animations before resetting
      cancelAnimation(opacity1);
      cancelAnimation(opacity2);
      // cancelAnimation(opacity3);
      opacity1.value = 0;
      opacity2.value = 0;
      // opacity3.value = 0;
    }

    // CRITICAL: Cleanup on unmount
    return () => {
      cancelAnimation(opacity1);
      cancelAnimation(opacity2);
      // cancelAnimation(opacity3);
    };
  }, [timerActiveValue, opacity1, opacity2]); //, opacity3

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
    <View>
      <Animated.Text
        style={[
          {
            position: 'absolute',
            bottom: 14,
            left: 22,
            fontSize: 10,
            color: themeColors.primary,
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
            color: themeColors.primary,
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
