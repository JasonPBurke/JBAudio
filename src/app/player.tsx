import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  AppState,
} from 'react-native';
import TrackPlayer, { useActiveTrack } from 'react-native-track-player';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';

import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { useBookById, useLibraryStore } from '@/store/library';

// Memoized components - extracted to prevent re-renders
import { PlayerArtwork } from '@/components/player/PlayerArtwork';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { PlayerChaptersModal } from '@/modals/PlayerChaptersModal';
import { BookTimeRemaining } from '@/components/BookTimeRemaining';
import { DismissIndicator } from '@/components/DismissIndicator';

const FIXED_ARTWORK_HEIGHT = 350;

// Pre-defined styles to avoid inline object creation on each render
const progressBarStyle = { marginTop: 70 };
const timeRemainingContainerStyle = { alignItems: 'center' as const };
const controlsStyle = { marginTop: 50 };
const chapterSectionStyle = { marginTop: 50 };
const loadingContainerStyle = { justifyContent: 'center' as const };
const gradientStyle = { flex: 1 };
const gradientStart = { x: 0, y: 0 };
const gradientEnd = { x: 0.5, y: 1 };
const gradientLocations = [0.15, 0.35, 0.45, 0.6] as const;

// Default gradient colors when no artwork colors are available
const defaultGradientColors = [
  colors.primary,
  colors.primary,
  colors.background,
  colors.background,
] as const;

/**
 * Optimized PlayerScreen component.
 *
 * Key optimizations applied:
 * 1. Pre-defined style objects outside component to avoid new references
 * 2. Memoized child components (PlayerArtwork, PlayerControls, etc.)
 * 3. useCallback for all event handlers
 * 4. useMemo for computed values (gradientColors, artworkWidth)
 * 5. Child components use Reanimated for animations (no React re-renders)
 * 6. Progress-dependent components use event-based updates instead of polling hooks
 *
 * Components that previously caused re-renders during playback:
 * - PlayerProgressBar: Now uses useProgressReanimated (event-based, Reanimated)
 * - BookTimeRemaining: Now uses event-based progress updates (every 5 seconds)
 * - PlayerChaptersModal: Now uses useCurrentChapterStable (event-based)
 *
 * This screen should only re-render when:
 * - Active track changes (useActiveTrack)
 * - Book data changes (useBookById)
 * - App state changes (background/foreground)
 */
const PlayerScreen = () => {
  // App state handling for background dismissal
  const appState = useRef(AppState.currentState);
  const navigation = useNavigation();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // These hooks only fire on track change, not during playback progress
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');

  // Extract only the function we need from the store - avoids unnecessary re-renders
  // when other parts of the store change
  const updateBookChapterIndex = useLibraryStore(
    useCallback((state) => state.updateBookChapterIndex, [])
  );

  // App state subscription for dismissing player when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        if (
          appState.current.match(/active|inactive/) &&
          nextAppState === 'background'
        ) {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }
        appState.current = nextAppState;
      }
    );
    return () => subscription.remove();
  }, [navigation]);

  // Memoized callback for presenting the chapters modal
  const handlePresentPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  // Memoized callback for handling chapter selection
  const handleChapterSelect = useCallback(
    async (chapterIndex: number) => {
      if (!book?.bookId || !book.chapters) return;

      // Check if it's a single-file book (one audio file with embedded chapters)
      const isSingleFileBook =
        book.chapters.length > 1 &&
        book.chapters.every((c) => c.url === book.chapters[0].url);

      if (isSingleFileBook) {
        // For single-file books, seek to chapter start time
        const selectedChapter = book.chapters[chapterIndex];
        const seekTime = (selectedChapter.startMs || 0) / 1000;
        await TrackPlayer.seekTo(seekTime);
      } else {
        // For multi-file books, skip to the track
        await TrackPlayer.skip(chapterIndex);
      }

      await TrackPlayer.play();
      await TrackPlayer.setVolume(1);
      await updateBookChapterIndex(book.bookId, chapterIndex);
      bottomSheetModalRef.current?.dismiss();
    },
    [book, updateBookChapterIndex]
  );

  // Memoized artwork width calculation based on aspect ratio
  const artworkWidth = useMemo(() => {
    if (!book?.artworkHeight) return 0;
    return (book.artworkWidth! / book.artworkHeight) * FIXED_ARTWORK_HEIGHT;
  }, [book?.artworkHeight, book?.artworkWidth]);

  // Memoized gradient colors based on artwork colors
  const gradientColors = useMemo(
    () =>
      book?.artworkColors
        ? ([
            book.artworkColors.darkVibrant as string,
            book.artworkColors.lightVibrant as string,
            book.artworkColors.vibrant as string,
            book.artworkColors.darkMuted as string,
          ] as const)
        : defaultGradientColors,
    [book?.artworkColors]
  );

  // Loading state - only shown when no active track
  if (!activeTrack) {
    return (
      <View style={[defaultStyles.container, loadingContainerStyle]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <LinearGradient
      start={gradientStart}
      end={gradientEnd}
      locations={gradientLocations}
      style={gradientStyle}
      colors={gradientColors}
    >
      <View style={styles.overlayContainer}>
        <DismissIndicator />

        {/* Memoized artwork component - only re-renders when artwork/width changes */}
        <PlayerArtwork artwork={book?.artwork} width={artworkWidth} />

        <View style={chapterSectionStyle}>
          {/* Memoized chapters modal - uses stable chapter hook */}
          <PlayerChaptersModal
            book={book}
            handlePresentPress={handlePresentPress}
            bottomSheetModalRef={bottomSheetModalRef}
            onChapterSelect={handleChapterSelect}
          />

          {/* Progress bar uses Reanimated shared values - no React re-renders */}
          <PlayerProgressBar style={progressBarStyle} />

          <View style={timeRemainingContainerStyle}>
            {/* Time remaining updates every 5 seconds via event listener */}
            <BookTimeRemaining size={16} color={colors.textMuted} />
          </View>

          {/* Memoized controls - uses Reanimated for button animations */}
          <PlayerControls style={controlsStyle} />
        </View>
      </View>
    </LinearGradient>
  );
};

export default PlayerScreen;

const styles = StyleSheet.create({
  overlayContainer: {
    ...defaultStyles.container,
    paddingHorizontal: screenPadding.horizontal,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
