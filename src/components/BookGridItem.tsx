import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from 'pressto';
import { FadeInImage } from '@/components/FadeInImage';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import LoaderKitView from 'react-native-loader-kit';
import { Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { useBookById, useBookDisplayData } from '@/store/library';
import { unknownBookImageUri } from '@/constants/images';
import {
  useIsBookActive,
  useIsBookActiveAndPlaying,
} from '@/store/playerState';
import TrackPlayer, { State } from 'react-native-track-player';
import { recordFootprint } from '@/db/footprintQueries';

export type BookGridItemProps = {
  bookId: string;
  flowDirection: 'row' | 'column';
  numColumns?: number;
  itemWidth?: number;
};

// This is the memoized component. It only re-renders if its props change,
// or if the data from the `useBookDisplayData` hook changes (checked by `shallow`).
export const BookGridItem = memo(function BookGridItem({
  bookId,
  flowDirection,
  numColumns = 2,
  itemWidth = 0,
}: BookGridItemProps) {
  const router = useRouter();
  const { colors: themeColors } = useTheme();

  const bookData = useBookDisplayData(bookId);
  const fullBook = useBookById(bookId);

  if (!bookId || !bookData || !fullBook) return null;

  const { author, bookTitle, artwork, artworkHeight, artworkWidth } =
    bookData;

  // Fallback dimensions for when artwork extraction fails (default image is 500x500)
  const safeArtworkWidth = artworkWidth ?? 500;
  const safeArtworkHeight = artworkHeight ?? 500;

  const { setActiveBookId, activeBookId } = useQueueStore();
  // const isActiveBook = useActiveTrack()?.bookId === bookId;
  const isActiveBook = useIsBookActive(bookId);
  const isActiveAndPlaying = useIsBookActiveAndPlaying(bookId);
  const handlePress = useCallback(() => {
    router.navigate({
      pathname: '/titleDetails',
      params: { bookId, author, bookTitle },
    });
  }, [router, bookId, author, bookTitle]);

  const handlePressPlay = useCallback(async () => {
    if (!fullBook) return;
    const playbackState = await TrackPlayer.getPlaybackState();
    const isCurrentlyPlaying = playbackState.state === State.Playing;

    // Record footprint before playing (only if this is the active book)
    if (!isCurrentlyPlaying) {
      try {
        const activeTrack = await TrackPlayer.getActiveTrack();
        if (activeTrack?.bookId === bookId) {
          await recordFootprint(bookId, 'play');
        }
      } catch {
        // Silently fail if footprint recording fails
      }
    }

    handleBookPlay(
      fullBook,
      isCurrentlyPlaying,
      isActiveBook,
      activeBookId,
      setActiveBookId,
    );
  }, [fullBook, isActiveBook, activeBookId, setActiveBookId, bookId]);

  // Consolidated memoized styles - single dependency comparison instead of five
  const itemStyles = useMemo(() => {
    const isRow = flowDirection === 'row';
    const aspectRatio = safeArtworkWidth / safeArtworkHeight;

    return {
      container: isRow
        ? { height: 205, width: aspectRatio * 160 }
        : { width: itemWidth, height: (1 / aspectRatio) * itemWidth + 75 },
      imageContainer: isRow
        ? { height: 140, width: aspectRatio * 140 }
        : {
            paddingTop: 10,
            width: itemWidth + 2,
            height: (1 / aspectRatio) * itemWidth + 12,
          },
      bookInfo: {
        ...styles.bookInfoContainer,
        width: isRow ? aspectRatio * 150 - 10 : itemWidth,
      },
      bookTitle: {
        ...styles.bookTitleText,
        color: isActiveBook
          ? withOpacity(themeColors.primary, 0.75)
          : themeColors.text,
        fontSize: isRow
          ? fontSize.xs
          : numColumns === 1
            ? fontSize.lg
            : numColumns === 2
              ? fontSize.sm
              : 14,
      },
      bookAuthor: {
        ...styles.bookAuthorText,
        color: themeColors.textMuted,
        fontSize: isRow
          ? 10
          : numColumns === 1
            ? fontSize.sm
            : fontSize.xs,
      },
      // Pre-compute icon sizing to avoid inline object creation
      iconPadding: isRow ? 16 : numColumns === 1 ? 24 : numColumns === 2 ? 20 : 17,
      iconBottom: isRow ? 2 : 12,
      iconSize: isRow ? 20 : numColumns === 1 ? 32 : numColumns === 2 ? 24 : 18,
      playIconSize: isRow ? 20 : numColumns === 1 ? 36 : numColumns === 2 ? 28 : 22,
    };
  }, [
    flowDirection,
    itemWidth,
    safeArtworkWidth,
    safeArtworkHeight,
    numColumns,
    isActiveBook,
    themeColors.primary,
    themeColors.text,
    themeColors.textMuted,
  ]);

  // Memoize dynamic icon styles that depend on theme colors
  const playingIconStyle = useMemo(
    () => [
      styles.playingIconBase,
      {
        padding: itemStyles.iconPadding,
        bottom: itemStyles.iconBottom,
        backgroundColor: withOpacity(themeColors.background, 0.59),
      },
    ],
    [itemStyles.iconPadding, itemStyles.iconBottom, themeColors.background],
  );

  const pausedIconStyle = useMemo(
    () => [
      styles.pausedIconBase,
      {
        bottom: itemStyles.iconBottom,
        backgroundColor: withOpacity(themeColors.background, 0.59),
      },
    ],
    [itemStyles.iconBottom, themeColors.background],
  );

  const loaderStyle = useMemo(
    () => ({ width: itemStyles.iconSize, aspectRatio: 1 }),
    [itemStyles.iconSize],
  );

  return (
    <PressableScale
      rippleRadius={0}
      style={styles.pressableContainer}
      onPress={handlePress}
    >
      <View style={[styles.containerBase, itemStyles.container]}>
        <View style={itemStyles.imageContainer}>
          <FadeInImage
            source={{ uri: artwork ?? unknownBookImageUri }}
            style={styles.bookArtworkImage}
            resizeMode='contain'
          />
          {isActiveAndPlaying ? (
            <View style={playingIconStyle}>
              <LoaderKitView
                style={loaderStyle}
                name={'LineScaleParty'}
                color={themeColors.primary}
              />
            </View>
          ) : (
            <PressableScale
              rippleRadius={0}
              onPress={handlePressPlay}
              style={pausedIconStyle}
              hitSlop={10}
            >
              <Play
                size={itemStyles.playIconSize}
                color={themeColors.icon}
                strokeWidth={1}
                absoluteStrokeWidth
              />
            </PressableScale>
          )}
        </View>
        <View style={itemStyles.bookInfo}>
          <Text
            numberOfLines={numColumns === 1 ? 1 : 2}
            style={itemStyles.bookTitle}
          >
            {bookTitle}
          </Text>

          {author && (
            <Text numberOfLines={1} style={itemStyles.bookAuthor}>
              {author}
            </Text>
          )}
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  pressableContainer: {
    paddingTop: 4,
    alignItems: 'center',
    marginBottom: 8,
  },
  containerBase: {
    alignItems: 'center',
  },
  bookArtworkImage: {
    height: '100%',
    width: '100%',
    borderRadius: 3,
  },
  bookInfoContainer: {
    height: 50,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontFamily: 'Rubik-SemiBold',
    maxWidth: '100%',
    marginTop: 2,
  },
  bookAuthorText: {
    fontFamily: 'Rubik',
    marginTop: 4,
  },
  playingIconBase: {
    position: 'absolute',
    right: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pausedIconBase: {
    position: 'absolute',
    right: 2,
    padding: 6,
    borderRadius: 4,
  },
});
