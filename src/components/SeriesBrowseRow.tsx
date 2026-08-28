/**
 * The Series browse row — spec §B, the most-designed artifact in this effort
 * (fourteen variants across two passes). The shelf that answers *"what do I
 * listen to next?"* at a glance.
 *
 * Two targets, two meanings (§B5): the play glyph on the front cover plays the
 * next unfinished book; everything else opens the series.
 *
 * Rules that are load-bearing here, not stylistic:
 *
 *   §B1  full-bleed row, no card, inset hairline rule, ~140dp. It does NOT
 *        expand — the masonry list, the book cells and the nested horizontal
 *        list are gone from this screen entirely.
 *   §B3  the play affordance is never absent and never carries a word. The
 *        `Start`/`Continue`/`Restart` label cost ~27% of the row's width and
 *        caused four faults; the state is already carried twice (progress bar +
 *        next-up line), so the word is redundant, not sacrificed.
 *   §B6  row height is VARIABLE. A 2-line title grows the row. The earlier
 *        "predictability over elasticity" ruling is deliberately reversed.
 *   §B8  no provenance on browse — an origin chip truncated the canonical range
 *        on 5 of 15 series. A row cannot carry both at full width.
 *   §H1/§H3  CONTENT caps at `min(width, 600)dp` left-anchored; PAINT (the
 *        backdrop and the hairline) is never capped. Left-anchoring keeps the
 *        heaviest part of the scrim under the text.
 *   §H12 the backdrop is NOT a width defect — text legibility *improves* with
 *        width, because the gradient is a fraction of width while the text ends
 *        at a fixed position. No tablet-specific backdrop adaptation.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { LinearGradient } from 'expo-linear-gradient';

import { unknownBookImageUri } from '@/constants/images';
import { fontSize, screenPadding } from '@/constants/tokens';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { useQueueStore } from '@/store/queue';
import { playBookFromRow } from '@/helpers/playBookFromRow';
import { seriesBackdropUri } from '@/helpers/seriesArtwork';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import {
  getSeriesRowFacts,
  nextUpLine,
  seriesMetaLine,
  type SeriesRowFacts,
} from '@/helpers/seriesRowFacts';
import {
  browseTextColumnWidth,
  clusterCoverSize,
  isMetaLineOverflowing,
  CONTENT_CAP,
  TEXT_GAP,
} from '@/helpers/seriesRowGeometry';
import { SeriesCoverCluster } from '@/components/SeriesCoverCluster';
import { SeriesCompletionBar } from '@/components/SeriesCompletionBar';

type TextLayoutEvent = Parameters<
  NonNullable<React.ComponentProps<typeof Text>['onTextLayout']>
>[0];

/*
 * RESTART-FROM-ZERO IS NOT HERE ANY MORE. This row used to rewind a finished
 * book itself before calling `handleBookPlay`, because the helper had no
 * `Finished` case. Spec §C5 reversed that: the rule is the better behaviour
 * everywhere, not a property of one screen, so it moved INTO the helper and
 * this row simply plays. §B3 still sends the glyph to the FIRST book when the
 * series is complete; the helper decides what position that book starts at, and
 * flips the book back to `Started` as it does so.
 */

