/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ../README.md.
 *
 * VARIANT: baseline. A faithful copy of `src/components/SeriesHome.tsx` as it
 * ships today, so every other variant has a fair A/B partner.
 *
 * Copied rather than imported for exactly two reasons, both required by the
 * ticket ("do NOT modify the real SeriesHome"):
 *
 *   1. `keyExtractor` is index-aware here. Synthetic series repeat real books to
 *      reach 20+ entries, and the shipping key `${seriesId}-${bookId}` collides
 *      on a repeat. (The collapsed horizontal row needs no such fix —
 *      `BooksHorizontal` passes no keyExtractor, and FlashList falls back to the
 *      index: RecyclerViewManager.js:270.)
 *   2. The TEMPORARY [rowprobe] console logging is stripped — it fires per cell
 *      per layout and drowns the log while driving the emulator.
 *
 * Nothing else differs. Keep it that way, or the baseline stops being one.
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

type SeriesFlatItem =
  | { type: 'sectionHeader'; seriesId: string; title: string }
  | { type: 'horizontalRow'; seriesId: string; books: Book[] }
  | { type: 'book'; seriesId: string; bookId: string };

const BaselineSeriesHome = ({
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

  // Remount on membership change — the shipping clipped-row workaround. Kept
  // verbatim so the baseline behaves exactly as the app does today.
  const listKey = useMemo(() => series.map((s) => s.id).join('|'), [series]);

  const flatData: SeriesFlatItem[] = useMemo(() => {
    const items: SeriesFlatItem[] = [];
    for (const s of series) {
      items.push({ type: 'sectionHeader', seriesId: s.id, title: s.name });
      if (activeGridSections.has(s.id)) {
        for (const book of s.books) {
          if (book.bookId)
            items.push({ type: 'book', seriesId: s.id, bookId: book.bookId });
        }
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
            <BookGridItem
              bookId={item.bookId}
              flowDirection='column'
              numColumns={numColumns}
              itemWidth={itemWidth}
            />
          );
        default:
          return null;
      }
    },
    [activeGridSections, handleSectionPress, numColumns, itemWidth, onEditPress],
  );

  // DIFFERS FROM SHIPPING: index suffix. Synthetic series repeat real books, and
  // `${seriesId}-${bookId}` is not unique across a repeat.
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
  seriesId,
  isActive,
  onSectionPress,
  onEditPress,
}: {
  title: string;
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
          <View style={chevronWrapperStyle}>
            <ChevronRight size={24} color={themeColors.icon} />
          </View>
        </View>
      </Pressable>
    </View>
  );
});

export default memo(BaselineSeriesHome);

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
});
