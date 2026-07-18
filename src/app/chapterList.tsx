import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { PressableScale } from 'pressto';
import { useActiveTrack } from 'react-native-track-player';
import TrackPlayer from 'react-native-track-player';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleX } from 'lucide-react-native';
import { useBookById, useLibraryStore } from '@/store/library';
import { useTheme } from '@/hooks/useTheme';
import { withOpacity, ensureReadable } from '@/helpers/colorUtils';
import { usesChapterQueue } from '@/helpers/chapterPlayback';
import { Chapter } from '@/types/Book';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';
import { FlashList } from '@shopify/flash-list';
import { recordFootprint } from '@/db/footprintQueries';
import { stampLastPlayed } from '@/db/bookQueries';

const ChapterListScreen = () => {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { bookId: paramBookId, readOnly } = useLocalSearchParams<{
    bookId?: string;
    readOnly?: string;
  }>();
  const isReadOnly = readOnly === 'true';

  const activeTrack = useActiveTrack();
  const book = useBookById(paramBookId ?? activeTrack?.bookId ?? '');

  const updateBookChapterIndex = useLibraryStore(
    useCallback((state) => state.updateBookChapterIndex, []),
  );

  // Chapter identity is the queue/store index (see helpers/chapterPlayback):
  // never match by URL — clipped queue items all share one URL.
  const storeIndex = useLibraryStore(
    useCallback(
      (state) =>
        book?.bookId ? state.playbackIndex[book.bookId] : undefined,
      [book?.bookId],
    ),
  );

  // Calculate active chapter index (only when this book is the loaded one)
  const activeIndex = useMemo(() => {
    if (isReadOnly || !book?.chapters?.length) return -1;
    if (!activeTrack?.bookId || activeTrack.bookId !== book.bookId) return -1;
    const index =
      storeIndex ?? book.bookProgress?.currentChapterIndex ?? -1;
    if (index < 0) return -1;
    return Math.min(index, book.chapters.length - 1);
  }, [isReadOnly, book, activeTrack?.bookId, storeIndex]);

  // Calculate initial scroll index to position active chapter at 3rd slot
  // For read-only mode, start at the top
  const initialScrollIndex = useMemo(() => {
    if (isReadOnly || activeIndex <= 0) return undefined;
    return Math.max(0, activeIndex - 7);
  }, [activeIndex, isReadOnly]);

  const handleChapterSelect = useCallback(
    async (chapterIndex: number) => {
      if (!book?.bookId || !book.chapters) return;

      // In read-only mode, do nothing on press
      if (isReadOnly) return;

      // If tapping the active chapter, just dismiss
      if (chapterIndex === activeIndex) {
        router.back();
        return;
      }

      // Record footprint before chapter change
      try {
        void stampLastPlayed(book.bookId);
        await recordFootprint(book.bookId, 'chapter_change');
      } catch {
        // Silently fail if footprint recording fails
      }

      if (usesChapterQueue(book.chapters)) {
        // Multi-file and clipped single-file books: one queue item per chapter
        await TrackPlayer.skip(chapterIndex);
      } else {
        // Legacy single-file book: one queue item, absolute positions
        const selectedChapter = book.chapters[chapterIndex];
        const seekTime = (selectedChapter.startMs || 0) / 1000;
        await TrackPlayer.seekTo(seekTime);
      }

      await TrackPlayer.play();
      await TrackPlayer.setVolume(1);
      await updateBookChapterIndex(book.bookId, chapterIndex);
      router.back();
    },
    [book, activeIndex, updateBookChapterIndex, router, isReadOnly],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Chapter; index: number }) => {
      const isFirstChapter = index === 0;
      const isLastChapter = index === (book?.chapters?.length ?? 0) - 1;
      // Only show active highlight when not in read-only mode
      const isActive = !isReadOnly && index === activeIndex;

      const borderStyle = {
        borderBottomLeftRadius: isLastChapter ? 14 : 0,
        borderBottomRightRadius: isLastChapter ? 14 : 0,
        borderTopLeftRadius: isFirstChapter ? 14 : 0,
        borderTopRightRadius: isFirstChapter ? 14 : 0,
      };

      // Use View for read-only mode, PressableScale for interactive
      if (isReadOnly) {
        return (
          <View style={[styles.chapterItem, borderStyle]}>
            <Text
              style={[styles.chapterTitle, { color: themeColors.text }]}
            >
              {item.chapterTitle}
            </Text>
            <Text
              style={[
                styles.chapterDuration,
                { color: themeColors.textMuted },
              ]}
            >
              {formatSecondsToMinutes(item.chapterDuration)}
            </Text>
          </View>
        );
      }

      return (
        <PressableScale
          onPress={() => handleChapterSelect(index)}
          style={{
            ...styles.chapterItem,
            backgroundColor: isActive
              ? themeColors.chapterActive
              : 'transparent',
            ...borderStyle,
          }}
        >
          <Text
            style={{
              ...styles.chapterTitle,
              color: isActive
                ? ensureReadable(
                    themeColors.primary,
                    themeColors.chapterActive,
                  )
                : themeColors.textMuted,
            }}
          >
            {item.chapterTitle}
          </Text>
          <Text
            style={[
              styles.chapterDuration,
              {
                color: isActive
                  ? ensureReadable(
                      themeColors.primary,
                      themeColors.chapterActive,
                    )
                  : themeColors.textMuted,
              },
            ]}
          >
            {formatSecondsToMinutes(item.chapterDuration)}
          </Text>
        </PressableScale>
      );
    },
    [
      book?.chapters?.length,
      activeIndex,
      handleChapterSelect,
      isReadOnly,
    ],
  );

  const keyExtractor = useCallback(
    (item: Chapter) => `${item.url}-${item.chapterNumber}`,
    [],
  );

  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  if (!book?.chapters) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: withOpacity(themeColors.background, 0.92) },
        ]}
      >
        <ActivityIndicator color={themeColors.icon} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottom,
          backgroundColor: withOpacity(themeColors.background, 0.92),
        },
      ]}
    >
      {book.chapters.length > 0 ? (
        <FlashList
          data={book.chapters}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          initialScrollIndex={initialScrollIndex}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ItemSeparator}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
          No chapters found for this book.
        </Text>
      )}
      <Pressable
        onPress={handleClose}
        hitSlop={10}
        style={styles.handleIndicator}
      >
        <CircleX color={themeColors.icon} size={42} strokeWidth={1} />
      </Pressable>
    </View>
  );
};

export default ChapterListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor moved to inline style for theme support
    paddingHorizontal: 4,
    paddingTop: 36,
  },
  loadingContainer: {
    flex: 1,
    // backgroundColor moved to inline style for theme support
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleIndicator: {
    marginTop: 24,
    marginBottom: 12,
    alignSelf: 'center',
  },
  list: {
    flex: 1,
    borderRadius: 7,
  },
  listContent: {
    paddingBottom: 12,
  },
  chapterItem: {
    paddingVertical: 13,
    paddingHorizontal: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterTitle: {
    fontFamily: 'Rubik',
    fontSize: 16,
    maxWidth: '80%',
  },
  chapterDuration: {
    fontFamily: 'Rubik',
    fontSize: 14,
  },
  separator: {
    height: 3,
  },
  emptyText: {
    fontFamily: 'Rubik',
    textAlign: 'center',
  },
});
