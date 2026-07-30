import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { ShadowedView, shadowStyle } from 'react-native-fast-shadow';
import FastImage from '@d11/react-native-fast-image';
import { unknownBookImageUri } from '@/constants/images';
import { normalizeSize } from '@/helpers/normalizeSize';

type PlayerArtworkProps = {
  artwork: string | null | undefined;
  width: number;
  height: number;
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
  ({ artwork, width, height, onLongPress }: PlayerArtworkProps) => {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={400}
        style={[styles.container, { width, height }]}
      >
        <ShadowedView
          style={shadowStyle({
            opacity: 0.4,
            radius: 12,
            offset: [5, 3],
          })}
        >
          <FastImage
            source={{
              uri: artwork ?? unknownBookImageUri,
              priority: FastImage.priority.high,
              cache: FastImage.cacheControl.immutable,
            }}
            style={[styles.image, { width, height }]}
            resizeMode={FastImage.resizeMode.contain}
          />
        </ShadowedView>
      </Pressable>
    );
  },
);

PlayerArtwork.displayName = 'PlayerArtwork';

/**
 * Vertical margins around the cover art. Exported because player.tsx has to
 * subtract them when working out how much height is left over for the artwork
 * itself — see PLAYER_CHROME_HEIGHT there.
 */
export const ARTWORK_MARGIN_TOP = normalizeSize(60);
export const ARTWORK_MARGIN_BOTTOM = normalizeSize(30);

const styles = StyleSheet.create({
  container: {
    marginTop: ARTWORK_MARGIN_TOP,
    marginBottom: ARTWORK_MARGIN_BOTTOM,
    alignSelf: 'center',
  },
  image: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 6,
  },
});
