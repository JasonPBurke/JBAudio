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
  // Note: No reset useEffect needed - key={text} remounts component with fresh state

  const shouldAnimate =
    text.length >= animationThreshold &&
    containerWidth > 0 &&
    textWidth > containerWidth;
  const scrollDistance = shouldAnimate
    ? textWidth - containerWidth + 20
    : 0;

  // Diagnostic logging
  useEffect(() => {
    console.log('[MovingText] Debug:', {
      text: text.substring(0, 30),
      textLength: text.length,
      animationThreshold,
      containerWidth,
      textWidth,
      shouldAnimate,
      scrollDistance,
      appliedWidth: textWidth > 0 ? textWidth : 9999,
    });
  }, [
    text,
    animationThreshold,
    containerWidth,
    textWidth,
    shouldAnimate,
    scrollDistance,
  ]);

  const handleTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const { lines } = event.nativeEvent;
      console.log('[MovingText] onTextLayout fired:', {
        text: text.substring(0, 20),
        linesLength: lines.length,
        lineWidth: lines[0]?.width ?? 'no lines',
      });
      if (lines.length > 0) {
        setTextWidth(lines[0].width);
      }
    },
    [text],
  );

  useEffect(() => {
    if (!shouldAnimate) return;

    translateX.value = withDelay(
      1000,
      withRepeat(
        withTiming(-scrollDistance, {
          duration: 12000,
          easing: Easing.linear,
        }),
        2,
        true,
      ),
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
      key={text} // Force new component on text change to ensure onTextLayout fires
      numberOfLines={1}
      onTextLayout={handleTextLayout}
      style={[
        style,
        animatedStyle,
        {
          // Use 9999 for initial measurement, then actual textWidth for proper layout
          width: textWidth > 0 ? textWidth + 8 : 9999,
        },
      ]}
    >
      {text}
    </Animated.Text>
  );
};
