import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCallback, useMemo } from 'react';
import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { Book, Chapter } from '@/types/Book';
import { Logs } from 'lucide-react-native';
import { MovingText } from './MovingText';
import TrackPlayer, { useActiveTrack } from 'react-native-track-player';

type PlayerChaptersModalProps = {
  handlePresentPress: () => void;
  book: Book | undefined;
  bottomSheetModalRef: React.ForwardedRef<BottomSheetModal>;
  bgColor: string | undefined;
};

export const PlayerChaptersModal = ({
  handlePresentPress,
  book,
  bottomSheetModalRef,
  bgColor = '#1C1C1C',
}: PlayerChaptersModalProps) => {
  const snapPoints = useMemo(() => ['40%', '70%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        pressBehavior={'close'}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        // style={{ backgroundColor: '#1c1c1c0' }}
      />
    ),
    []
  );

  const activeTrack = useActiveTrack();
  console.log('activeTrack', activeTrack?.url);

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
        backgroundStyle={{ backgroundColor: bgColor }}
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
        <ChapterList book={book} activeTrackUrl={activeTrack?.url} />
      </BottomSheetModal>
    </View>
  );
};

const ChapterList = ({
  book,
  activeTrackUrl,
}: {
  book: Book | undefined;
  activeTrackUrl: string | undefined;
}) => {
  const handleChapterChange = async (item: Chapter) => {
    console.log('handleChapterChange event:', item.url);
    const chapterIndex = book?.bookProgress.currentChapterIndex;
    if (chapterIndex === -1) return;
    else if (chapterIndex !== undefined) {
      await TrackPlayer.skip(chapterIndex);
      console.log('TrackPlayer.skip(chapterIndex)', chapterIndex);
      await TrackPlayer.play();
    }
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
          keyExtractor={(item) => item.chapterTitle}
          renderItem={({ item, index }) => {
            const isFirstChapter = index === 0;
            const isLastChapter = index === book.chapters.length - 1;
            return (
              <Pressable
                onPress={() => handleChapterChange(item)}
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
                <Text style={styles.chapterDuration}>{'12:34'}</Text>
              </Pressable>
            );
          }}
          style={{ flex: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
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
    backgroundColor: colors.background,
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
