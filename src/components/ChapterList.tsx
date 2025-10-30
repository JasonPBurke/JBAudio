import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { colors } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { Book, Chapter } from '@/types/Book';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';

export const ChapterList = ({
  book,
  activeTrackUrl,
  onChapterSelect,
}: {
  book: Book | undefined;
  activeTrackUrl: string | undefined;
  onChapterSelect: (chapterIndex: number) => void;
}) => {
  const handleChapterChange = async (chapterIndex: number) => {
    onChapterSelect(chapterIndex);
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
      }}
    >
      {book?.chapters && book.chapters.length > 0 ? (
        <BottomSheetFlatList
          data={book.chapters}
          keyExtractor={(item: Chapter) => item.url}
          renderItem={({
            item,
            index,
          }: {
            item: Chapter;
            index: number;
          }) => {
            const isFirstChapter = index === 0;
            const isLastChapter = index === book.chapters.length - 1;
            return (
              <Pressable
                onPress={() => handleChapterChange(index)}
                style={{
                  ...styles.chapterItem,
                  borderBottomLeftRadius: isLastChapter ? 20 : 0,
                  borderBottomRightRadius: isLastChapter ? 20 : 0,
                  borderTopLeftRadius: isFirstChapter ? 20 : 0,
                  borderTopRightRadius: isFirstChapter ? 20 : 0,
                }}
              >
                <Text
                  style={{
                    ...styles.chapterTitle,
                    color:
                      activeTrackUrl === item.url
                        ? colors.primary
                        : colors.textMuted,
                  }}
                >
                  {item.chapterTitle}
                </Text>
                {/* // item.duration */}
                <Text style={styles.chapterDuration}>
                  {formatSecondsToMinutes(item.chapterDuration)}
                </Text>
              </Pressable>
            );
          }}
          // getItemLayout={getItemLayout}
          // ref={flatListRef}
          style={{ flex: 1 }}
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
};

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
