/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ../README.md.
 *
 * VARIANT 5/6 of ticket 08: RICH HEADER, SECOND PASS. Driver's revision after
 * reacting to `Rich header` (2026-08-02), three changes, all subtractive but
 * one:
 *
 *   1. ORIGIN CHIP GONE. Provenance is off the browse screen entirely. It still
 *      exists on the detail screen, which is now the only place it appears.
 *   2. INLINE EXPANSION GONE. A tap anywhere on the header opens the detail
 *      screen. `activeGridSections` / `setActiveGridSections` arrive as props
 *      and are intentionally unused.
 *   3. A PLAY BUTTON takes the space the two chevrons and the chip vacated.
 *
 * Because nothing expands, this renders NO book cells — so unlike `Rich header`
 * there is no masonry list, no `overrideItemLayout` and no `BookGridItem`. It
 * is a plain vertical FlashList of headers. That also means the nested
 * horizontal FlashList is gone twice over.
 *
 * TWO REGISTRY ENTRIES, ONE COMPONENT. The driver wanted to try the bare play
 * icon first and the detail screen's `Continue` wording second; those are one
 * boolean apart, so both are registered and switchable in the panel rather than
 * costing a round trip. `Rich + play` is the icon, `Rich + continue` the pill.
 *
 * THE PLAY BUTTON IS A STUB. It logs and does nothing. Prototypes do not get
 * wired to real playback — the question here is whether the affordance belongs
 * on the browse row and how big it wants to be, not whether playback works.
 *
 * SHARED-COMPONENT ANSWER: forks nothing, and now reuses nothing either —
 * `BookGridItem` and `BooksHorizontal` are both unused, so `BooksHome` and
 * `BooksGrid` are untouched.
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import { Play } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { VariantProps } from '../variantProps';
import {
  getSeriesFacts,
  seriesMetaLine,
  fitInBox,
  fitCoverCount,
  SeriesFacts,
} from '../seriesFacts';
import { CompletionBar } from '../seriesCardParts';
import ProtoSeriesDetail from '../ProtoSeriesDetail';

/** Long-axis box for a peek cover; the short axis follows the artwork. */
const PEEK_BOX = 56;
const PEEK_GAP = 8;

type Row = { series: DerivedSeries; facts: SeriesFacts };

const RichPlaySeriesHome = ({
  series,
  onScroll,
  ListHeaderSpacer,
  emptyMessage,
  selectedTab,
  showContinueLabel,
}: VariantProps & { showContinueLabel: boolean }) => {
  const { colors: themeColors } = useTheme();
  const [detailSeries, setDetailSeries] = useState<DerivedSeries | null>(null);

  const listRef = useRef<React.ComponentRef<typeof FlashList<Row>>>(null);
  useResetScrollOnTabChange(listRef, selectedTab);

  const rows: Row[] = useMemo(
    // No cap passed: the layout decides how many fit, so facts must offer more
    // candidates than any device will draw.
    () => series.map((s) => ({ series: s, facts: getSeriesFacts(s) })),
    [series],
  );

  const handleOpenDetail = useCallback(
    (s: DerivedSeries) => setDetailSeries(s),
    [],
  );
  const handleCloseDetail = useCallback(() => setDetailSeries(null), []);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => (
      <RichPlayHeader
        series={item.series}
        facts={item.facts}
        showContinueLabel={showContinueLabel}
        onOpenDetail={handleOpenDetail}
      />
    ),
    [handleOpenDetail, showContinueLabel],
  );

  const keyExtractor = useCallback((item: Row) => item.series.id, []);

  return (
    <View style={{ flex: 1, paddingTop: 8 }}>
      <FlashList
        ref={listRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={ListHeaderSpacer}
        ListEmptyComponent={
          <Text
            style={[utilsStyles.emptyComponent, { color: themeColors.textMuted }]}
          >
            {emptyMessage}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 58 }}
        showsVerticalScrollIndicator={false}
      />
      <ProtoSeriesDetail series={detailSeries} onClose={handleCloseDetail} />
    </View>
  );
};

