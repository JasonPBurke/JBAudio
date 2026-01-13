import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from 'pressto';
import { FadeInImage } from '@/components/FadeInImage';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
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
    handleBookPlay(
      fullBook,
      isCurrentlyPlaying,
      isActiveBook,
      activeBookId,
      setActiveBookId
    );
  }, [fullBook, isActiveBook, activeBookId, setActiveBookId]);

  // Memoize style objects to avoid recalculating on every render
  const containerStyle = useMemo(() => {
    if (flowDirection === 'row') {
      return {
        height: 205,
        width: (safeArtworkWidth / safeArtworkHeight) * 160,
      };
    }
    return {
      width: itemWidth,
      height: (safeArtworkHeight / safeArtworkWidth) * itemWidth + 75,
    };
  }, [flowDirection, itemWidth, safeArtworkWidth, safeArtworkHeight]);

  const imageContainerStyle = useMemo(() => {
    if (flowDirection === 'row') {
      return {
        height: 140,
        width: (safeArtworkWidth / safeArtworkHeight) * 140,
      };
    }
    return {
      paddingTop: 10,
      width: itemWidth + 2,
      height: (safeArtworkHeight / safeArtworkWidth) * itemWidth + 12,
    };
  }, [flowDirection, itemWidth, safeArtworkWidth, safeArtworkHeight]);

  const bookInfoContainerStyle = useMemo(
    () => ({
      ...styles.bookInfoContainer,
      width:
        flowDirection === 'row'
          ? (safeArtworkWidth / safeArtworkHeight) * 150 - 10
          : itemWidth,
    }),
    [flowDirection, itemWidth, safeArtworkWidth, safeArtworkHeight]
  );

  const bookTitleStyle = useMemo(
    () => ({
      ...styles.bookTitleText,
      color: isActiveBook ? '#ffb406be' : colors.text,
      fontSize:
        flowDirection === 'row'
          ? fontSize.xs
          : numColumns === 1
            ? fontSize.lg
            : numColumns === 2
              ? fontSize.sm
              : 14,
    }),
    [isActiveBook, flowDirection, numColumns]
  );

  const bookAuthorStyle = useMemo(
    () => ({
      ...styles.bookAuthorText,
      fontSize:
        flowDirection === 'row'
          ? 10
          : numColumns === 1
            ? fontSize.sm
            : numColumns === 2
              ? fontSize.xs
              : fontSize.xs,
    }),
    [flowDirection, numColumns]
  );

  return (
    <PressableScale
      // rippleColor={'#5c575749'}
      rippleRadius={0}
      // android_ripple={{
      //   color: '#cccccc28',
      //   foreground: false,
      // }}
      style={{
        paddingTop: 4,
        alignItems: 'center',
        // elevation: 5,
        marginBottom: 8,
      }}
      onPress={handlePress}
    >
      <View style={[{ alignItems: 'center' }, containerStyle]}>
        <View style={imageContainerStyle}>
          <FadeInImage
            source={{ uri: artwork ?? unknownBookImageUri }}
            style={styles.bookArtworkImage}
            resizeMode='contain'
          />
          {isActiveAndPlaying ? (
            <View
              style={[
                styles.trackPlayingImageIcon,
                {
                  padding:
                    flowDirection === 'row'
                      ? 16
                      : numColumns === 1
                        ? 24
                        : numColumns === 2
                          ? 20
                          : 17,
                  bottom: flowDirection === 'row' ? 2 : 12,
                  borderRadius: 4,
                  backgroundColor: '#1c1c1c96',
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <LoaderKitView
                style={[
                  {
                    width:
                      flowDirection === 'row'
                        ? 20
                        : numColumns === 1
                          ? 32
                          : numColumns === 2
                            ? 24
                            : 18,
                    aspectRatio: 1,
                  },
                ]}
                name={'LineScaleParty'}
                // animationSpeedMultiplier={0.5}
                color={colors.primary}
              />
            </View>
          ) : (
            <PressableScale
              rippleRadius={0}
              onPress={handlePressPlay}
              style={[
                styles.trackPausedIcon,
                {
                  bottom: flowDirection === 'row' ? 2 : 12,
                  padding: 6,
                  borderRadius: 4,
                  backgroundColor: '#1c1c1c96',
                },
              ]}
              hitSlop={10}
            >
              <Play
                size={
                  flowDirection === 'row'
                    ? 20
                    : numColumns === 1
                      ? 36
                      : numColumns === 2
                        ? 28
                        : 22
                } //* 24 is the 3 column size
                color={colors.icon}
                strokeWidth={1}
                absoluteStrokeWidth
              />
            </PressableScale>
          )}
        </View>
        <View style={bookInfoContainerStyle}>
          <Text
            numberOfLines={numColumns === 1 ? 1 : 2}
            style={bookTitleStyle}
          >
            {bookTitle}
          </Text>

          {author && (
            <Text numberOfLines={1} style={bookAuthorStyle}>
              {author}
            </Text>
          )}
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
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
    fontWeight: '600',
    maxWidth: '100%',
    marginTop: 2,
  },
  bookAuthorText: {
    color: colors.textMuted,
    marginTop: 4,
  },
  trackPlayingImageIcon: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 2,
    aspectRatio: 1,
  },
  trackPausedIcon: {
    position: 'absolute',
    right: 2,
  },
});
