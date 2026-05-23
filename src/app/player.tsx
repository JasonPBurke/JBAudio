import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useActiveTrack } from 'react-native-track-player';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { useBookById } from '@/store/library';
import { selectGradientColors } from '@/helpers/gradientColorSorter';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import MeshGradientBackground from '@/components/MeshGradientBackground';
import { normalizeSize } from '@/helpers/normalizeSize';
import {
  CurrentChapterContext,
  useCurrentChapterStable,
} from '@/hooks/useCurrentChapterStable';
import { consumePlayerNavIntent } from '@/store/playerNavIntent';

// Memoized components - extracted to prevent re-renders
import { PlayerArtwork } from '@/components/player/PlayerArtwork';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { PlayerChaptersModal } from '@/modals/PlayerChaptersModal';
import { BookTimeRemaining } from '@/components/BookTimeRemaining';
import { DismissIndicator } from '@/components/DismissIndicator';

const FIXED_ARTWORK_HEIGHT = normalizeSize(375);

// Pre-defined styles to avoid inline object creation on each render
const timeRemainingContainerStyle = { alignItems: 'center' as const };
const loadingContainerStyle = { justifyContent: 'center' as const };

// Flex spacer that grows to its maxHeight at default Display Size but
// collapses toward 0 when window height tightens (e.g. Display Size = Large),
// keeping bottom controls reachable across accessibility settings.
const Spacer = ({
  flex,
  maxHeight,
}: {
  flex: number;
  maxHeight: number;
}) => <View style={{ flex, maxHeight, minHeight: 0 }} />;

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
 */
const PlayerScreen = () => {
  const router = useRouter();

  // Dismiss a ghost-mount caused by navigation state being restored across an
  // Activity recreation with no user-initiated navigation to /player. See
  // src/store/playerNavIntent.ts for the why.
  useEffect(() => {
    if (consumePlayerNavIntent()) return;
    let cancelled = false;
    // Defer back() to a microtask so the root Stack has time to finish
    // mounting — router.back() during the initial commit throws
    // "Attempted to navigate before mounting the Root Layout component."
    queueMicrotask(() => {
      if (cancelled) return;
      router.back();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { colors: themeColors } = useTheme();

  // These hooks only fire on track change, not during playback progress
  const activeTrack = useActiveTrack();
  const book = useBookById(activeTrack?.bookId ?? '');

  // Single shared chapter subscription — broadcast via Context to
  // PlayerChaptersModal and PlayerProgressBar so they don't each open their
  // own TrackPlayer listeners and getProgress() call.
  const currentChapter = useCurrentChapterStable();

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
    <CurrentChapterContext.Provider value={currentChapter}>
      <View style={styles.container}>
        <MeshGradientBackground
          gradientColors={gradientColors}
          artworkColors={book?.artworkColors ?? null}
        />
        <View style={styles.dimOverlay} pointerEvents='none' />
        <View style={styles.overlayContainer}>
          <DismissIndicator />

          {/* Memoized artwork component - only re-renders when artwork/width changes */}
          <PlayerArtwork
            artwork={book?.artwork}
            width={artworkWidth}
            height={FIXED_ARTWORK_HEIGHT}
            onLongPress={handleArtworkLongPress}
          />

          <Spacer flex={1} maxHeight={normalizeSize(50)} />

          {/* Chapter trigger - navigates to chapter list screen */}
          <PlayerChaptersModal
            // darkestColor={withOpacity(gradientColors[3], 0.25)}
            darkestColor={gradientColors[3]}
          />

          <Spacer flex={1.4} maxHeight={normalizeSize(70)} />

          {/* Progress bar uses Reanimated shared values - no React re-renders */}
          <PlayerProgressBar />

          <View style={timeRemainingContainerStyle}>
            {/* Time remaining updates every 5 seconds via event listener */}
            <BookTimeRemaining size={16} color={colors.textMuted} />
          </View>

          <Spacer flex={1} maxHeight={normalizeSize(50)} />

          {/* Memoized controls - uses Reanimated for button animations */}
          <PlayerControls />
        </View>
      </View>
    </CurrentChapterContext.Provider>
  );
};

export default PlayerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withOpacity(colors.background, 0.3),
  },
  overlayContainer: {
    ...defaultStyles.container,
    paddingHorizontal: screenPadding.horizontal,
  },
});
