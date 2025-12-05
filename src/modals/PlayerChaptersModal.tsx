import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useCallback, useMemo } from 'react';
import { colors } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { Book } from '@/types/Book';
import { Logs } from 'lucide-react-native';
import { MovingText } from '../components/MovingText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentChapter } from '@/hooks/useCurrentChapter';
import { ChapterList } from '../components/ChapterList';

type PlayerChaptersModalProps = {
  handlePresentPress: () => void;
  book: Book | undefined;
  bottomSheetModalRef: React.ForwardedRef<BottomSheetModal>;
  onChapterSelect: (chapterIndex: number) => void;
};

export const PlayerChaptersModal = ({
  handlePresentPress,
  book,
  bottomSheetModalRef,
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

  const currentChapter = useCurrentChapter();

  if (!currentChapter) {
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
            text={currentChapter.chapterTitle ?? ''}
            animationThreshold={34}
            style={styles.trackTitleText}
          />
        </View>
      </Pressable>

      <BottomSheetModal
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#151520' }} //#12121d
        handleComponent={() => {
          return (
            <Pressable
              hitSlop={10}
              style={styles.handleIndicator}
              onPress={() => {
                if (
                  bottomSheetModalRef &&
                  'current' in bottomSheetModalRef
                ) {
                  bottomSheetModalRef.current?.dismiss();
                }
              }}
            />
          );
        }}
        // handleIndicatorStyle={styles.handleIndicator}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
      >
        <View style={{ flex: 1, marginBottom: bottom - 12 }}>
          <ChapterList
            book={book}
            activeChapter={currentChapter}
            onChapterSelect={onChapterSelect}
            bottomSheetModalRef={bottomSheetModalRef}
          />
        </View>
      </BottomSheetModal>
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
  handleIndicator: {
    marginTop: 12,
    borderColor: colors.textMuted,
    borderWidth: 1,
    width: 55,
    height: 7,
    backgroundColor: '#1c1c1ca9',
    borderRadius: 50,
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
