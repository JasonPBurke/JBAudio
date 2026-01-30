import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import TextTicker from 'react-native-text-ticker';

export type TickerTextProps = {
  text: string;
  animationThreshold: number;
  style?: StyleProp<TextStyle>;
};

/**
 * TickerText - Wrapper around react-native-text-ticker
 *
 * Uses bounce animation mode with consistent scroll speed for all text lengths.
 * The library automatically detects if text is too long and needs animation.
 */
export const TickerText = ({
  text,
  animationThreshold,
  style,
}: TickerTextProps) => {
  return (
    <TextTicker
      style={style}
      animationType='bounce'
      bounceSpeed={150}
      marqueeDelay={1000}
      loop={false}
      useNativeDriver={true} //!this is the default
      bounce={true}
      isInteraction={false}
      bouncePadding={{ left: 0, right: 10 }}
      // shouldAnimateTreshold={10}
    >
      {text}
    </TextTicker>
  );
};
