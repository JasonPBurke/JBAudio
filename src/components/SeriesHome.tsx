import React, { memo, useCallback, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ChevronRight, Pencil } from 'lucide-react-native';

import { BookGridItem } from './BookGridItem';
import BooksHorizontal from './BooksHorizontal';
import { Book } from '@/types/Book';
import { DerivedSeries } from '@/helpers/seriesAssembly';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { CustomTabs } from '@/types/CustomTabs';
import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';

type SeriesFlatItem =
  | { type: 'sectionHeader'; seriesId: string; title: string }
  | { type: 'horizontalRow'; seriesId: string; books: Book[] }
  | { type: 'book'; seriesId: string; bookId: string };

type SeriesHomeProps = {
  series: DerivedSeries[];
  activeGridSections: Set<string>;
  setActiveGridSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Spacer offsetting content below the parent's overlay search bar. */
  ListHeaderSpacer?: React.ReactElement;
  emptyMessage: string;
  onEditPress: (seriesId: string) => void;
  selectedTab: CustomTabs;
};

const SeriesHome = ({
  series,
  activeGridSections,
  setActiveGridSections,
  onScroll,
  ListHeaderSpacer,
  emptyMessage,
  onEditPress,
  selectedTab,
}: SeriesHomeProps) => {
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

  // Series arrive already A–Z with books in user order. Build the flat array:
  // a header per series; expanded → the book grid (order preserved);
  // collapsed → a single horizontal row (order preserved).
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
    [
      activeGridSections,
      handleSectionPress,
      numColumns,
      itemWidth,
      onEditPress,
    ],
  );

  const keyExtractor = useCallback((item: SeriesFlatItem) => {
    switch (item.type) {
      case 'sectionHeader':
        return `header-${item.seriesId}`;
      case 'horizontalRow':
        return `row-${item.seriesId}`;
      case 'book':
        return `${item.seriesId}-${item.bookId}`;
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
            style={[
              utilsStyles.emptyComponent,
              { color: themeColors.textMuted },
            ]}
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

export default memo(SeriesHome);

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
    maxWidth: '95%',
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
