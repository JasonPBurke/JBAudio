import React from 'react';
import { View, ViewStyle } from 'react-native';

type ProgressCapsuleProps = {
  progress: number;
  fillColor: string;
  trackColor: string;
  height?: number;
  style?: ViewStyle;
};

export const ProgressCapsule = React.memo(function ProgressCapsule({
  progress,
  fillColor,
  trackColor,
  height = 4,
  style,
}: ProgressCapsuleProps) {
  const radius = height / 2;

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: trackColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
          height: '100%',
          borderRadius: radius,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
});
