import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from 'pressto';
import { FadeInImage } from '@/components/FadeInImage';
import { fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { useTheme } from '@/hooks/useTheme';
import LoaderKitView from 'react-native-loader-kit';
import { Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { BookDurationRow } from '@/components/BookDurationRow';
import { useBookById, useBookDisplayData } from '@/store/library';
import { unknownBookImageUri } from '@/constants/images';
import {
  useIsBookActive,
  useIsBookActiveAndPlaying,
} from '@/store/playerState';
import TrackPlayer, { State } from 'react-native-track-player';
import { recordFootprint } from '@/db/footprintQueries';
import { Book } from '@/types/Book';

export type BookGridItemProps = {
  bookId: string;
  flowDirection: 'row' | 'column';
  numColumns?: number;
  itemWidth?: number;
};

type BookPlayButtonProps = {
  bookId: string;
  fullBook: Book;
  iconPadding: number;
  iconBottom: number;
  iconSize: number;
  playIconSize: number;
};

const BookPlayButton = memo(function BookPlayButton({
  bookId,
  fullBook,
  iconPadding,
  iconBottom,
  iconSize,
  playIconSize,
}: BookPlayButtonProps) {
  const { colors: themeColors } = useTheme();
  const activeBookId = useQueueStore((state) => state.activeBookId);
  const setActiveBookId = useQueueStore((state) => state.setActiveBookId);
  const isActiveBook = useIsBookActive(bookId);
  const isActiveAndPlaying = useIsBookActiveAndPlaying(bookId);

  const handlePressPlay = useCallback(async () => {
    const playbackState = await TrackPlayer.getPlaybackState();
    const isCurrentlyPlaying = playbackState.state === State.Playing;

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

  const playingIconStyle = useMemo(
    () => [
      styles.playingIconBase,
      {
        padding: iconPadding,
        bottom: iconBottom,
        backgroundColor: themeColors.backgroundAlpha59,
      },
    ],
    [iconPadding, iconBottom, themeColors.backgroundAlpha59],
  );

  const pausedIconStyle = useMemo(
    () => [
      styles.pausedIconBase,
      {
        bottom: iconBottom,
        backgroundColor: themeColors.backgroundAlpha59,
      },
    ],
    [iconBottom, themeColors.backgroundAlpha59],
  );

  const loaderStyle = useMemo(
    () => ({ width: iconSize, aspectRatio: 1 }),
    [iconSize],
  );

  if (isActiveAndPlaying) {
    return (
      <View style={playingIconStyle}>
        <LoaderKitView
          style={loaderStyle}
          name={'LineScaleParty'}
          color={themeColors.primary}
        />
      </View>
    );
  }

  return (
    <PressableScale
      rippleRadius={0}
      onPress={handlePressPlay}
      style={pausedIconStyle}
      hitSlop={10}
    >
      <Play
        size={playIconSize}
        color={themeColors.icon}
        strokeWidth={1}
        absoluteStrokeWidth
      />
    </PressableScale>
  );
});

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

  const isActiveBook = useIsBookActive(bookId);

  const handlePress = useCallback(() => {
    router.navigate({
      pathname: '/titleDetails',
      params: { bookId, author, bookTitle },
    });
  }, [router, bookId, author, bookTitle]);

  const isRow = flowDirection === 'row';

  // Stable across recycling — only recomputes when layout config or theme changes
  const layoutStyles = useMemo(
    () => ({
      bookTitle: {
        ...styles.bookTitleText,
        color: isActiveBook ? themeColors.primaryAlpha75 : themeColors.text,
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
        fontSize: isRow ? 10 : numColumns === 1 ? fontSize.sm : fontSize.xs,
      },
      iconPadding: isRow ? 6 : 8,
      iconBottom: isRow ? 2 : 12,
      iconSize: isRow
        ? 20
        : numColumns === 1
          ? 32
          : numColumns === 2
            ? 24
            : 18,
      playIconSize: isRow
        ? 20
        : numColumns === 1
          ? 36
          : numColumns === 2
            ? 28
            : 22,
    }),
    [
      isRow,
      numColumns,
      isActiveBook,
      themeColors.primaryAlpha75,
      themeColors.text,
      themeColors.textMuted,
    ],
  );

  // Per-item — only recomputes when artwork aspect ratio changes during recycling
  const itemDimensions = useMemo(() => {
    const aspectRatio = safeArtworkWidth / safeArtworkHeight;
    return {
      container: isRow
        ? { height: 220, width: aspectRatio * 160 }
        : { width: itemWidth, height: (1 / aspectRatio) * itemWidth + 90 },
      imageContainer: isRow
        ? { height: 140, width: aspectRatio * 140 }
        : {
            paddingTop: 10,
            width: itemWidth + 2,
            height: (1 / aspectRatio) * itemWidth + 12,
          },
      bookInfoWidth: isRow ? aspectRatio * 150 - 10 : itemWidth,
    };
  }, [isRow, itemWidth, safeArtworkWidth, safeArtworkHeight]);

  return (
    <PressableScale
      rippleRadius={0}
      style={styles.pressableContainer}
      onPress={handlePress}
    >
      <View style={[styles.containerBase, itemDimensions.container]}>
        <View style={itemDimensions.imageContainer}>
          <FadeInImage
            source={{ uri: artwork ?? unknownBookImageUri }}
            style={styles.bookArtworkImage}
            resizeMode='contain'
          />
          <BookPlayButton
            bookId={bookId}
            fullBook={fullBook}
            iconPadding={layoutStyles.iconPadding}
            iconBottom={layoutStyles.iconBottom}
            iconSize={layoutStyles.iconSize}
            playIconSize={layoutStyles.playIconSize}
          />
        </View>
        <View
          style={[
            styles.bookInfoContainer,
            { width: itemDimensions.bookInfoWidth },
          ]}
        >
          <Text
            numberOfLines={numColumns === 1 ? 1 : 2}
            style={layoutStyles.bookTitle}
          >
            {bookTitle}
          </Text>

          {author && (
            <Text numberOfLines={1} style={layoutStyles.bookAuthor}>
              {author}
            </Text>
          )}
          <BookDurationRow
            book={fullBook}
            fontSize={
              flowDirection === 'row'
                ? 9
                : numColumns === 1
                  ? 13
                  : numColumns === 2
                    ? 11
                    : 9
            }
            barHeight={
              flowDirection === 'row' ? 3 : numColumns === 1 ? 4 : 3
            }
            style={{
              marginTop: 3,
              maxWidth: numColumns === 1 ? '40%' : undefined,
            }}
          />
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
    height: 68,
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