export const SeriesBrowseRow = memo(function SeriesBrowseRow({
  series,
  showBackdrop,
  onOpen,
}: {
  series: DerivedSeries;
  showBackdrop: boolean;
  onOpen: (seriesId: string) => void;
}) {
  const { colors: themeColors } = useTheme();
  const { width } = useWindowDimensions();
  const requestedBookId = useQueueStore((s) => s.requestedBookId);
  const setRequestedBookId = useQueueStore((s) => s.setRequestedBookId);

  const cap = Math.min(width, CONTENT_CAP);
  const coverSize = clusterCoverSize(width);
  const facts = useMemo(() => getSeriesRowFacts(series), [series]);
  const nextUp = nextUpLine(facts);

  /*
   * §B3 — the glyph's target is the next unfinished book, or the FIRST book
   * when the series is finished. An empty series (all memberships unresolved,
   * or K16's all-excluded state) has no target; the glyph still renders, per
   * "never absent", and does nothing.
   */
  const finished = facts.bookCount > 0 && facts.nextUp === null;
  const target = facts.nextUp ?? series.books[0] ?? null;

  const handleOpen = useCallback(() => onOpen(series.id), [onOpen, series.id]);

  const onPlay = useCallback(() => {
    void playBookFromRow({
      book: target ?? undefined,
      // The REQUESTED Book (queue store); the grid card and list row pass the
      // Active one here. See playBookFromRow's header.
      alreadyInPlay: target?.bookId === requestedBookId,
      requestedBookId,
      setRequestedBookId,
    });
  }, [target, requestedBookId, setRequestedBookId]);

  return (
    <Pressable
      onPress={handleOpen}
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      accessibilityRole='button'
      accessibilityLabel={`${series.name}, ${facts.bookCount} book${
        facts.bookCount === 1 ? '' : 's'
      }`}
      style={styles.row}
    >
      {/*
        §C8 AMENDED 2026-08-11 — the card's backdrop is painted from the SERIES
        ART when one is pinned, else book 1's cover. This row previously never
        read `series.artwork` at all; under the ruling that series art is
        BACKGROUND-ONLY, the browse card is one of its two homes.

        ⚠ THE FAN IS UNTOUCHED and must stay untouched. It is the books, front
        card book 1, whatever is pinned.
      */}
      {showBackdrop && <SeriesRowBackdrop uri={seriesBackdropUri(series)} />}

      {/*
        §H1/§H3: the Pressable and the backdrop above still span the device;
        only this box stops at 600dp, anchored LEFT so the heaviest part of the
        scrim stays under the text where it was tuned.
      */}
      <View style={[styles.content, { maxWidth: cap }]}>
        <SeriesCoverCluster
          covers={facts.cluster}
          size={coverSize}
          playLabel={playAccessibilityLabel(facts, series.name, finished)}
          onPlay={onPlay}
        />

        <View style={styles.textColumn}>
          <Text
            numberOfLines={2}
            style={[styles.title, { color: themeColors.text }]}
          >
            {series.name}
          </Text>

          <SeriesMetaLine facts={facts} width={width} />

          <SeriesCompletionBar facts={facts} />

          {nextUp && (
            <Text
              numberOfLines={1}
              style={[
                styles.nextUp,
                {
                  color:
                    nextUp.state === 'complete'
                      ? themeColors.successText
                      : themeColors.textMuted,
                },
              ]}
            >
              {nextUp.text}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

/** Accessibility only — the visible glyph carries no word (§B3). */
function playAccessibilityLabel(
  facts: SeriesRowFacts,
  seriesName: string,
  finished: boolean,
): string {
  if (facts.bookCount === 0) return `Play ${seriesName}`;
  if (finished) return `Restart ${seriesName}`;
  return `${facts.nextUpStarted ? 'Continue' : 'Play'} ${
    facts.nextUp?.bookTitle ?? seriesName
  }`;
}

/**
 * The first book's cover, full-bleed, under a gradient that is heaviest on the
 * LEFT — under the text. The reverse was built first and every title fought its
 * own cover. Honours `Series Backgrounds` by simply not being rendered (§B9):
 * the cluster shows in BOTH states, which is why the setting is not called
 * "show cover art".
 */
const SeriesRowBackdrop = memo(function SeriesRowBackdrop({
  uri,
}: {
  uri: string | null;
}) {
  const { colors: themeColors } = useTheme();
  return (
    <>
      <FastImage
        source={{
          uri: uri ?? unknownBookImageUri,
          priority: FastImage.priority.low,
          cache: FastImage.cacheControl.immutable,
        }}
        style={StyleSheet.absoluteFill}
        resizeMode={FastImage.resizeMode.cover}
      />
      <LinearGradient
        colors={[
          themeColors.background,
          withOpacity(themeColors.background, 0.92),
          withOpacity(themeColors.background, 0.55),
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
});

/**
 * `22 books · 7 finished · #1-22`, dropping `M finished` when the line actually
 * overflows (§H9).
 *
 * ⚠ THE DROP IS MEASURED, NOT INFERRED (K14). The prototype used a font-scale
 * threshold, which is a proxy that fires on lines that fit and misses lines that
 * do not. `onTextLayout` reports the real line; `isMetaLineOverflowing` reads
 * it.
 *
 * WHAT THIS COSTS, stated honestly: subscribing to `onTextLayout` makes Android
 * run `measureLines` over this one short string on each layout pass — so a
 * recycled cell pays one extra native text measurement, and an overflowing row
 * pays one extra JS render when the flag latches. The alternative, a
 * zero-opacity uncapped copy of the line, is what the book screens use for a
 * one-off title; it costs a whole extra `<Text>` (measure AND view AND paint)
 * in every cell, which is why it is ruled out inside a recycled list.
 *
 * The flag only ever latches ON for a given (line, width) pair. Once the tally
 * is dropped the shorter line fits, and re-measuring it would clear the flag,
 * restore the tally, overflow again — a render loop rendered as a flicker. The
 * measurement key resets on a width or content change, so a rotation or an edit
 * re-measures honestly.
 */
const SeriesMetaLine = memo(function SeriesMetaLine({
  facts,
  width,
}: {
  facts: SeriesRowFacts;
  width: number;
}) {
  const { colors: themeColors } = useTheme();
  const full = seriesMetaLine(facts, { overflowing: false });
  const available = browseTextColumnWidth(width);
  const key = `${full}@${available}`;

  const [measured, setMeasured] = useState<string | null>(null);
  const overflowing = measured === key;

  const handleTextLayout = useCallback(
    (e: TextLayoutEvent) => {
      if (measured === key) return;
      if (isMetaLineOverflowing(e.nativeEvent.lines, full, available)) {
        setMeasured(key);
      }
    },
    [measured, key, full, available],
  );

  return (
    <Text
      numberOfLines={1}
      onTextLayout={handleTextLayout}
      style={[styles.meta, { color: themeColors.textMuted }]}
    >
      {overflowing ? seriesMetaLine(facts, { overflowing: true }) : full}
    </Text>
  );
});

const styles = StyleSheet.create({
  /*
   * No horizontal padding out here: the backdrop bleeds to both screen edges,
   * so the inset lives on `content` instead (§H3).
   */
  row: {
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 12,
  },
  textColumn: {
    flex: 1,
    marginLeft: TEXT_GAP,
  },
  title: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  meta: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  nextUp: {
    fontFamily: 'Rubik',
    fontSize: 11,
    marginTop: 8,
  },
});
