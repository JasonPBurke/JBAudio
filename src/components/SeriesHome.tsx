/**
 * The Series browse list — spec §B.
 *
 * A plain vertical list of full-bleed rows separated by an inset hairline rule
 * matching the books list's separator, with a footer copy so the list
 * terminates on a line rather than trailing off.
 *
 * ⚠ INLINE EXPANSION IS GONE (§B7), and with it the masonry list, every book
 * cell and the nested-horizontal-list construct. This screen simply stops being
 * a customer of `BookGridItem`/`BooksHorizontal`; the books home and books grid
 * are UNTOUCHED — nothing forked, nothing modified.
 *
 * The remount-on-change workaround that used to live here went with it. It
 * existed for the clipped-row bug, whose one reproduction was the horizontal
 * FlashList nested in a masonry cell; there is no nested list here any more.
 * That is a structural dissolution, NOT a root-cause fix — if a row ever paints
 * clipped again, the construct is what to look for first, and the workaround is
 * in this file's history.
 */
import React, { memo, useCallback, useMemo } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { SeriesBrowseRow } from './SeriesBrowseRow';
import { DerivedSeries } from '@/helpers/seriesAssembly';
import { separatorInset } from '@/helpers/seriesRowGeometry';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { utilsStyles } from '@/styles';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import type { LadderListProps } from '@/types/ladderList';

/**
 * Root-level sibling route, not a member of the `series` group — a screen
 * inside the group cannot be presented as a root-level sheet (§C2).
 */
const DETAIL_ROUTE = '/seriesDetail';

type SeriesHomeProps = LadderListProps & {
  series: DerivedSeries[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Spacer offsetting content below the parent's overlay search bar. */
  ListHeaderSpacer?: React.ReactElement;
  emptyMessage: string;
};

const SeriesHome = ({
  series,
  onScroll,
  ListHeaderSpacer,
  emptyMessage,
  listRef,
  selectedTab,
  onMomentumScrollEnd,
  onScrollEndDrag,
}: SeriesHomeProps) => {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const seriesBackgrounds = useSettingsStore(
    (state) => state.seriesBackgroundsEnabled,
  );

  // §H6 -- the list ref belongs to the LIBRARY SCREEN and this component keeps
  // no fallback. `LadderListProps` says why.
  useResetScrollOnTabChange(listRef, selectedTab);

  const handleOpen = useCallback(
    (seriesId: string) =>
      router.navigate({ pathname: DETAIL_ROUTE, params: { id: seriesId } }),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: DerivedSeries }) => (
      <SeriesBrowseRow
        series={item}
        showBackdrop={seriesBackgrounds}
        onOpen={handleOpen}
      />
    ),
    [seriesBackgrounds, handleOpen],
  );

  const keyExtractor = useCallback((item: DerivedSeries) => item.id, []);

  /*
   * The rule starts under the TEXT, clearing the fan — the same intent as the
   * books list's hard-coded `marginLeft: 75`, but derived, because the cluster
   * grows with width. Its RIGHT end is deliberately left alone: the hairline is
   * paint, and paint stays full-bleed (§H3).
   */
  const inset = useMemo(() => separatorInset(width), [width]);
  const Divider = useCallback(
    () => (
      <View
        style={{
          ...utilsStyles.itemSeparator,
          marginVertical: 9,
          marginLeft: inset,
          borderColor: themeColors.textMuted,
        }}
      />
    ),
    [themeColors.textMuted, inset],
  );

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef}
        data={series}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
        ListHeaderComponent={ListHeaderSpacer}
        ItemSeparatorComponent={Divider}
        ListFooterComponent={series.length > 0 ? Divider : undefined}
        ListEmptyComponent={
          <Text
            style={[
              utilsStyles.emptyComponent,
              { color: themeColors.textMuted },
            ]}
          >
            {emptyMessage}
          </Text>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default memo(SeriesHome);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  listContent: {
    paddingBottom: 58,
  },
});
