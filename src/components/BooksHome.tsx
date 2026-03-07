'use no memo'; // Receives Reanimated scroll handler
import React, { memo, useCallback, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { ChevronRight } from 'lucide-react-native';

import { BookGridItem } from './BookGridItem';
import BooksHorizontal from './BooksHorizontal';
import { Book, Author } from '@/types/Book';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { compareBookTitles } from '@/helpers/miscellaneous';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';

type PendingScroll = {
  sectionId: string;
  relativeY: number;
} | null;

export type BookListProps = Partial<FlashListProps<Book>> & {
  authors?: Author[];
  books?: Book[];
  setActiveGridSection: React.Dispatch<React.SetStateAction<string | null>>;
  activeGridSection: string | null;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ListHeaderComponent?: React.ReactElement;
};

type FlatListItem =
  | { type: 'sectionHeader'; sectionId: string; title: string }
  | {
      type: 'horizontalRow';
      sectionId: string;
      books?: Book[];
      authors?: Author[];
      preserveOrder?: boolean;
    }
  | { type: 'book'; bookId: string };

const BooksHome = ({
  authors = [],
  setActiveGridSection,
  activeGridSection,
  onScroll,
  ListHeaderComponent,
}: BookListProps) => {
  const { colors: themeColors } = useTheme();
  const listRef =
    useRef<React.ComponentRef<typeof FlashList<FlatListItem>>>(null);
  const listContainerRef = useRef<View>(null);
  const pendingScrollRef = useRef<PendingScroll>(null);
  const CONTAINER_PADDING_TOP = 8;

  const numColumns = useSettingsStore((state) => state.numColumns);
  const { width: screenWidth } = Dimensions.get('window');
  const ITEM_MARGIN_HORIZONTAL = 10;
  const itemWidth = useMemo(
    () =>
      (screenWidth - ITEM_MARGIN_HORIZONTAL * (numColumns + 1)) /
      numColumns,
    [screenWidth, numColumns],
  );

  // Memoize sorted authors to avoid sorting on every render
  const sortedAuthors = useMemo(() => {
    return [...authors].sort((a, b) => {
      const nameA = a.name.toUpperCase();
      const nameB = b.name.toUpperCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  }, [authors]);

  const recentlyAddedBooks = useMemo(() => {
    const allBooks = sortedAuthors.flatMap((author) => author.books);
    // Optimized: avoid creating Date objects when ctime is already a number
    allBooks.sort((a, b) => {
      const timeA =
        typeof a.metadata.ctime === 'number'
          ? a.metadata.ctime
          : new Date(a.metadata.ctime).getTime();
      const timeB =
        typeof b.metadata.ctime === 'number'
          ? b.metadata.ctime
          : new Date(b.metadata.ctime).getTime();
      return timeB - timeA;
    });
    return allBooks.slice(0, 25);
  }, [sortedAuthors]);

  // Build flat data array for the single FlashList
  const flatData: FlatListItem[] = useMemo(() => {
    if (recentlyAddedBooks.length === 0 && sortedAuthors.length === 0)
      return [];
    const items: FlatListItem[] = [];

    // Recently Added section
    if (recentlyAddedBooks.length > 0) {
      items.push({
        type: 'sectionHeader',
        sectionId: 'recentlyAdded',
        title: 'Recently Added',
      });
      if (activeGridSection === 'recentlyAdded') {
        for (const book of recentlyAddedBooks) {
          if (book.bookId)
            items.push({ type: 'book', bookId: book.bookId });
        }
      } else {
        items.push({
          type: 'horizontalRow',
          sectionId: 'recentlyAdded',
          books: recentlyAddedBooks,
          preserveOrder: true,
        });
      }
    }

    // Author sections
    for (const author of sortedAuthors) {
      items.push({
        type: 'sectionHeader',
        sectionId: author.name,
        title: author.name,
      });
      if (activeGridSection === author.name) {
        const sortedBooks = [...author.books].sort((a, b) =>
          compareBookTitles(a.bookTitle, b.bookTitle),
        );
        for (const book of sortedBooks) {
          if (book.bookId)
            items.push({ type: 'book', bookId: book.bookId });
        }
      } else {
        items.push({
          type: 'horizontalRow',
          sectionId: author.name,
          authors: [author],
        });
      }
    }

    return items;
  }, [activeGridSection, recentlyAddedBooks, sortedAuthors]);

  const handleSectionPress = useCallback(
    (sectionId: string, _index: number, pageY: number) => {
      listContainerRef.current?.measureInWindow((_x, listTopY) => {
        const relativeY = pageY - listTopY;
        pendingScrollRef.current = { sectionId, relativeY };

        setActiveGridSection((prev) => {
          const newValue = prev === sectionId ? null : sectionId;

          requestAnimationFrame(() => {
            setTimeout(() => {
              if (!pendingScrollRef.current || !listRef.current) return;
              const targetId = pendingScrollRef.current.sectionId;
              const newFlatData = listRef.current.props.data;
              if (!newFlatData) return;
              const headerIndex = newFlatData.findIndex(
                (item) =>
                  item.type === 'sectionHeader' &&
                  item.sectionId === targetId,
              );
              if (headerIndex >= 0) {
                listRef.current.scrollToIndex({
                  index: headerIndex,
                  animated: false,
                  viewOffset:
                    -pendingScrollRef.current.relativeY +
                    CONTAINER_PADDING_TOP,
                });
              }
              pendingScrollRef.current = null;
            }, 50);
          });

          return newValue;
        });
      });
    },
    [setActiveGridSection],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FlatListItem; index: number }) => {
      switch (item.type) {
        case 'sectionHeader':
          return (
            <View style={styles.sectionHeaderContainer}>
              <SectionHeader
                title={item.title}
                sectionId={item.sectionId}
                isActive={activeGridSection === item.sectionId}
                index={index}
                onSectionPress={handleSectionPress}
              />
            </View>
          );
        case 'horizontalRow':
          return (
            <View style={styles.horizontalRowContainer}>
              <BooksHorizontal
                books={item.books}
                authors={item.authors}
                flowDirection='row'
                preserveOrder={item.preserveOrder}
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
    [activeGridSection, handleSectionPress, numColumns, itemWidth],
  );

  const keyExtractor = useCallback((item: FlatListItem) => {
    switch (item.type) {
      case 'sectionHeader':
        return `header-${item.sectionId}`;
      case 'horizontalRow':
        return `row-${item.sectionId}`;
      case 'book':
        return item.bookId;
    }
  }, []);

  const overrideItemLayout = useCallback(
    (
      layout: { span?: number },
      item: FlatListItem,
      _index: number,
      maxColumns: number,
    ) => {
      if (item.type !== 'book') {
        layout.span = maxColumns;
      }
    },
    [],
  );

  const getItemType = useCallback((item: FlatListItem) => item.type, []);

  return (
    <View
      ref={listContainerRef}
      style={{
        flex: 1,
        paddingTop: CONTAINER_PADDING_TOP,
        paddingBottom: CONTAINER_PADDING_TOP + 8,
      }}
    >
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
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          <Text
            style={[
              utilsStyles.emptyComponent,
              { color: themeColors.textMuted },
            ]}
          >
            No books found
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 58 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const SectionHeader = memo(
  ({
    title,
    sectionId,
    isActive,
    index,
    onSectionPress,
  }: {
    title: string;
    sectionId: string;
    isActive: boolean;
    index: number;
    onSectionPress: (
      sectionId: string,
      index: number,
      pageY: number,
    ) => void;
  }) => {
    const headerRef = useRef<View>(null);
    const { colors: themeColors } = useTheme();

    const handlePress = useCallback(() => {
      headerRef.current?.measureInWindow((_x, y) => {
        onSectionPress(sectionId, index, y);
      });
    }, [sectionId, index, onSectionPress]);

    // Memoize chevron style to avoid creating new object references on each render
    const chevronStyle = useMemo(
      () => [styles.chevronBase, isActive && styles.chevronRotated],
      [isActive],
    );

    return (
      <Pressable
        ref={headerRef}
        style={styles.sectionHeaderPressable}
        android_ripple={{ color: themeColors.dividerAlpha16 }}
        onPress={handlePress}
      >
        <View style={styles.titleBar}>
          <Text
            numberOfLines={1}
            style={[styles.titleText, { color: themeColors.text }]}
          >
            {title}
          </Text>
          <ChevronRight
            size={24}
            color={themeColors.icon}
            style={chevronStyle}
          />
        </View>
      </Pressable>
    );
  },
);

export default memo(BooksHome);

const styles = StyleSheet.create({
  sectionHeaderPressable: {
    paddingVertical: 4,
    marginBottom: 4,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: screenPadding.horizontal,
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