const RichPlayHeader = memo(function RichPlayHeader({
  series,
  facts,
  showContinueLabel,
  onOpenDetail,
}: {
  series: DerivedSeries;
  facts: SeriesFacts;
  showContinueLabel: boolean;
  onOpenDetail: (series: DerivedSeries) => void;
}) {
  const { colors: themeColors } = useTheme();
  const { width: screenWidth } = Dimensions.get('window');
  const handlePress = useCallback(
    () => onOpenDetail(series),
    [series, onOpenDetail],
  );

  const backdrop = facts.cluster[0]?.uri ?? null;

  /*
   * Responsive peek (driver, 2026-08-03): "show as many covers + the '+n'
   * square as the device would allow" — thinner displays show fewer, wider
   * show more. Covers take their artwork's true shape, so the count also
   * varies BY SERIES: at a fixed height a tall cover is narrower than a square
   * one, and more of them fit.
   */
  const peekCount = fitCoverCount(
    facts.cluster,
    facts.bookCount,
    screenWidth - screenPadding.horizontal * 2,
    PEEK_BOX,
    PEEK_GAP,
    PEEK_BOX,
  );
  const shown = facts.cluster.slice(0, peekCount);
  const hidden = Math.max(0, facts.bookCount - shown.length);

  /*
   * Three states, one button — the button is ALWAYS present (driver, 2026-08-02:
   * "finished series should read 'restart' with a play button"). An earlier
   * build hid it on finished series, which was literally correct but left the
   * right side of those rows visibly empty, so a completed series read as an
   * unfinished layout.
   *
   * `Continue` is also wrong for a series never opened — Bobiverse renders 0/1
   * and read `Continue` on the first build. The detail screen has both flaws
   * and inherits these fixes if this variant wins.
   */
  const finished = facts.nextUp === null;
  const touched = facts.progressValues.some((v) => v > 0);
  const playLabel = finished ? 'Restart' : touched ? 'Continue' : 'Start';
  // Restart goes back to the top of the series, not to a next-up that is null.
  const playTarget = finished ? series.books[0] : facts.nextUp;

  const handlePlay = useCallback(() => {
    // STUB — see the file header. The question is the affordance, not playback.
    console.log(
      `[proto] ${playLabel} stub: ${series.name} → ${playTarget?.bookTitle ?? '(empty)'}`,
    );
  }, [series.name, playLabel, playTarget]);

  return (
    <View style={styles.headerOuter}>
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
        accessibilityLabel={`${series.name}, ${facts.bookCount} books`}
      >
        <View style={styles.headerBand}>
          <FastImage
            source={{
              uri: backdrop ?? unknownBookImageUri,
              priority: FastImage.priority.low,
              cache: FastImage.cacheControl.immutable,
            }}
            style={StyleSheet.absoluteFill}
            resizeMode={FastImage.resizeMode.cover}
          />
          {/* Scrim heaviest on the left, under the text. See `Rich header`. */}
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

          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={2}
                style={[styles.titleText, { color: themeColors.text }]}
              >
                {series.name}
              </Text>

              {showContinueLabel ? (
                <Pressable
                  onPress={handlePlay}
                  hitSlop={8}
                  style={[
                    styles.continuePill,
                    {
                      backgroundColor: themeColors.backgroundAlpha59,
                      // Hairline: the translucent ground vanishes over dark
                      // backdrops, leaving the button with no edge. Tied to the
                      // glyph colour so it tracks the theme.
                      borderColor: withOpacity(themeColors.icon, 0.4),
                    },
                  ]}
                  android_ripple={{
                    color: withOpacity(themeColors.divider, 0.16),
                  }}
                  accessibilityLabel={`${playLabel} ${series.name}`}
                >
                  <Play
                    size={20}
                    color={themeColors.icon}
                    strokeWidth={1}
                    absoluteStrokeWidth
                  />
                  <Text
                    style={[styles.continueText, { color: themeColors.text }]}
                  >
                    {playLabel}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handlePlay}
                  hitSlop={8}
                  style={[
                    styles.playButton,
                    {
                      backgroundColor: themeColors.backgroundAlpha59,
                      borderColor: withOpacity(themeColors.icon, 0.4),
                    },
                  ]}
                  android_ripple={{
                    // Bounded, not borderless — the button is a square now, so a
                    // circular borderless ripple would spill past its corners.
                    color: withOpacity(themeColors.divider, 0.16),
                  }}
                  accessibilityLabel={`${playLabel} ${series.name}`}
                >
                  <Play
                    size={34}
                    color={themeColors.icon}
                    strokeWidth={1}
                    absoluteStrokeWidth
                  />
                </Pressable>
              )}
            </View>

            {/* Chip gone, so the meta line gets the full width back — the
                canonical range no longer competes for it. */}
            <Text
              numberOfLines={1}
              style={[styles.metaText, { color: themeColors.textMuted }]}
            >
              {seriesMetaLine(facts)}
              {facts.range !== '' ? ` · #${facts.range}` : ''}
            </Text>

            <CompletionBar facts={facts} compact />
          </View>
        </View>

        <View style={styles.peekRow}>
          {shown.map((shape, i) => {
            const { width, height } = fitInBox(shape, PEEK_BOX);
            return (
              <FastImage
                key={`${shape.uri ?? 'none'}-${i}`}
                source={{
                  uri: shape.uri ?? unknownBookImageUri,
                  priority: FastImage.priority.low,
                  cache: FastImage.cacheControl.immutable,
                }}
                style={[styles.peekCover, { width, height }]}
                resizeMode={FastImage.resizeMode.cover}
              />
            );
          })}
          {/* Hidden when nothing is left over (driver, 2026-08-03) — a 2-book
              series on a wide screen shows two covers and stops. */}
          {hidden > 0 && (
            <View
              style={[
                styles.peekMore,
                { borderColor: withOpacity(themeColors.divider, 0.3) },
              ]}
            >
              <Text
                style={[styles.peekMoreText, { color: themeColors.textMuted }]}
              >
                +{hidden}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
});

/** Registry entry: bare play icon. */
export const RichPlayIcon = memo(function RichPlayIcon(props: VariantProps) {
  return <RichPlaySeriesHome {...props} showContinueLabel={false} />;
});

/** Registry entry: `Continue` pill, echoing the detail screen's button. */
export const RichPlayContinue = memo(function RichPlayContinue(
  props: VariantProps,
) {
  return <RichPlaySeriesHome {...props} showContinueLabel />;
});

const styles = StyleSheet.create({
  headerOuter: {
    paddingBottom: 10,
  },
  headerBand: {
    height: 96,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  headerContent: {
    paddingHorizontal: screenPadding.horizontal,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    flex: 1,
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  /*
   * Both buttons wear `BookGridItem`'s play treatment (driver, 2026-08-03):
   * an OUTLINED `Play` in `themeColors.icon` at `strokeWidth={1}` with
   * `absoluteStrokeWidth`, over `backgroundAlpha59` — not a filled glyph on
   * amber. See `BookGridItem.tsx:142-156` / `pausedIconBase`.
   *
   * Shape matches too (driver, 2026-08-03): `borderRadius: 4` on BOTH, the same
   * value `pausedIconBase` uses — so these read as squares with softened
   * corners, not as pills or circles.
   */
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    // Optical centring: a triangle's visual mass sits left of its bounding box.
    paddingLeft: 3,
  },
  continuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    marginLeft: 12,
  },
  continueText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginLeft: 8,
  },
  metaText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 10,
  },
  peekCover: {
    // width/height are supplied per-cover from the artwork's aspect ratio.
    borderRadius: 5,
    marginRight: PEEK_GAP,
  },
  peekMore: {
    width: PEEK_BOX,
    height: PEEK_BOX,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekMoreText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
  },
});
