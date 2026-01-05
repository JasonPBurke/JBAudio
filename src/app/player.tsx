import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  AppState,
} from 'react-native';
import TrackPlayer, { useActiveTrack } from 'react-native-track-player';
import { ShadowedView, shadowStyle } from 'react-native-fast-shadow';
import { Image } from 'expo-image';
import { unknownBookImageUri } from '@/constants/images';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayerChaptersModal } from '@/modals/PlayerChaptersModal';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useBookById, useLibraryStore } from '@/store/library';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
// import ProgressCircle from '@/components/ProgressCircle';
import { BookTimeRemaining } from '@/components/BookTimeRemaining';
import { DismissIndicator } from '@/components/DismissIndicator';
import { useNavigation } from '@react-navigation/native';

const PlayerScreen = () => {
  //! REMOVE TO STOP UNMOUNT ON BACKGROUNDING
  const appState = useRef(AppState.currentState);
  const navigation = useNavigation();

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        if (
          appState.current.match(/active|inactive/) &&
          nextAppState === 'background'
        ) {
          // App is moving to the background (which includes screen lock)
          // console.log('App has gone to the background, closing page.');

          // Use navigation action to go back or pop the screen
          if (navigation.canGoBack()) {
            navigation.goBack();
            // Alternatively, for stack navigation: navigation.pop();
          }
        }
        appState.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);
  //! REMOVE TO STOP UNMOUNT ON BACKGROUNDING

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');
  const { updateBookChapterIndex } = useLibraryStore();

  const handlePresentPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleChapterSelect = useCallback(
    async (chapterIndex: number) => {
      if (!book?.bookId || !book.chapters) return;

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

      bottomSheetModalRef.current?.dismiss();
    },
    [book, updateBookChapterIndex]
  );

  const artworkImageContainerStyle = useMemo(
    () => ({
      ...styles.artworkImageContainer,
      width: book?.artworkHeight
        ? (book.artworkWidth! / book.artworkHeight) * FIXED_ARTWORK_HEIGHT
        : 0,
    }),
    [book?.artworkHeight, book?.artworkWidth]
  );

  const gradientColors = useMemo(
    () =>
      book?.artworkColors
        ? ([
            book.artworkColors.darkVibrant as string,
            book.artworkColors.lightVibrant as string,
            book.artworkColors.vibrant as string,
            book.artworkColors.darkMuted as string,
          ] as const)
        : ([
            colors.primary,
            colors.primary,
            colors.background,
            colors.background,
          ] as const),
    [book?.artworkColors]
  );

  if (!activeTrack) {
    return (
      <View style={[defaultStyles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      locations={[0.15, 0.35, 0.45, 0.6]}
      style={{ flex: 1 }}
      colors={gradientColors}
    >
      <View style={styles.overlayContainer}>
        <DismissIndicator />
        <View style={artworkImageContainerStyle}>
          <ShadowedView
            style={shadowStyle({
              opacity: 0.4,
              radius: 12,
              offset: [5, 3],
            })}
          >
            <Image
              contentFit='contain'
              source={{
                uri: book?.artwork ?? unknownBookImageUri,
              }}
              style={styles.artworkImage}
            />
          </ShadowedView>
          {/* <ProgressCircle size={50} /> */}
        </View>

        <View style={{ marginTop: 50 }}>
          <PlayerChaptersModal
            book={book}
            handlePresentPress={handlePresentPress}
            bottomSheetModalRef={bottomSheetModalRef}
            onChapterSelect={handleChapterSelect}
          />
          <PlayerProgressBar style={{ marginTop: 70 }} />
          <View style={{ alignItems: 'center' }}>
            <BookTimeRemaining size={16} color={colors.textMuted} />
          </View>
          <PlayerControls style={{ marginTop: 50 }} />
        </View>
      </View>
    </LinearGradient>
  );
};

export default PlayerScreen;

const FIXED_ARTWORK_HEIGHT = 350;

const styles = StyleSheet.create({
  overlayContainer: {
    ...defaultStyles.container,
    paddingHorizontal: screenPadding.horizontal,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  artworkImageContainer: {
    marginVertical: 60,
    alignSelf: 'center',
    height: FIXED_ARTWORK_HEIGHT,
  },
  artworkImage: {
    height: FIXED_ARTWORK_HEIGHT,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 6,
  },
  chapterItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.textMuted,
  },
  chapterTitle: {
    ...defaultStyles.text,
    fontSize: 16,
  },
  chapterDuration: {
    ...defaultStyles.text,
    fontSize: 14,
    color: colors.textMuted,
  },
});
