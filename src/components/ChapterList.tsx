import React, { useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { colors } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { Book, Chapter } from '@/types/Book';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';

const ITEM_HEIGHT = 46;
const SEPARATOR_HEIGHT = 3;

export type ChapterListHandle = {
  scrollToActive: () => void;
};

export const ChapterList = React.forwardRef<
  ChapterListHandle,
  {
    book: Book | undefined;
    activeChapter: Chapter | undefined;
    onChapterSelect: (chapterIndex: number) => void;
    bottomSheetModalRef: React.ForwardedRef<BottomSheetModal>;
  }
>(({ book, activeChapter, onChapterSelect, bottomSheetModalRef }, ref) => {
  const flatListRef = useRef<BottomSheetFlatListMethods>(null);

  const activeIndex = useMemo(
    () =>
      book?.chapters?.findIndex(
        (ch) =>
          ch.url === activeChapter?.url &&
          ch.chapterNumber === activeChapter?.chapterNumber
      ) ?? -1,
    [book?.chapters, activeChapter]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  // Expose scrollToActive method via ref
  useImperativeHandle(ref, () => ({
    scrollToActive: () => {
      if (activeIndex > 0 && flatListRef.current) {
        const targetIndex = Math.max(0, activeIndex - 2);
        const offset = (ITEM_HEIGHT + SEPARATOR_HEIGHT) * targetIndex;
        console.log('[ChapterList] scrollToActive called', { targetIndex, offset });
        flatListRef.current.scrollToOffset({
          offset,
          animated: false,
        });
      }
    },
  }), [activeIndex]);

  const handleChapterChange = async (
    chapterIndex: number,
    item: Chapter
  ) => {
    if (item.chapterTitle === activeChapter?.chapterTitle) {
      if (bottomSheetModalRef && 'current' in bottomSheetModalRef) {
        bottomSheetModalRef.current?.dismiss();
      }
      return;
    }
    onChapterSelect(chapterIndex);
  };

  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 4,
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      {book?.chapters && book.chapters.length > 0 ? (
        <BottomSheetFlatList
          data={book.chapters}
          keyExtractor={(item: Chapter) =>
            `${item.url}-${item.chapterNumber}`
          }
          renderItem={({
            item,
            index,
          }: {
            item: Chapter;
            index: number;
          }) => {
            const isFirstChapter = index === 0;
            const isLastChapter = index === book.chapters.length - 1;
            const isActive =
              activeChapter?.url === item.url &&
              activeChapter?.chapterNumber === item.chapterNumber;

            return (
              <Pressable
                onPress={() => handleChapterChange(index, item)}
                style={{
                  ...styles.chapterItem,
                  backgroundColor: isActive
                    ? '#6d6d6d' //'#252e52'
                    : '#1d2233',
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
                {/* // item.duration */}
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
          }}
          ref={flatListRef}
          getItemLayout={getItemLayout}
          style={{ flex: 1, borderRadius: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: 3 }} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text
          style={{
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          No chapters found for this book.
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
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
    // color: colors.textMuted,
  },
  chapterDuration: {
    ...defaultStyles.text,
    fontSize: 14,
    color: colors.textMuted,
  },
});
