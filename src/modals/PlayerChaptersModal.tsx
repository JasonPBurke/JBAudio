import React, { useCallback, useMemo } from 'react';
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
import { colors } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { Book } from '@/types/Book';
import { Logs } from 'lucide-react-native';
import { MovingText } from '../components/MovingText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentChapterStable } from '@/hooks/useCurrentChapterStable';
import { ChapterList } from '../components/ChapterList';

// Pre-defined styles to avoid inline object creation
const logsIconStyle = { transform: [{ rotateY: '180deg' as const }] };
const loadingContainerStyle = [
  defaultStyles.container,
  { justifyContent: 'center' as const },
];
const backgroundStyle = { backgroundColor: '#151520ea' };

type PlayerChaptersModalProps = {
  handlePresentPress: () => void;
  book: Book | undefined;
  bottomSheetModalRef: React.ForwardedRef<BottomSheetModal>;
  onChapterSelect: (chapterIndex: number) => void;
};

/**
 * Optimized PlayerChaptersModal component.
 *
 * Key optimizations:
 * 1. Uses useCurrentChapterStable instead of useCurrentChapter (event-based, not polling)
 * 2. Wrapped in React.memo to prevent re-renders from parent
 * 3. Pre-defined styles outside component to avoid new object references
 * 4. Memoized callbacks and render functions
 */
export const PlayerChaptersModal = React.memo(
  ({
    handlePresentPress,
    book,
    bottomSheetModalRef,
    onChapterSelect,
  }: PlayerChaptersModalProps) => {
    const snapPoints = useMemo(() => ['40%', '70%'], []);
    const { bottom } = useSafeAreaInsets();

    // Memoize the content container style based on bottom inset
    const contentContainerStyle = useMemo(
      () => ({ flex: 1, marginBottom: bottom - 12 }),
      [bottom]
    );

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

    // Handle indicator component - memoized to avoid recreation
    const handleComponent = useCallback(() => {
      return (
        <Pressable
          hitSlop={10}
          style={styles.handleIndicator}
          onPress={() => {
            if (bottomSheetModalRef && 'current' in bottomSheetModalRef) {
              bottomSheetModalRef.current?.dismiss();
            }
          }}
        />
      );
    }, [bottomSheetModalRef]);

    // Use the stable current chapter hook - only re-renders when chapter actually changes
    const currentChapter = useCurrentChapterStable();

    if (!currentChapter) {
      return (
        <View style={loadingContainerStyle}>
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
            style={logsIconStyle}
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
          backgroundStyle={backgroundStyle}
          handleComponent={handleComponent}
          enableDynamicSizing={false}
          backdropComponent={renderBackdrop}
          ref={bottomSheetModalRef}
          index={0}
          snapPoints={snapPoints}
        >
          <View style={contentContainerStyle}>
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
  }
);

PlayerChaptersModal.displayName = 'PlayerChaptersModal';

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
