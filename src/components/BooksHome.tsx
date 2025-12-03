import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Book, Author } from '@/types/Book';
import { colors, fontSize } from '@/constants/tokens';
import { FlashList, FlashListProps } from '@shopify/flash-list';

import { ChevronRight } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import BooksGrid from './BooksGrid';
import BooksHorizontal from './BooksHorizontal';
import { utilsStyles } from '@/styles';
import React from 'react';

export type BookListProps = Partial<FlashListProps<Book>> & {
  authors: Author[];
  setActiveGridSection: React.Dispatch<React.SetStateAction<string | null>>;
  activeGridSection: string | null;
};

const BooksHome = ({
  authors,
  setActiveGridSection,
  activeGridSection,
}: BookListProps) => {
  authors.sort((a, b) => {
    const nameA = a.name.toUpperCase();
    const nameB = b.name.toUpperCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

  const allBooks = authors.flatMap((author) => author.books);

  // Create a data structure for the main FlashList
  const listData: (
    | { type: 'recentlyAdded'; authors: Author[] }
    | { type: 'author'; author: Author }
  )[] =
    allBooks.length > 0
      ? [
          { type: 'recentlyAdded', authors },
          ...authors.map((author) => ({ type: 'author', author }) as const),
        ]
      : [];

  const renderItem = useCallback(
    ({ item }: { item: (typeof listData)[0] }) => {
      if (item.type === 'recentlyAdded') {
        return (
          <RecentlyAddedSection
            authors={item.authors}
            activeGridSection={activeGridSection}
            setActiveGridSection={setActiveGridSection}
          />
        );
      }
      if (item.type === 'author') {
        return (
          <AuthorSection
            author={item.author}
            activeGridSection={activeGridSection}
            setActiveGridSection={setActiveGridSection}
          />
        );
      }
      return null;
    },
    [activeGridSection, setActiveGridSection]
  );

  return (
    <FlashList
      data={listData}
      renderItem={renderItem}
      keyExtractor={(item) =>
        item.type === 'author' ? item.author.name : item.type
      }
      getItemType={(item) => item.type}
      ListEmptyComponent={
        <Text style={utilsStyles.emptyComponent}>No books found</Text>
      }
      // ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
      contentContainerStyle={{ paddingBottom: 58 }}
      showsVerticalScrollIndicator={false}
    />
  );
};

const RecentlyAddedSection = memo(
  ({ authors, activeGridSection, setActiveGridSection }: BookListProps) => (
    <View style={styles.containerGap}>
      <SectionHeader
        title='Recently Added'
        sectionId='recentlyAdded'
        isActive={activeGridSection === 'recentlyAdded'}
        onPress={() =>
          setActiveGridSection((prev) =>
            prev === 'recentlyAdded' ? null : 'recentlyAdded'
          )
        }
      />
      {activeGridSection === 'recentlyAdded' ? (
        <BooksGrid authors={authors} flowDirection='column' />
      ) : (
        <BooksHorizontal authors={authors} flowDirection='row' />
      )}
    </View>
  )
);

const AuthorSection = memo(
  ({
    author,
    activeGridSection,
    setActiveGridSection,
  }: { author: Author } & Omit<BookListProps, 'authors'>) => (
    <View style={styles.containerGap}>
      <SectionHeader
        title={author.name}
        sectionId={author.name}
        isActive={activeGridSection === author.name}
        onPress={() =>
          setActiveGridSection((prev) =>
            prev === author.name ? null : author.name
          )
        }
      />
      {activeGridSection === author.name ? (
        <BooksGrid authors={[author]} flowDirection='column' />
      ) : (
        <BooksHorizontal authors={[author]} flowDirection='row' />
      )}
    </View>
  )
);

const SectionHeader = memo(
  ({
    title,
    isActive,
    onPress,
  }: {
    title: string;
    sectionId: string;
    isActive: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      style={{ paddingVertical: 4 }}
      android_ripple={{ color: '#cccccc28' }}
      onPress={onPress}
    >
      <View style={styles.titleBar}>
        <Text numberOfLines={1} style={styles.titleText}>
          {title}
        </Text>
        <ChevronRight
          size={24}
          color={colors.icon}
          style={{
            marginRight: 12,
            transform: isActive ? [{ rotate: '90deg' }] : [],
          }}
        />
      </View>
    </Pressable>
  )
);

export default memo(BooksHome);

const styles = StyleSheet.create({
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 14,
  },
  titleText: {
    fontSize: fontSize.base,
    color: colors.text,
    maxWidth: '95%',
  },
  containerGap: {
    gap: 12,
  },
});
