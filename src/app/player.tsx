import React, { useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { useBookById } from '@/store/library';
import { useActiveBookId } from '@/store/playerState';
import { selectGradientColors } from '@/helpers/gradientColorSorter';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import MeshGradientBackground from '@/components/MeshGradientBackground';
import { normalizeSize } from '@/helpers/normalizeSize';
import { computePlayerArtworkSize } from '@/helpers/artworkSizing';
import {
  CurrentChapterContext,
  useCurrentChapterStable,
} from '@/hooks/useCurrentChapterStable';
import { consumePlayerNavIntent } from '@/store/playerNavIntent';

// Memoized components - extracted to prevent re-renders
import {
  PlayerArtwork,
  ARTWORK_MARGIN_TOP,
  ARTWORK_MARGIN_BOTTOM,
} from '@/components/player/PlayerArtwork';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { PlayerChaptersModal } from '@/modals/PlayerChaptersModal';
import { BookTimeRemaining } from '@/components/BookTimeRemaining';
import {
  DismissIndicator,
  DISMISS_INDICATOR_HEIGHT,
} from '@/components/DismissIndicator';

// Spacer ceilings, shared with PLAYER_CHROME_HEIGHT below so the budget can
// never drift from what the column actually renders.
const SPACER_MAX_ABOVE_CHAPTERS = normalizeSize(50);
const SPACER_MAX_ABOVE_PROGRESS = normalizeSize(70);
const SPACER_MAX_ABOVE_CONTROLS = normalizeSize(50);

// Measured heights of the children that have no exported constant of their own.
const CHAPTER_ROW_HEIGHT = 36; // 24 icon + 6 paddingVertical x2
const PROGRESS_BAR_HEIGHT = 30; // 2 slider + 10 marginTop + ~18 time row
const TIME_REMAINING_HEIGHT = 20; // single 16pt line
const CONTROLS_HEIGHT = 95; // play/pause Pressable, 70 icon x 1.35

/**
 * Vertical dp every player child except the artwork consumes.
 *
 * The controls are the fixed budget and the cover art is the remainder: this
 * total plus the bottom safe-area inset is reserved first, and whatever height
 * is left goes to the artwork. That is what keeps every control on screen on
 * phones, tablets and foldables alike.
 *
 * Being slightly wrong degrades gracefully in both directions — underestimate
 * and the Spacers compress, overestimate and there is a little more trailing
 * space. The controls stay clear either way, because paddingBottom reserves
 * insets.bottom independently of this constant.
 */
const PLAYER_CHROME_HEIGHT =
  DISMISS_INDICATOR_HEIGHT +
  ARTWORK_MARGIN_TOP +
  ARTWORK_MARGIN_BOTTOM +
  SPACER_MAX_ABOVE_CHAPTERS +
  SPACER_MAX_ABOVE_PROGRESS +
  SPACER_MAX_ABOVE_CONTROLS +
  CHAPTER_ROW_HEIGHT +
  PROGRESS_BAR_HEIGHT +
  TIME_REMAINING_HEIGHT +
  CONTROLS_HEIGHT;

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
 * - The Active Book changes (the playerState store mirror)
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
  }, [router]);

  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  // Not the module-scope Dimensions read in normalizeSize: this has to follow
  // rotation, unfolding and multi-window resizes.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // These hooks only fire on Book change, not during playback progress
  const activeBookId = useActiveBookId();
  const book = useBookById(activeBookId ?? '');

  // Single shared chapter subscription — broadcast via Context to
  // PlayerChaptersModal and PlayerProgressBar so they don't each open their
  // own TrackPlayer listeners and getProgress() call.
  const currentChapter = useCurrentChapterStable();

  // Cover art takes whatever height is left after the chrome and the nav bar,
  // bounded by the screen width so it cannot overflow horizontally.
  const artworkSize = useMemo(
    () =>
      computePlayerArtworkSize({
        aspectRatio: book?.artworkHeight
          ? book.artworkWidth! / book.artworkHeight
          : 0,
        windowWidth,
        windowHeight,
        bottomInset: insets.bottom,
        chromeHeight: PLAYER_CHROME_HEIGHT,
        horizontalPadding: screenPadding.horizontal,
      }),
    [
      book?.artworkHeight,
      book?.artworkWidth,
      windowWidth,
      windowHeight,
      insets.bottom,
    ],
  );

  // Reserves the Android navigation bar, which draws over the column's last
  // child (PlayerControls) under edge-to-edge. Phones have trailing slack so
  // this is a visual no-op there; on tablets it is what stops the controls
  // being buried by the taskbar.
  const overlayContainerStyle = useMemo(
    () => [styles.overlayContainer, { paddingBottom: insets.bottom }],
    [insets.bottom],
  );

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

  // Loading state - only shown when the Player has no Book loaded
  if (!activeBookId) {
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
        <View style={overlayContainerStyle}>
          <DismissIndicator />

          {/* Memoized artwork component - only re-renders when artwork/width changes */}
          <PlayerArtwork
            artwork={book?.artwork}
            width={artworkSize.width}
            height={artworkSize.height}
            onLongPress={handleArtworkLongPress}
          />

          <Spacer flex={1} maxHeight={SPACER_MAX_ABOVE_CHAPTERS} />

          {/* Chapter trigger - navigates to chapter list screen */}
          <PlayerChaptersModal
            // darkestColor={withOpacity(gradientColors[3], 0.25)}
            darkestColor={gradientColors[3]}
          />

          <Spacer flex={1.4} maxHeight={SPACER_MAX_ABOVE_PROGRESS} />

          {/* Progress bar uses Reanimated shared values - no React re-renders */}
          <PlayerProgressBar />

          <View style={timeRemainingContainerStyle}>
            {/* Time remaining updates every 5 seconds via event listener */}
            <BookTimeRemaining size={16} color={colors.textMuted} />
          </View>

          <Spacer flex={1} maxHeight={SPACER_MAX_ABOVE_CONTROLS} />

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
