/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ../README.md.
 *
 * VARIANT 3 of ticket 08: RICH HEADER + INLINE EXPAND + DETAIL AFFORDANCE.
 * The driver's hybrid, verbatim: "a more detailed header with image integration
 * that still somehow allows for the list to be expanded and also gives access
 * to the series detail screen."
 *
 * The repeating unit stays a SECTION — a header that labels the content under
 * it — which is the variant that keeps ticket 08's stated design continuity
 * with `BooksHome`. It differs from the baseline in two ways that matter:
 *
 *   1. IMAGE INTEGRATION. The header carries a faded backdrop of the series'
 *      first cover under a gradient scrim, so a series is identifiable by its
 *      art before any text is read. This is the "much more vertical space to
 *      play with" being spent on the header rather than on a card.
 *
 *   2. THE COLLAPSED PEEK IS A FLEXBOX ROW, NOT A LIST. Up to four mini covers
 *      plus a `+N` chip, laid out statically. That is a REAL DESIGN TRADE, not
 *      just an implementation change: the baseline's collapsed row scrolls
 *      horizontally through all 22 books, and this does not. Judge whether
 *      horizontally scrolling a collapsed series was ever worth doing — if it
 *      was, this variant is wrong and the baseline is right.
 *
 * As a side effect it also removes the horizontal FlashList nested in a masonry
 * FlashList cell. Ticket 08 says that must not be the reason a variant wins.
 *
 * SHARED-COMPONENT ANSWER (the ticket demands this be explicit): FORKS NOTHING.
 * `BookGridItem` is reused as-is; `BooksHorizontal` is not used, so `BooksHome`
 * and `BooksGrid` are unaffected.
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

import { BookGridItem } from '@/components/BookGridItem';
import { unknownBookImageUri } from '@/constants/images';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { VariantProps } from '../variantProps';
import type { ProtoSeries } from '../syntheticSeries';
import { getSeriesFacts, seriesMetaLine, SeriesFacts } from '../seriesFacts';
import { OriginChip, CompletionBar } from '../seriesCardParts';
import ProtoSeriesDetail from '../ProtoSeriesDetail';

const PEEK_COUNT = 4;

type Item =
  | {
      type: 'header';
      seriesId: string;
      series: DerivedSeries;
      facts: SeriesFacts;
    }
  | { type: 'book'; seriesId: string; bookId: string; canonical: number | null };

