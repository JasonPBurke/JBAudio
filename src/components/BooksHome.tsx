'use no memo'; // Receives Reanimated scroll handler
import React, { memo, useCallback, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList, FlashListProps } from '@shopify/flash-list';
import { ChevronRight } from 'lucide-react-native';

import BooksGrid from './BooksGrid';
import BooksHorizontal from './BooksHorizontal';
import { Book, Author } from '@/types/Book';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity } from '@/helpers/colorUtils';
import { fontSize, screenPadding } from '@/constants/tokens';
import { utilsStyles } from '@/styles';

type PendingScroll = {
  index: number;
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

type ListDataItem =
  | { type: 'recentlyAdded'; books: Book[] }
  | { type: 'author'; author: Author };

const BooksHome = ({
  authors = [],
  setActiveGridSection,
  activeGridSection,
  onScroll,
  ListHeaderComponent,
}: BookListProps) => {
  const { colors: themeColors } = useTheme();
  const listRef =
    useRef<React.ComponentRef<typeof FlashList<ListDataItem>>>(null);
  const listContainerRef = useRef<View>(null);
  const pendingScrollRef = useRef<PendingScroll>(null);
  const CONTAINER_PADDING_TOP = 8;

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

  // Create a data structure for the main FlashList
  const listData: ListDataItem[] = useMemo(() => {
    if (recentlyAddedBooks.length === 0) return [];
    return [
      { type: 'recentlyAdded', books: recentlyAddedBooks },
      ...sortedAuthors.map(
        (author) => ({ type: 'author', author }) as const,
      ),
    ];
  }, [recentlyAddedBooks, sortedAuthors]);

  const handleSectionPress = useCallback(
    (sectionId: string, index: number, pageY: number) => {
      // Measure the list's top position to calculate relative offset
      listContainerRef.current?.measureInWindow((_x, listTopY) => {
        const relativeY = pageY - listTopY;
        pendingScrollRef.current = { index, relativeY };

        setActiveGridSection((prev) => {
          const newValue = prev === sectionId ? null : sectionId;

          // Schedule the scroll restoration after layout settles
          requestAnimationFrame(() => {
            // setTimeout(() => {
            if (pendingScrollRef.current && listRef.current) {
              listRef.current.scrollToIndex({
                index: pendingScrollRef.current.index,
                animated: false,
                viewOffset:
                  -pendingScrollRef.current.relativeY +
                  CONTAINER_PADDING_TOP,
              });
              pendingScrollRef.current = null;
            }
            // }, 50);
          });

          return newValue;
        });
      });
    },
    [setActiveGridSection],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ListDataItem; index: number }) => {
      if (item.type === 'recentlyAdded') {
        return (
          <RecentlyAddedSection
            books={item.books}
            activeGridSection={activeGridSection}
            index={index}
            onSectionPress={handleSectionPress}
          />
        );
      }
      if (item.type === 'author') {
        return (
          <AuthorSection
            author={item.author}
            activeGridSection={activeGridSection}
            index={index}
            onSectionPress={handleSectionPress}
          />
        );
      }
      return null;
    },
    [activeGridSection, handleSectionPress],
  );

  return (
    <View
      ref={listContainerRef}
      style={{ flex: 1, paddingTop: CONTAINER_PADDING_TOP }}
    >
      <FlashList
        ref={listRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) =>
          item.type === 'author' ? item.author.name : item.type
        }
        getItemType={(item) => item.type}
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
        // ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        contentContainerStyle={{ paddingBottom: 58 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

type SectionProps = {
  books?: Book[];
  activeGridSection: string | null;
  index: number;
  onSectionPress: (sectionId: string, index: number, pageY: number) => void;
};

const RecentlyAddedSection = memo(
  ({ books, activeGridSection, index, onSectionPress }: SectionProps) => (
    <View style={styles.containerGap}>
      <SectionHeader
        title='Recently Added'
        sectionId='recentlyAdded'
        isActive={activeGridSection === 'recentlyAdded'}
        index={index}
        onSectionPress={onSectionPress}
      />
      {activeGridSection === 'recentlyAdded' ? (
        <BooksGrid books={books} flowDirection='column' preserveOrder />
      ) : (
        <BooksHorizontal books={books} flowDirection='row' preserveOrder />
      )}
    </View>
  ),
);

type AuthorSectionProps = {
  author: Author;
  activeGridSection: string | null;
  index: number;
  onSectionPress: (sectionId: string, index: number, pageY: number) => void;
};

const AuthorSection = memo(
  ({
    author,
    activeGridSection,
    index,
    onSectionPress,
  }: AuthorSectionProps) => (
    <View style={styles.containerGap}>
      <SectionHeader
        title={author.name}
        sectionId={author.name}
        isActive={activeGridSection === author.name}
        index={index}
        onSectionPress={onSectionPress}
      />
      {activeGridSection === author.name ? (
        <BooksGrid authors={[author]} flowDirection='column' />
      ) : (
        <BooksHorizontal authors={[author]} flowDirection='row' />
      )}
    </View>
  ),
);

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
  },
  // listContainer: {
  //   flex: 1,
  //   paddingTop: 8,
  // },
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
  containerGap: {
    gap: 12,
  },
});
