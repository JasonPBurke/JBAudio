import { useEffect, useState, useCallback } from 'react';
import {
  StyleProp,
  TextStyle,
  NativeSyntheticEvent,
  TextLayoutEventData,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type MovingTextProps = {
  text: string;
  animationThreshold: number;
  containerWidth: number;
  style?: StyleProp<TextStyle>;
};

export const MovingText = ({
  text,
  animationThreshold,
  containerWidth,
  style,
}: MovingTextProps) => {
  const translateX = useSharedValue(0);
  const [textWidth, setTextWidth] = useState(0);
  const shouldAnimate =
    text.length >= animationThreshold &&
    containerWidth > 0 &&
    textWidth > containerWidth;
  const scrollDistance = shouldAnimate ? textWidth - containerWidth + 20 : 0;

  const handleTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const { lines } = event.nativeEvent;
      if (lines.length > 0) {
        setTextWidth(lines[0].width);
      }
    },
    []
  );

  useEffect(() => {
    if (!shouldAnimate) return;

    translateX.value = withDelay(
      1000,
      withRepeat(
        withTiming(-scrollDistance, { duration: 5000, easing: Easing.linear }),
        1,
        true
      )
    );
    return () => {
      cancelAnimation(translateX);
      translateX.value = 0;
    };
  }, [translateX, text, animationThreshold, shouldAnimate, scrollDistance]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <Animated.Text
      numberOfLines={1}
      onTextLayout={handleTextLayout}
      style={[
        style,
        animatedStyle,
        shouldAnimate && {
          width: 9999,
        },
      ]}
    >
      {text}
    </Animated.Text>
  );
};
