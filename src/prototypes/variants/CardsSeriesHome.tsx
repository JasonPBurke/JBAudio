/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ../README.md.
 *
 * VARIANT 2 of ticket 08: FULL-WIDTH SERIES CARDS. The driver's own proposal,
 * verbatim: "a prototype that only lists out all the series as card-height and
 * full width cards that can be interacted with to show the titles and/or the
 * series detail screen."
 *
 * The repeating unit is a SELF-CONTAINED OBJECT, not a label for the content
 * beneath it. That is the whole argument of this variant: a card states the
 * series' size, order, completion and what you'd play next without expanding
 * anything, so browsing 15 series never requires opening one. It spends the
 * vertical space ticket 08 says the Series view has spare.
 *
 * BOTH interactions the ticket asks about are wired, deliberately separated:
 *   - tapping the CARD BODY expands in place (cheap, keeps you in the library)
 *   - the CHEVRON at the right edge opens the detail screen
 * Judge whether that split is discoverable, or whether one card wants one job.
 *
 * STRUCTURAL: this variant DELETES the horizontal FlashList nested inside a
 * masonry FlashList cell — the one construct in this feature that never
 * rendered correctly. The collapsed state is a card, so there is no inner list
 * at all. Ticket 08 is explicit that this must not be the only reason it wins;
 * treat it as a dividend, not an argument.
 *
 * SHARED-COMPONENT ANSWER (the ticket demands this be said explicitly): this
 * variant FORKS nothing. `BookGridItem` is reused unmodified for the expanded
 * grid, and `BooksHorizontal` is simply not used. `BooksHome` and `BooksGrid`
 * are therefore untouched by it.
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ChevronRight, ChevronDown } from 'lucide-react-native';

import { BookGridItem } from '@/components/BookGridItem';
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
import { CoverCluster, OriginChip, CompletionBar } from '../seriesCardParts';
import ProtoSeriesDetail from '../ProtoSeriesDetail';

type Item =
  | { type: 'card'; seriesId: string; series: DerivedSeries; facts: SeriesFacts }
  | { type: 'book'; seriesId: string; bookId: string; canonical: number | null };

const CardsSeriesHome = ({
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
      const facts = getSeriesFacts(s, 3);
      items.push({ type: 'card', seriesId: s.id, series: s, facts });
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

  const handleOpenDetail = useCallback((s: DerivedSeries) => {
    setDetailSeries(s);
  }, []);

  const handleCloseDetail = useCallback(() => setDetailSeries(null), []);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.type === 'card') {
        return (
          <SeriesCard
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
    if (item.type === 'card') return `card-${item.seriesId}`;
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

const SeriesCard = memo(function SeriesCard({
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

  return (
    <View style={styles.cardOuter}>
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: themeColors.modalBackground,
            borderColor: withOpacity(themeColors.divider, 0.12),
          },
        ]}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
        onPress={handlePress}
        accessibilityLabel={`${series.name}, ${facts.bookCount} books`}
      >
        <CoverCluster covers={facts.cluster} size={84} />

        <View style={styles.cardText}>
          <Text
            numberOfLines={2}
            style={[styles.cardTitle, { color: themeColors.text }]}
          >
            {series.name}
          </Text>

          <View style={styles.metaRow}>
            <Text
              numberOfLines={1}
              style={[styles.cardMeta, { color: themeColors.textMuted }]}
            >
              {seriesMetaLine(facts)}
              {facts.range !== '' ? ` · #${facts.range}` : ''}
            </Text>
            <View style={styles.metaSpacer} />
            {/* Icon-only: the full chip truncated the canonical range. */}
            <OriginChip series={series} iconOnly />
          </View>

          <CompletionBar facts={facts} compact />

          {/*
            "Next up" is the card earning its height. Without it a card is just
            a fatter section header — with it, the browse screen answers "what
            do I play" without opening anything.
          */}
          {facts.nextUp ? (
            <Text
              numberOfLines={1}
              style={[styles.nextUp, { color: themeColors.textMuted }]}
            >
              {facts.nextUpNumber !== null
                ? `Next · #${facts.nextUpNumber} ${facts.nextUp.bookTitle}`
                : `Next · ${facts.nextUp.bookTitle}`}
            </Text>
          ) : (
            <Text
              numberOfLines={1}
              style={[styles.nextUp, { color: themeColors.success }]}
            >
              Series complete
            </Text>
          )}
        </View>

        <View style={styles.cardRight}>
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
      </Pressable>
    </View>
  );
});

export default memo(CardsSeriesHome);

const styles = StyleSheet.create({
  cardOuter: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    overflow: 'hidden',
  },
  cardText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 6,
  },
  cardTitle: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardMeta: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    flexShrink: 1,
  },
  metaSpacer: {
    flex: 1,
    minWidth: 8,
  },
  nextUp: {
    fontFamily: 'Rubik',
    fontSize: 11,
    marginTop: 8,
  },
  cardRight: {
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
  detailButton: {
    padding: 2,
  },
  caretFlipped: {
    transform: [{ rotate: '180deg' }],
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
