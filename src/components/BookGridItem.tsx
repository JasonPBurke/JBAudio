import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from 'pressto';
import FastImage from '@d11/react-native-fast-image';
import { fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { useTheme } from '@/hooks/useTheme';
import LoaderKitView from 'react-native-loader-kit';
import { Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { awaitPlayerReady } from '@/helpers/awaitPlayerReady';
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
import { setTitleDetailsNavIntent } from '@/store/titleDetailsNavIntent';

/** Row-flow ("horizontal shelf") geometry. BooksHorizontal derives its own
 *  container height from ROW_ITEM_HEIGHT so the two files cannot drift apart —
 *  they previously both hardcoded 220, which did not mean the same thing in
 *  each place and left only 2px of headroom before visible content clipped. */
export const ROW_COVER_HEIGHT = 140;
export const ROW_INFO_HEIGHT = 68;
const ROW_PADDING_TOP = 4;
const ROW_MARGIN_BOTTOM = 8;
export const ROW_ITEM_HEIGHT =
  ROW_PADDING_TOP + ROW_COVER_HEIGHT + ROW_INFO_HEIGHT + ROW_MARGIN_BOTTOM; // 220

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
  iconRight: number;
  iconSize: number;
  playIconSize: number;
};

const BookPlayButton = memo(function BookPlayButton({
  bookId,
  fullBook,
  iconPadding,
  iconBottom,
  iconRight,
  iconSize,
  playIconSize,
}: BookPlayButtonProps) {
  const { colors: themeColors } = useTheme();
  const activeBookId = useQueueStore((state) => state.activeBookId);
  const setActiveBookId = useQueueStore((state) => state.setActiveBookId);
  const isActiveBook = useIsBookActive(bookId);
  const isActiveAndPlaying = useIsBookActiveAndPlaying(bookId);

  const handlePressPlay = useCallback(async () => {
    await awaitPlayerReady();
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
        right: iconRight,
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
        right: iconRight,
        backgroundColor: themeColors.backgroundAlpha59,
      },
    ],
    [iconBottom, iconRight, themeColors.backgroundAlpha59],
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
          animationSpeedMultiplier={0.55}
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

  const isActiveBook = useIsBookActive(bookId);

  // Null-safe reads so all hooks can run before the not-ready guard below.
  const author = bookData?.author;
  const bookTitle = bookData?.bookTitle;
  const artwork = bookData?.artwork;

  // Fallback dimensions for when artwork extraction fails (default image is 500x500)
  const safeArtworkWidth = bookData?.artworkWidth ?? 500;
  const safeArtworkHeight = bookData?.artworkHeight ?? 500;

  const handlePress = useCallback(() => {
    setTitleDetailsNavIntent();
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
              : 12,
      },
      bookAuthor: {
        ...styles.bookAuthorText,
        color: themeColors.textMuted,
        fontSize: isRow ? 12 : numColumns === 1 ? fontSize.sm : fontSize.xs,
      },
      iconPadding: isRow ? 6 : 8,
      iconBottom: isRow ? 2 : 4,
      iconRight: isRow ? 2 : 4,
      iconSize: isRow
        ? 20
        : numColumns === 1
          ? 32
          : numColumns === 2
            ? 24
            : 14,
      playIconSize: isRow
        ? 20
        : numColumns === 1
          ? 36
          : numColumns === 2
            ? 28
            : 18,
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
        ? {
            height: ROW_COVER_HEIGHT + ROW_INFO_HEIGHT,
            width: aspectRatio * 160,
          }
        : { width: itemWidth, height: (1 / aspectRatio) * itemWidth + 90 },
      imageContainer: isRow
        ? { height: ROW_COVER_HEIGHT, width: aspectRatio * ROW_COVER_HEIGHT }
        : {
            paddingTop: 10,
            width: itemWidth + 2,
            height: (1 / aspectRatio) * itemWidth + 12,
          },
      // Explicit pixel dimensions so Glide can downscale at decode time
      imageSize: isRow
        ? {
            width: Math.round(aspectRatio * ROW_COVER_HEIGHT),
            height: ROW_COVER_HEIGHT,
            borderRadius: 3,
          }
        : {
            width: Math.round(itemWidth),
            height: Math.round((1 / aspectRatio) * itemWidth),
            borderRadius: 3,
          },
      bookInfoWidth: isRow ? aspectRatio * 150 - 10 : itemWidth,
    };
  }, [isRow, itemWidth, safeArtworkWidth, safeArtworkHeight]);

  // If data isn't ready or the book was deleted, render an empty cell of the
  // SAME size rather than null. FlashList measures cells; a null child makes a
  // cell measure short, and that measurement can stick — which is how rows end
  // up rendering at a fraction of their height while their neighbours are fine.
  // Must stay below every hook so the hook order is render-stable.
  if (!bookId || !bookData || !fullBook) {
    return (
      <View style={styles.pressableContainer} pointerEvents='none'>
        <View style={itemDimensions.container} />
      </View>
    );
  }

  return (
    <PressableScale
      rippleRadius={0}
      style={styles.pressableContainer}
      onPress={handlePress}
    >
      <View style={[styles.containerBase, itemDimensions.container]}>
        <View style={itemDimensions.imageContainer}>
          <FastImage
            source={{
              uri: artwork ?? unknownBookImageUri,
              priority: FastImage.priority.low,
              cache: FastImage.cacheControl.immutable,
            }}
            style={itemDimensions.imageSize}
            resizeMode={FastImage.resizeMode.contain}
            transition={FastImage.transition.fade}
          />
          <BookPlayButton
            bookId={bookId}
            fullBook={fullBook}
            iconPadding={layoutStyles.iconPadding}
            iconBottom={layoutStyles.iconBottom}
            iconRight={layoutStyles.iconRight}
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
              marginTop: 4,
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
  bookInfoContainer: {
    height: ROW_INFO_HEIGHT,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontFamily: 'Rubik', fontWeight: '600',
    maxWidth: '100%',
    // marginTop: 2,
  },
  bookAuthorText: {
    fontFamily: 'Rubik',
    // marginTop: 4,
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
    // right: 2,
    padding: 6,
    borderRadius: 4,
  },
});
