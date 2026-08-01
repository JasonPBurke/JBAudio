/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ../README.md.
 *
 * VARIANT: numbered. The baseline plus the two things ticket 03's prior-art
 * research said every mature reader does, and this app currently does neither:
 *
 *   - a CANONICAL NUMBER badge on each cover in the expanded grid
 *   - the collapsed number RANGE beside the series title (`#1, 3-4, 8`), so a
 *     library with gaps is legible without expanding it
 *
 * It exists mainly to prove the harness end to end: it is the A/B partner that
 * makes the variant switcher worth having, and it is the only thing that renders
 * `ProtoSeries.canonicalNumbers` — a field schema v32 cannot store and ticket 07
 * has not yet decided. Treat its styling as a first sketch, not a proposal.
 */
import React, { memo, useCallback, useMemo, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ChevronRight, Pencil } from 'lucide-react-native';

import { BookGridItem } from '@/components/BookGridItem';
import BooksHorizontal from '@/components/BooksHorizontal';
import { Book } from '@/types/Book';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import type { VariantProps } from '../variantProps';
import { collapseNumberRange, ProtoSeries } from '../syntheticSeries';

type SeriesFlatItem =
  | { type: 'sectionHeader'; seriesId: string; title: string; range: string }
  | { type: 'horizontalRow'; seriesId: string; books: Book[] }
  | {
      type: 'book';
      seriesId: string;
      bookId: string;
      canonical: number | null;
    };

const NumberedSeriesHome = ({
  series,
  activeGridSections,
  setActiveGridSections,
  onScroll,
  ListHeaderSpacer,
  emptyMessage,
  onEditPress,
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

  const listRef =
    useRef<React.ComponentRef<typeof FlashList<SeriesFlatItem>>>(null);
  useResetScrollOnTabChange(listRef, selectedTab);

  const listKey = useMemo(() => series.map((s) => s.id).join('|'), [series]);

  const flatData: SeriesFlatItem[] = useMemo(() => {
    const items: SeriesFlatItem[] = [];
    // The library screen's filters are typed `DerivedSeries[]` and pass objects
    // through by reference, so the proto fields survive the trip but not the
    // type. Real series simply have no numbers and get an empty range.
    for (const s of series as ProtoSeries[]) {
      const numbers = s.canonicalNumbers ?? [];
      items.push({
        type: 'sectionHeader',
        seriesId: s.id,
        title: s.name,
        range: collapseNumberRange(numbers),
      });
      if (activeGridSections.has(s.id)) {
        s.books.forEach((book, i) => {
          if (book.bookId)
            items.push({
              type: 'book',
              seriesId: s.id,
              bookId: book.bookId,
              canonical: numbers[i] ?? null,
            });
        });
      } else {
        items.push({ type: 'horizontalRow', seriesId: s.id, books: s.books });
      }
    }
    return items;
  }, [series, activeGridSections]);

  const handleSectionPress = useCallback(
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

  const renderItem = useCallback(
    ({ item }: { item: SeriesFlatItem }) => {
      switch (item.type) {
        case 'sectionHeader':
          return (
            <View style={styles.sectionHeaderContainer}>
              <SectionHeader
                title={item.title}
                range={item.range}
                seriesId={item.seriesId}
                isActive={activeGridSections.has(item.seriesId)}
                onSectionPress={handleSectionPress}
                onEditPress={onEditPress}
              />
            </View>
          );
        case 'horizontalRow':
          return (
            <View style={styles.horizontalRowContainer}>
              <BooksHorizontal
                sectionId={item.seriesId}
                books={item.books}
                flowDirection='row'
                preserveOrder
              />
            </View>
          );
        case 'book':
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
                  style={[
                    styles.badge,
                    { backgroundColor: themeColors.primary },
                  ]}
                  pointerEvents='none'
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: themeColors.background },
                    ]}
                  >
                    {item.canonical}
                  </Text>
                </View>
              )}
            </View>
          );
        default:
          return null;
      }
    },
    [
      activeGridSections,
      handleSectionPress,
      numColumns,
      itemWidth,
      onEditPress,
      themeColors.primary,
      themeColors.background,
    ],
  );

  const keyExtractor = useCallback((item: SeriesFlatItem, index: number) => {
    switch (item.type) {
      case 'sectionHeader':
        return `header-${item.seriesId}`;
      case 'horizontalRow':
        return `row-${item.seriesId}`;
      case 'book':
        return `${item.seriesId}-${item.bookId}-${index}`;
    }
  }, []);

  const overrideItemLayout = useCallback(
    (
      layout: { span?: number },
      item: SeriesFlatItem,
      _index: number,
      maxColumns: number,
    ) => {
      if (item.type !== 'book') layout.span = maxColumns;
    },
    [],
  );

  const getItemType = useCallback((item: SeriesFlatItem) => item.type, []);

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
    </View>
  );
};

const SectionHeader = memo(function SectionHeader({
  title,
  range,
  seriesId,
  isActive,
  onSectionPress,
  onEditPress,
}: {
  title: string;
  range: string;
  seriesId: string;
  isActive: boolean;
  onSectionPress: (seriesId: string) => void;
  onEditPress: (seriesId: string) => void;
}) {
  const { colors: themeColors } = useTheme();
  const handlePress = useCallback(
    () => onSectionPress(seriesId),
    [seriesId, onSectionPress],
  );
  const handleEditPress = useCallback(
    () => onEditPress(seriesId),
    [seriesId, onEditPress],
  );
  const chevronWrapperStyle = useMemo(
    () => [styles.chevronBase, isActive && styles.chevronRotated],
    [isActive],
  );
  return (
    <View style={styles.headerRow}>
      <Pressable
        style={styles.editIconButton}
        android_ripple={{
          color: withOpacity(themeColors.divider, 0.16),
          borderless: true,
          radius: 18,
        }}
        hitSlop={8}
        accessibilityLabel={`Edit ${title}`}
        onPress={handleEditPress}
      >
        <Pencil size={18} color={themeColors.primary} />
      </Pressable>
      <Pressable
        style={styles.sectionHeaderPressable}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
        onPress={handlePress}
      >
        <View style={styles.titleBar}>
          <Text
            numberOfLines={1}
            style={[styles.titleText, { color: themeColors.text }]}
          >
            {title}
          </Text>
          {range !== '' && (
            <Text
              numberOfLines={1}
              style={[styles.rangeText, { color: themeColors.textMuted }]}
            >
              {`#${range}`}
            </Text>
          )}
          <View style={chevronWrapperStyle}>
            <ChevronRight size={24} color={themeColors.icon} />
          </View>
        </View>
      </Pressable>
    </View>
  );
});

export default memo(NumberedSeriesHome);

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: screenPadding.horizontal,
  },
  editIconButton: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  sectionHeaderPressable: {
    flex: 1,
    paddingVertical: 4,
    marginBottom: 4,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 0,
  },
  titleText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.base,
    flexShrink: 1,
  },
  rangeText: {
    fontFamily: 'Rubik',
    fontSize: fontSize.xs,
    marginLeft: 8,
    marginRight: 4,
    flexShrink: 0,
  },
  chevronBase: {
    marginRight: 12,
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  sectionHeaderContainer: {
    paddingTop: 4,
  },
  horizontalRowContainer: {
    paddingBottom: 4,
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
