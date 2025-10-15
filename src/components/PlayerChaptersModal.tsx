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
        <ChapterList book={book} />
      </BottomSheetModal>
    </View>
  );
};

const ChapterList = ({ book }: { book: Book | undefined }) => {
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
          renderItem={({ item }) => {
            return (
              <Pressable
                onPress={() => handleChapterChange(item)}
                style={styles.chapterItem}
              >
                <Text style={styles.chapterTitle}>{item.chapterTitle}</Text>
                {/* // item.duration */}
                <Text style={styles.chapterDuration}>{'12:34'}</Text>
              </Pressable>
            );
          }}
          style={{ flex: 1 }}
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.textMuted,
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
});
