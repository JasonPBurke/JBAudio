import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useActiveTrack } from 'react-native-track-player';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { useBookById } from '@/store/library';
import { usePlayerStateStore } from '@/store/playerState';
import { selectGradientColors } from '@/helpers/gradientColorSorter';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import MeshGradientBackground from '@/components/MeshGradientBackground';
import { jbaLog } from '@/helpers/debugLog';

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


// Note: defaultGradientColors is now defined inside the component to use theme colors

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
  const router = useRouter();

  const { colors: themeColors } = useTheme();

  // These hooks only fire on track change, not during playback progress
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');

  // Get the setter for tracking player screen dismissal
  const setWasPlayerScreenDismissedToBackground = usePlayerStateStore(
    useCallback(
      (state) => state.setWasPlayerScreenDismissedToBackground,
      [],
    ),
  );

  // App state subscription for dismissing player when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        // P1
        jbaLog('PLR', 'AppState change', {
          prevState: appState.current,
          nextState: nextAppState,
        });
        if (
          appState.current.match(/active|inactive/) &&
          nextAppState === 'background'
        ) {
          // Set flag BEFORE navigating away so we can restore on foreground
          setWasPlayerScreenDismissedToBackground(true);

          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }
        appState.current = nextAppState;
      },
    );
    return () => subscription.remove();
  }, [navigation, setWasPlayerScreenDismissedToBackground]);

  // Memoized artwork width calculation based on aspect ratio
  const artworkWidth = useMemo(() => {
    if (!book?.artworkHeight) return 0;
    return (book.artworkWidth! / book.artworkHeight) * FIXED_ARTWORK_HEIGHT;
  }, [book?.artworkHeight, book?.artworkWidth]);

  // Memoized gradient colors based on artwork colors
  const gradientColors = useMemo(
    () =>
      selectGradientColors(book?.artworkColors, [
        themeColors.background,
        themeColors.primary,
        themeColors.primary,
        themeColors.background,
      ] as const),
    [book?.artworkColors, themeColors.background, themeColors.primary],
  );

  // Handle long press on artwork to navigate to footprints
  const handleArtworkLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/footprintList' as any);
  }, [router]);

  // Loading state - only shown when no active track
  if (!activeTrack) {
    return (
      <View style={[defaultStyles.container, loadingContainerStyle]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MeshGradientBackground
        gradientColors={gradientColors}
        artworkColors={book?.artworkColors ?? null}
      />
      <View style={styles.overlayContainer}>
        <DismissIndicator />

        {/* Memoized artwork component - only re-renders when artwork/width changes */}
        <PlayerArtwork
          artwork={book?.artwork}
          width={artworkWidth}
          onLongPress={handleArtworkLongPress}
        />

        <View style={chapterSectionStyle}>
          {/* Chapter trigger - navigates to chapter list screen */}
          <PlayerChaptersModal
            // darkestColor={withOpacity(gradientColors[3], 0.25)}
            darkestColor={gradientColors[3]}
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
    </View>
  );
};

export default PlayerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlayContainer: {
    ...defaultStyles.container,
    paddingHorizontal: screenPadding.horizontal,
    backgroundColor: withOpacity(colors.background, 0.3),
    // backgroundColor: 'transparent',
  },
});
