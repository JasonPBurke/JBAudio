import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MeshGradientBackground from './MeshGradientBackground';
import type {
  GradientColors,
  ArtworkColors,
} from '@/helpers/gradientColorSorter';

const gradientStart = { x: 0, y: 0 };
const gradientEnd = { x: 0.5, y: 1 };
const gradientLocations = [0.15, 0.35, 0.45, 0.6] as const;

type BookScreenBackgroundProps = {
  useMeshGradient: boolean;
  gradientColors: GradientColors;
  artworkColors: ArtworkColors | null;
  style?: ViewStyle;
  children: ReactNode;
};

const BookScreenBackground = ({
  useMeshGradient,
  gradientColors,
  artworkColors,
  style,
  children,
}: BookScreenBackgroundProps) => {
  if (useMeshGradient) {
    return (
      <View style={[styles.container, style]}>
        <MeshGradientBackground
          gradientColors={gradientColors}
          artworkColors={artworkColors}
        />
        {children}
      </View>
    );
  }

  return (
    <LinearGradient
      start={gradientStart}
      end={gradientEnd}
      locations={gradientLocations}
      style={[styles.container, style]}
      colors={gradientColors}
    >
      {children}
    </LinearGradient>
  );
};

export default React.memo(BookScreenBackground);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
