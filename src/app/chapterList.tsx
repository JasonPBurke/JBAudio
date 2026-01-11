import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useActiveTrack } from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { useBookById, useLibraryStore } from '@/store/library';
import { useCurrentChapterStable } from '@/hooks/useCurrentChapterStable';
import { Chapter } from '@/types/Book';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { FlashList } from '@shopify/flash-list';

const ITEM_HEIGHT = 46;
const SEPARATOR_HEIGHT = 3;

const ChapterListScreen = () => {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');
  const activeChapter = useCurrentChapterStable();

  const updateBookChapterIndex = useLibraryStore(
    useCallback((state) => state.updateBookChapterIndex, [])
  );

  // Calculate active chapter index
  const activeIndex = useMemo(() => {
    if (!book?.chapters || !activeChapter) return -1;
    return book.chapters.findIndex(
      (ch) =>
        ch.url === activeChapter.url &&
        ch.chapterNumber === activeChapter.chapterNumber
    );
  }, [book?.chapters, activeChapter]);

  // Calculate initial scroll index to position active chapter at 3rd slot
  const initialScrollIndex = useMemo(() => {
    if (activeIndex <= 0) return undefined;
    return Math.max(0, activeIndex - 2);
  }, [activeIndex]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  const handleChapterSelect = useCallback(
    async (chapterIndex: number, item: Chapter) => {
      if (!book?.bookId || !book.chapters) return;

      // If tapping the active chapter, just dismiss
      if (
        item.url === activeChapter?.url &&
        item.chapterNumber === activeChapter?.chapterNumber
      ) {
        router.back();
        return;
      }

      // Check if it's a single-file book
      const isSingleFileBook =
        book.chapters.length > 1 &&
        book.chapters.every((c) => c.url === book.chapters[0].url);

      if (isSingleFileBook) {
        const selectedChapter = book.chapters[chapterIndex];
        const seekTime = (selectedChapter.startMs || 0) / 1000;
        await TrackPlayer.seekTo(seekTime);
      } else {
        await TrackPlayer.skip(chapterIndex);
      }

      await TrackPlayer.play();
      await TrackPlayer.setVolume(1);
      await updateBookChapterIndex(book.bookId, chapterIndex);
      router.back();
    },
    [book, activeChapter, updateBookChapterIndex, router]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Chapter; index: number }) => {
      const isFirstChapter = index === 0;
      const isLastChapter = index === (book?.chapters?.length ?? 0) - 1;
      const isActive =
        activeChapter?.url === item.url &&
        activeChapter?.chapterNumber === item.chapterNumber;

      return (
        <Pressable
          onPress={() => handleChapterSelect(index, item)}
          style={{
            ...styles.chapterItem,
            backgroundColor: isActive ? '#6d6d6d' : '#1d2233',
            borderBottomLeftRadius: isLastChapter ? 14 : 0,
            borderBottomRightRadius: isLastChapter ? 14 : 0,
            borderTopLeftRadius: isFirstChapter ? 14 : 0,
            borderTopRightRadius: isFirstChapter ? 14 : 0,
          }}
        >
          <Text
            style={{
              ...styles.chapterTitle,
              color: isActive ? colors.primary : colors.textMuted,
            }}
          >
            {item.chapterTitle}
          </Text>
          <Text
            style={[
              styles.chapterDuration,
              { color: isActive ? colors.primary : colors.textMuted },
            ]}
          >
            {formatSecondsToMinutes(item.chapterDuration)}
          </Text>
        </Pressable>
      );
    },
    [book?.chapters?.length, activeChapter, handleChapterSelect]
  );

  const keyExtractor = useCallback(
    (item: Chapter) => `${item.url}-${item.chapterNumber}`,
    []
  );

  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    []
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  if (!book?.chapters) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: bottom }]}>
      <Pressable
        onPress={handleClose}
        hitSlop={10}
        style={styles.handleIndicator}
      />
      {book.chapters.length > 0 ? (
        <FlashList
          data={book.chapters}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          // getItemLayout={getItemLayout}
          initialScrollIndex={initialScrollIndex}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ItemSeparator}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text style={styles.emptyText}>
          No chapters found for this book.
        </Text>
      )}
    </View>
  );
};

export default ChapterListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151520ea',
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#151520ea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleIndicator: {
    marginTop: 24,
    // marginBottom: 12,
    // borderColor: colors.textMuted,
    // borderWidth: 1,
    // width: 55,
    // height: 7,
    // backgroundColor: '#1c1c1ca9',
    // borderRadius: 50,
    // alignSelf: 'center',
  },
  list: {
    flex: 1,
    borderRadius: 4,
  },
  listContent: {
    paddingBottom: 12,
  },
  chapterItem: {
    paddingVertical: 13,
    paddingHorizontal: 13,
    backgroundColor: '#22273b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterTitle: {
    ...defaultStyles.text,
    fontSize: 16,
    maxWidth: '80%',
  },
  chapterDuration: {
    ...defaultStyles.text,
    fontSize: 14,
    color: colors.textMuted,
  },
  separator: {
    height: 3,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
});
