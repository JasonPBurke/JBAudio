import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { ShadowedView, shadowStyle } from 'react-native-fast-shadow';
import { Image } from 'expo-image';
import { unknownBookImageUri } from '@/constants/images';

const FIXED_ARTWORK_HEIGHT = 350;

type PlayerArtworkProps = {
  artwork: string | null | undefined;
  width: number;
  onLongPress?: () => void;
};

/**
 * Memoized artwork component for the player screen.
 * This component is extracted to prevent unnecessary re-renders
 * of the artwork image when only playback progress changes.
 *
 * The artwork only needs to re-render when:
 * - The book changes (different artwork URL)
 * - The calculated width changes (different aspect ratio)
 * - Long press to access footprints
 */
export const PlayerArtwork = React.memo(
  ({ artwork, width, onLongPress }: PlayerArtworkProps) => {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={400}
        style={[styles.container, { width }]}
      >
        <ShadowedView
          style={shadowStyle({
            opacity: 0.4,
            radius: 12,
            offset: [5, 3],
          })}
        >
          <Image
            contentFit='contain'
            source={{ uri: artwork ?? unknownBookImageUri }}
            style={styles.image}
          />
        </ShadowedView>
      </Pressable>
    );
  }
);

PlayerArtwork.displayName = 'PlayerArtwork';

const styles = StyleSheet.create({
  container: {
    marginVertical: 60,
    alignSelf: 'center',
    height: FIXED_ARTWORK_HEIGHT,
  },
  image: {
    height: FIXED_ARTWORK_HEIGHT,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 6,
  },
});
