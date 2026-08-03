/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ./README.md.
 *
 * Small shared ATOMS for the ticket-08 variants. The prototype skill's line is
 * that a shared header is fine but a shared layout defeats the point — these
 * are firmly on the header side. Each variant still owns its own structure,
 * information hierarchy and primary affordance; they just agree on how a stack
 * of covers and a completion bar are drawn, so the driver is not distracted by
 * three renderings of the same idea.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { Sparkles, UserRound } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { ProtoSeries } from './syntheticSeries';
import { fitInBox, type CoverShape, type SeriesFacts } from './seriesFacts';

/**
 * Overlapping covers, front-most first. This is the single strongest answer to
 * ticket 08's "does a series look like a CURATED COLLECTION rather than an
 * author shelf" — one cover reads as a book, a fanned stack reads as a set.
 *
 * `covers` arrives already deduped (`getSeriesFacts`), because a 22-book series
 * over an 8-book emulator pool otherwise stacks three identical covers and the
 * result reads as a rendering bug.
 */
export const CoverCluster = memo(function CoverCluster({
  covers,
  size,
}: {
  covers: CoverShape[];
  size: number;
}) {
  const { colors: themeColors } = useTheme();
  const shown = covers.slice(0, 3);

  /*
   * The offset MUST outpace the shrink, or the stack is invisible.
   *
   * With `left = i * size * SHRINK` and `side = size * (1 - i * SHRINK)` every
   * layer's right edge lands at exactly `size` — perfectly right-aligned, so
   * the full-size front layer occludes all of them and a 22-book series draws
   * as one lone cover. Keeping STEP > SHRINK makes each layer clear the one in
   * front of it by `size * (STEP - SHRINK)`.
   */
  const STEP = 0.22;
  const SHRINK = 0.12;
  const peek = (n: number) => size * (1 + (n - 1) * (STEP - SHRINK));
  // Nothing to fan out — a lone cover renders flush, no phantom offset.
  const width = shown.length > 1 ? peek(shown.length) : size;

  return (
    <View style={{ width, height: size }}>
      {/* Painted back-to-front: React Native has no z-index on Android worth
          relying on, so paint order is the ordering primitive. */}
      {shown
        .map((shape, i) => ({ shape, i }))
        .reverse()
        .map(({ shape, i }) => {
          const side = size * (1 - i * SHRINK);
          // Each layer takes the artwork's true proportions rather than being
          // forced square, matching how `BookGridItem` sizes its covers.
          const { width, height } = fitInBox(shape, side);
          return (
            <View
              key={`${shape.uri ?? 'none'}-${i}`}
              style={[
                styles.clusterLayer,
                {
                  left: i * size * STEP,
                  top: (size - height) / 2,
                  width,
                  height,
                  borderColor: themeColors.background,
                },
              ]}
            >
              <FastImage
                source={{
                  uri: shape.uri ?? unknownBookImageUri,
                  priority: FastImage.priority.low,
                  cache: FastImage.cacheControl.immutable,
                }}
                style={StyleSheet.absoluteFill}
                resizeMode={FastImage.resizeMode.cover}
              />
              {i > 0 && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: withOpacity('#000000', 0.18 * i) },
                  ]}
                />
              )}
            </View>
          );
        })}
    </View>
  );
});

/**
 * Detected-vs-hand-made. Ticket 06 made `series.origin` a real column and
 * tickets 02/09 removed the confirmation gate, so this chip is NOT an approval
 * prompt — it is provenance, and its only job in a browse layout is to justify
 * the presence of a correction affordance nearby.
 *
 * Real series carry no `origin` yet (schema v33 is unbuilt), and every real row
 * on the device was made by hand in the wizard — so absent means 'user'.
 */
export const OriginChip = memo(function OriginChip({
  series,
  iconOnly = false,
}: {
  series: DerivedSeries;
  /**
   * Drop the word, keep the glyph. Needed on the card variant, where the chip
   * shares a row with the meta line: at full width the chip ate the canonical
   * RANGE (`5 books · 1 finished · #1…`), and that range is ticket 07's whole
   * answer to "does the order read at a glance" — the thing ticket 08 exists
   * to judge. Provenance is the cheaper of the two to abbreviate.
   */
  iconOnly?: boolean;
}) {
  const { colors: themeColors } = useTheme();
  const origin = (series as ProtoSeries).origin ?? 'user';
  const detected = origin === 'detected';
  const Icon = detected ? Sparkles : UserRound;

  return (
    <View
      style={[
        styles.chip,
        iconOnly && styles.chipIconOnly,
        { backgroundColor: withOpacity(themeColors.textMuted, 0.14) },
      ]}
      accessibilityLabel={detected ? 'Detected series' : 'Your series'}
    >
      <Icon size={11} color={themeColors.textMuted} />
      {!iconOnly && (
        <Text style={[styles.chipText, { color: themeColors.textMuted }]}>
          {detected ? 'Detected' : 'Yours'}
        </Text>
      )}
    </View>
  );
});

/**
 * Completion by FINISHED-BOOK COUNT, never by averaging `bookProgressValue` —
 * that field is a tri-state enum (0/1/2), so an average would render "1 of 7
 * finished" as 50%. See the header comment in `seriesFacts.ts`.
 */
export const CompletionBar = memo(function CompletionBar({
  facts,
  compact = false,
}: {
  facts: SeriesFacts;
  compact?: boolean;
}) {
  const { colors: themeColors } = useTheme();
  const complete = facts.finishedCount === facts.bookCount;

  return (
    <View style={[styles.barRow, compact && styles.barRowCompact]}>
      <View
        style={[
          styles.barTrack,
          { backgroundColor: withOpacity(themeColors.textMuted, 0.22) },
        ]}
      >
        <View
          style={[
            styles.barFill,
            {
              // Clamped: a 0-book series would otherwise produce NaN%.
              width: `${Math.round(Math.min(1, Math.max(0, facts.completion)) * 100)}%`,
              backgroundColor: complete
                ? themeColors.success
                : themeColors.primary,
            },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, { color: themeColors.textMuted }]}>
        {facts.finishedCount}/{facts.bookCount}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  clusterLayer: {
    position: 'absolute',
    borderRadius: 5,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
  },
  chipIconOnly: {
    paddingHorizontal: 5,
  },
  chipText: {
    fontFamily: 'Rubik',
    fontSize: 10,
    marginLeft: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  barRowCompact: {
    marginTop: 8,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  barLabel: {
    fontFamily: 'Rubik',
    fontSize: 10,
    marginLeft: 8,
    minWidth: 34,
    textAlign: 'right',
  },
});
