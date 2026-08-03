/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 08). See ../README.md.
 *
 * VARIANT 4 of ticket 08: PICKER → DETAIL SCREEN. The browse screen becomes a
 * thin index; everything substantial lives on the series detail screen.
 *
 * The repeating unit is a ROW — the smallest thing that can still name a
 * series. This variant makes the strongest claim of the four: that BROWSING
 * AND READING A SERIES ARE DIFFERENT JOBS, and that trying to do both on one
 * screen is why the current design feels like an author shelf. Fifteen series
 * fit on one screen here; no other variant comes close.
 *
 * It DELIBERATELY REMOVES INLINE EXPANSION. `activeGridSections` and
 * `setActiveGridSections` arrive as props and are intentionally unused — that
 * is the design statement, not an oversight. The cost is real and should be
 * judged honestly: seeing a series' covers now always costs a navigation, and
 * the "expand two series and compare them" gesture the baseline allows becomes
 * impossible.
 *
 * As a consequence the nested horizontal FlashList disappears, and so does the
 * masonry list — this is a plain vertical FlashList. Ticket 08 is explicit that
 * the vanishing bug must not be the only reason a variant wins.
 *
 * SHARED-COMPONENT ANSWER (the ticket demands this be explicit): FORKS NOTHING,
 * but also REUSES NOTHING — neither `BookGridItem` nor `BooksHorizontal` is
 * used, because this screen renders no book cells at all. `BooksHome` and
 * `BooksGrid` are untouched. If this variant wins, the shared grid components
 * stay exactly as they are and the Series view simply stops being a customer
 * of them.
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FastImage from '@d11/react-native-fast-image';
import { ChevronRight } from 'lucide-react-native';

import { unknownBookImageUri } from '@/constants/images';
import { useTheme } from '@/hooks/useTheme';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import type { DerivedSeries } from '@/helpers/seriesAssembly';
import type { VariantProps } from '../variantProps';
import { getSeriesFacts, seriesMetaLine, SeriesFacts } from '../seriesFacts';
import { OriginChip, CompletionBar } from '../seriesCardParts';
import ProtoSeriesDetail from '../ProtoSeriesDetail';

type Row = { series: DerivedSeries; facts: SeriesFacts };

const PickerSeriesHome = ({
  series,
  onScroll,
  ListHeaderSpacer,
  emptyMessage,
  selectedTab,
}: VariantProps) => {
  const { colors: themeColors } = useTheme();
  const [detailSeries, setDetailSeries] = useState<DerivedSeries | null>(null);

  const listRef = useRef<React.ComponentRef<typeof FlashList<Row>>>(null);
  useResetScrollOnTabChange(listRef, selectedTab);

  const rows: Row[] = useMemo(
    () => series.map((s) => ({ series: s, facts: getSeriesFacts(s, 1) })),
    [series],
  );

  const handleOpenDetail = useCallback(
    (s: DerivedSeries) => setDetailSeries(s),
    [],
  );
  const handleCloseDetail = useCallback(() => setDetailSeries(null), []);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => (
      <SeriesRow
        series={item.series}
        facts={item.facts}
        onOpenDetail={handleOpenDetail}
      />
    ),
    [handleOpenDetail],
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

const SeriesRow = memo(function SeriesRow({
  series,
  facts,
  onOpenDetail,
}: {
  series: DerivedSeries;
  facts: SeriesFacts;
  onOpenDetail: (series: DerivedSeries) => void;
}) {
  const { colors: themeColors } = useTheme();
  const handlePress = useCallback(
    () => onOpenDetail(series),
    [series, onOpenDetail],
  );

  return (
    <Pressable
      style={styles.row}
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      onPress={handlePress}
      accessibilityLabel={`${series.name}, ${facts.bookCount} books`}
    >
      {/*
        ONE cover, not a stack. The row is the cheapest possible statement of
        "a series exists and is called this" — a cluster here would start it
        down the road to being a card, which is what variant 2 already tests.
      */}
      <FastImage
        source={{
          uri: facts.cluster[0]?.uri ?? unknownBookImageUri,
          priority: FastImage.priority.low,
          cache: FastImage.cacheControl.immutable,
        }}
        style={styles.cover}
        resizeMode={FastImage.resizeMode.cover}
      />

      <View style={styles.rowText}>
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, { color: themeColors.text }]}
        >
          {series.name}
        </Text>
        <View style={styles.metaRow}>
          <Text
            numberOfLines={1}
            style={[styles.rowMeta, { color: themeColors.textMuted }]}
          >
            {seriesMetaLine(facts)}
            {facts.range !== '' ? ` · #${facts.range}` : ''}
          </Text>
        </View>
        <CompletionBar facts={facts} compact />
      </View>

      <View style={styles.rowRight}>
        <OriginChip series={series} />
        <ChevronRight size={20} color={themeColors.icon} />
      </View>
    </Pressable>
  );
});

export default memo(PickerSeriesHome);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: screenPadding.horizontal,
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 5,
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rowTitle: {
    fontFamily: 'Rubik',
    fontSize: fontSize.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rowMeta: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    flexShrink: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
