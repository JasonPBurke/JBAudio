import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  // BottomSheetFlatListMethods,
  BottomSheetModal,
  // BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCallback, useMemo } from 'react';
import { colors } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { Book, Chapter } from '@/types/Book';
import { Logs } from 'lucide-react-native';
import { MovingText } from './MovingText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveTrack } from 'react-native-track-player';
import { formatSecondsToMinutes } from '@/helpers/miscellaneous';

type PlayerChaptersModalProps = {
  handlePresentPress: () => void;
  book: Book | undefined;
  bottomSheetModalRef: React.ForwardedRef<BottomSheetModal>;
  bgColor: string | undefined;
  onChapterSelect: (chapterIndex: number) => void;
};

export const PlayerChaptersModal = ({
  handlePresentPress,
  book,
  bottomSheetModalRef,
  bgColor = '#1C1C1C',
  onChapterSelect,
}: PlayerChaptersModalProps) => {
  const snapPoints = useMemo(() => ['40%', '70%'], []);

  const { bottom } = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        pressBehavior={'close'}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  const activeTrack = useActiveTrack();

  if (!activeTrack) {
    return (
      <View style={[defaultStyles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <View>
      <Pressable
        onPress={handlePresentPress}
        style={styles.chapterTitleContainer}
      >
        <Logs
          size={24}
          style={{ transform: [{ rotateY: '180deg' }] }}
          color={colors.icon}
          strokeWidth={1.5}
          absoluteStrokeWidth
        />

        <View style={styles.trackTitleContainer}>
          <MovingText
            text={activeTrack.title ?? ''}
            animationThreshold={34}
            style={styles.trackTitleText}
          />
        </View>
      </Pressable>

      <BottomSheetModal
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#12121d' }} //#151422
        style={{ paddingBottom: 10, marginBottom: 10 }}
        handleIndicatorStyle={{
          // borderColor: colors.textMuted,
          // borderWidth: StyleSheet.hairlineWidth,
          backgroundColor: colors.textMuted,
        }}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
      >
        <View style={{ flex: 1, marginBottom: bottom - 12 }}>
          <ChapterList
            book={book}
            activeTrackUrl={activeTrack?.url}
            onChapterSelect={onChapterSelect}
          />
        </View>
      </BottomSheetModal>
    </View>
  );
};

const ChapterList = ({
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
  chapterTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  trackTitleContainer: {
    overflow: 'hidden',
    maxWidth: '80%',
  },
  trackTitleText: {
    flex: 1,
    ...defaultStyles.text,
    fontSize: 18,
    fontWeight: '500',
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
    // color: colors.textMuted,
  },
  chapterDuration: {
    ...defaultStyles.text,
    fontSize: 14,
    color: colors.textMuted,
  },
});
