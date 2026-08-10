/**
 * The fanned cover cluster on the Series browse row — spec §B1.2, §B2, §B4.
 *
 * One cover reads as a book; a fanned stack reads as a set. Geometry lives in
 * `helpers/seriesRowGeometry.ts` so the rules that were argued over (constant
 * box width, square layers, offset outpacing shrink) are unit-tested rather
 * than implied by a stylesheet.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { Play } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import {
  clusterLayers,
  coverClusterWidth,
  type CoverShape,
} from '@/helpers/seriesRowGeometry';

/**
 * Pillar colour behind a non-square cover. A fixed near-black rather than
 * `themeColors.background`: it has to read as the cover's own letterbox, and a
 * white pillar in light theme reads as a hole.
 *
 * ⚠ DO NOT RE-DERIVE THIS VALUE (§I4). It measures 17.08:1 on a light row and a
 * later reading *will* report that as a defect. It is not one — some covers
 * ship their letterbox inside the JPEG (one real cover sits 1.20:1 from this
 * pillar, i.e. visually the same object) and others in different colours again,
 * so no constant is derivable. Picked on taste, and it has been picked.
 */
const PILLAR = '#0B0B0B';

/**
 * The play glyph's own colours — §B4, and FIXED, never theme-derived.
 *
 * THE DARKENING IS THE GLYPH, NEVER THE ARTWORK. The 0.42 black is the glyph's
 * `fill`; the stroke is a fixed near-white. Nothing outside the play shape is
 * touched, so every pixel of cover art stays as the publisher drew it, and the
 * glyph's legibility cannot vary with the `Series Backgrounds` preference.
 *
 * Two rejected predecessors, do not reintroduce: a full-cover 42% scrim (which
 * turned a 22-row list into 22 identical buttons) and a 26dp disc (a smaller
 * darkened patch is still a darkened patch). A palette-coloured glyph was this
 * effort's first light-theme defect — dark ink on a dark scrim.
 */
const GLYPH_STROKE = '#F5F5F5';
const GLYPH_FILL = withOpacity('#000000', 0.42);

/** Roughly half the front cover, so the glyph is the cover's focal point. */
const GLYPH_SCALE = 0.48;

export const SeriesCoverCluster = memo(function SeriesCoverCluster({
  covers,
  size,
  playLabel,
  onPlay,
}: {
  covers: CoverShape[];
  size: number;
  /** Accessibility only — §B3: the affordance never carries a visible word. */
  playLabel?: string;
  /**
   * Omit to draw the fan with NO glyph. The detail sheet's hero does exactly
   * that: it carries a full-width play button of its own (§C9), and a second
   * play affordance two inches above it would be two targets for one action.
   */
  onPlay?: () => void;
}) {
  const { colors: themeColors } = useTheme();
  const layers = clusterLayers(covers, size);
  const frontWidth = layers[0]?.side ?? size;

  return (
    <View style={{ width: coverClusterWidth(size), height: size }}>
      {/* Painted back-to-front: Android has no z-index worth relying on here,
          so paint order is the ordering primitive. */}
      {layers
        .slice()
        .reverse()
        .map(({ shape, index, left, side, imageWidth }) => (
          <View
            key={`${shape.uri ?? 'none'}-${index}`}
            style={[
              styles.layer,
              {
                left,
                top: (size - side) / 2,
                width: side,
                height: side,
                borderColor: themeColors.background,
              },
            ]}
          >
            {/* Explicit width, centred by the parent — NOT absoluteFill, which
                would stretch a tall cover to the square box and distort it.
                Narrow artwork leaves PILLAR showing; wide artwork overflows and
                is cropped evenly by this layer's own overflow. */}
            <FastImage
              source={{
                uri: shape.uri ?? unknownBookImageUri,
                priority: FastImage.priority.low,
                cache: FastImage.cacheControl.immutable,
              }}
              style={{ width: imageWidth, height: side }}
              resizeMode={FastImage.resizeMode.cover}
            />
            {index > 0 && (
              // Back layers darken per layer — the other half of the depth cue.
              // Clipped by this layer's own radius, so it never spills onto the
              // row behind it.
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: withOpacity('#000000', 0.18 * index) },
                ]}
              />
            )}
          </View>
        ))}

      {/* Painted last, over the front layer. `box-none` lets a tap land on the
          glyph itself while the rest of the cover stays transparent to the
          row's own press handler — §B5's two targets, two meanings. */}
      {onPlay && (
        <View
          style={[styles.overlay, { width: frontWidth, height: size }]}
          pointerEvents='box-none'
        >
          <Pressable
            onPress={onPlay}
            hitSlop={10}
            style={styles.glyph}
            android_ripple={{
              color: withOpacity(themeColors.divider, 0.16),
              borderless: true,
              radius: size / 3,
            }}
            accessibilityRole='button'
            accessibilityLabel={playLabel}
          >
            <Play
              size={Math.round(size * GLYPH_SCALE)}
              fill={GLYPH_FILL}
              color={GLYPH_STROKE}
              strokeWidth={1}
              absoluteStrokeWidth
            />
          </Pressable>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    borderRadius: 5,
    borderWidth: 1.5,
    overflow: 'hidden',
    // Centre the artwork in the square box, so pillars (tall art) and crops
    // (wide art) are both symmetric.
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PILLAR,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    // Optical centring: a triangle's visual mass sits left of its bounding box,
    // so a geometrically-centred Play reads as offset.
    paddingLeft: 3,
  },
});