const RichHeaderSeriesHome = ({
  series,
  activeGridSections,
  setActiveGridSections,
  onScroll,
  ListHeaderSpacer,
  emptyMessage,
  selectedTab,
}: VariantProps) => {
  const { colors: themeColors } = useTheme();
  const numColumns = useSettingsStore((state) => state.numColumns);
  const { width: screenWidth } = Dimensions.get('window');
  const ITEM_MARGIN_HORIZONTAL = 10;
  const itemWidth = useMemo(
    () =>
      (screenWidth - ITEM_MARGIN_HORIZONTAL * (numColumns + 1)) / numColumns,
    [screenWidth, numColumns],
  );

  const [detailSeries, setDetailSeries] = useState<DerivedSeries | null>(null);

  const listRef = useRef<React.ComponentRef<typeof FlashList<Item>>>(null);
  useResetScrollOnTabChange(listRef, selectedTab);

  const listKey = useMemo(() => series.map((s) => s.id).join('|'), [series]);

  const flatData: Item[] = useMemo(() => {
    const items: Item[] = [];
    for (const s of series as ProtoSeries[]) {
      items.push({
        type: 'header',
        seriesId: s.id,
        series: s,
        facts: getSeriesFacts(s, PEEK_COUNT),
      });
      if (activeGridSections.has(s.id)) {
        const numbers = s.canonicalNumbers ?? [];
        s.books.forEach((book, i) => {
          if (book.bookId)
            items.push({
              type: 'book',
              seriesId: s.id,
              bookId: book.bookId,
              canonical: numbers[i] ?? null,
            });
        });
      }
    }
    return items;
  }, [series, activeGridSections]);

  const handleToggle = useCallback(
    (seriesId: string) => {
      setActiveGridSections((prev) => {
        const next = new Set(prev);
        if (next.has(seriesId)) next.delete(seriesId);
        else next.add(seriesId);
        return next;
      });
    },
    [setActiveGridSections],
  );

  const handleOpenDetail = useCallback(
    (s: DerivedSeries) => setDetailSeries(s),
    [],
  );
  const handleCloseDetail = useCallback(() => setDetailSeries(null), []);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.type === 'header') {
        return (
          <RichHeader
            series={item.series}
            facts={item.facts}
            expanded={activeGridSections.has(item.seriesId)}
            onToggle={handleToggle}
            onOpenDetail={handleOpenDetail}
          />
        );
      }
      return (
        <View>
          <BookGridItem
            bookId={item.bookId}
            flowDirection='column'
            numColumns={numColumns}
            itemWidth={itemWidth}
          />
          {item.canonical !== null && (
            <View
              style={[styles.badge, { backgroundColor: themeColors.primary }]}
              pointerEvents='none'
            >
              <Text
                style={[styles.badgeText, { color: themeColors.background }]}
              >
                {item.canonical}
              </Text>
            </View>
          )}
        </View>
      );
    },
    [
      activeGridSections,
      handleToggle,
      handleOpenDetail,
      numColumns,
      itemWidth,
      themeColors.primary,
      themeColors.background,
    ],
  );

  const keyExtractor = useCallback((item: Item, index: number) => {
    if (item.type === 'header') return `header-${item.seriesId}`;
    return `${item.seriesId}-${item.bookId}-${index}`;
  }, []);

  const overrideItemLayout = useCallback(
    (
      layout: { span?: number },
      item: Item,
      _index: number,
      maxColumns: number,
    ) => {
      if (item.type !== 'book') layout.span = maxColumns;
    },
    [],
  );

  const getItemType = useCallback((item: Item) => item.type, []);

  return (
    <View style={{ flex: 1, paddingTop: 8 }}>
      <FlashList
        key={listKey}
        ref={listRef}
        data={flatData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        overrideItemLayout={overrideItemLayout}
        masonry
        optimizeItemArrangement
        numColumns={numColumns}
        drawDistance={150}
        overrideProps={{ initialDrawBatchSize: 8 }}
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

const RichHeader = memo(function RichHeader({
  series,
  facts,
  expanded,
  onToggle,
  onOpenDetail,
}: {
  series: DerivedSeries;
  facts: SeriesFacts;
  expanded: boolean;
  onToggle: (seriesId: string) => void;
  onOpenDetail: (series: DerivedSeries) => void;
}) {
  const { colors: themeColors } = useTheme();
  const handlePress = useCallback(
    () => onToggle(series.id),
    [series.id, onToggle],
  );
  const handleDetail = useCallback(
    () => onOpenDetail(series),
    [series, onOpenDetail],
  );

  const backdrop = facts.cluster[0]?.uri ?? null;
  const hidden = Math.max(0, facts.bookCount - PEEK_COUNT);

  return (
    <View style={styles.headerOuter}>
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
        accessibilityLabel={`${series.name}, ${facts.bookCount} books`}
      >
        <View style={styles.headerBand}>
          {/*
            IMAGE INTEGRATION. The cover is a backdrop, not content — it is
            deliberately washed out and scrimmed so the series NAME stays the
            first readable thing. If the art wins over the text here, the
            balance is wrong, not the idea.
          */}
          <FastImage
            source={{
              uri: backdrop ?? unknownBookImageUri,
              priority: FastImage.priority.low,
              cache: FastImage.cacheControl.immutable,
            }}
            style={StyleSheet.absoluteFill}
            resizeMode={FastImage.resizeMode.cover}
          />
          {/*
            Scrim heaviest on the LEFT, where the title and meta sit, easing to
            near-transparent on the right where nothing but art is. Running it
            the other way (art strongest under the text) was the first attempt
            and made every title fight its own cover for legibility.
          */}
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
              <Pressable
                onPress={handleDetail}
                hitSlop={10}
                style={styles.detailButton}
                android_ripple={{
                  color: withOpacity(themeColors.divider, 0.16),
                  borderless: true,
                  radius: 18,
                }}
                accessibilityLabel={`Open ${series.name}`}
              >
                <ChevronRight size={22} color={themeColors.icon} />
              </Pressable>
              <ChevronDown
                size={16}
                color={
                  expanded
                    ? themeColors.primary
                    : withOpacity(themeColors.textMuted, 0.5)
                }
                style={expanded ? styles.caretFlipped : undefined}
              />
            </View>

            <View style={styles.metaRow}>
              <Text
                numberOfLines={1}
                style={[styles.metaText, { color: themeColors.textMuted }]}
              >
                {seriesMetaLine(facts)}
                {facts.range !== '' ? ` · #${facts.range}` : ''}
              </Text>
              <View style={styles.metaSpacer} />
              <OriginChip series={series} />
            </View>

            <CompletionBar facts={facts} compact />
          </View>
        </View>

        {/*
          The static peek. Replaces the nested horizontal FlashList with a
          plain flexbox row — no recycling, no inner scroll, fixed cost per
          section regardless of series length.
        */}
        {!expanded && (
          <View style={styles.peekRow}>
            {facts.cluster.slice(0, PEEK_COUNT).map((shape, i) => (
              <FastImage
                key={`${shape.uri ?? 'none'}-${i}`}
                source={{
                  uri: shape.uri ?? unknownBookImageUri,
                  priority: FastImage.priority.low,
                  cache: FastImage.cacheControl.immutable,
                }}
                style={styles.peekCover}
                resizeMode={FastImage.resizeMode.cover}
              />
            ))}
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
        )}
      </Pressable>
    </View>
  );
});

export default memo(RichHeaderSeriesHome);

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
  detailButton: {
    padding: 2,
    marginLeft: 6,
  },
  caretFlipped: {
    transform: [{ rotate: '180deg' }],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    flexShrink: 1,
  },
  metaSpacer: {
    flex: 1,
    minWidth: 8,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding.horizontal,
    paddingTop: 10,
  },
  peekCover: {
    width: 56,
    height: 56,
    borderRadius: 5,
    marginRight: 8,
  },
  peekMore: {
    width: 56,
    height: 56,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekMoreText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
  },
  badge: {
    position: 'absolute',
    top: 14,
    right: 6,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: 11,
  },
});
