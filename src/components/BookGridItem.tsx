import { unknownBookImageUri } from '@/constants/images';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import React, { memo, useCallback, useMemo } from 'react';
// import { Image } from 'expo-image';
import { FadeInImage } from '@/components/FadeInImage';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import LoaderKitView from 'react-native-loader-kit';
import { useActiveTrack, useIsPlaying } from 'react-native-track-player';
import { Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { useBookById, useBookDisplayData } from '@/store/library';

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
  const { playing } = useIsPlaying();

  const bookData = useBookDisplayData(bookId);
  const fullBook = useBookById(bookId);

  if (!bookId || !bookData || !fullBook) return null;

  const { author, bookTitle, artwork, artworkHeight, artworkWidth } =
    bookData;

  const { setActiveBookId, activeBookId } = useQueueStore();
  const isActiveBook = useActiveTrack()?.bookId === bookId;
  const encodedBookId = encodeURIComponent(bookId);

  const handlePress = useCallback(() => {
    router.navigate(`/titleDetails?bookId=${encodedBookId}`);
  }, [router, encodedBookId]);

  const handlePressPlay = useCallback(() => {
    if (!fullBook) return;
    handleBookPlay(
      fullBook,
      playing,
      isActiveBook,
      activeBookId,
      setActiveBookId
    );
  }, [fullBook, playing, isActiveBook, activeBookId, setActiveBookId]);

  // Memoize style objects to avoid recalculating on every render
  const containerStyle = useMemo(() => {
    if (flowDirection === 'row') {
      return {
        height: 205,
        width: artworkHeight ? (artworkWidth! / artworkHeight) * 160 : 0,
      };
    }
    return {
      width: itemWidth,
      height: artworkWidth
        ? (artworkHeight! / artworkWidth) * itemWidth + 75
        : 0,
    };
  }, [flowDirection, itemWidth, artworkWidth, artworkHeight]);

  const imageContainerStyle = useMemo(() => {
    if (flowDirection === 'row') {
      return {
        height: 140,
        width: artworkHeight ? (artworkWidth! / artworkHeight) * 140 : 0,
      };
    }
    return {
      paddingTop: 10,
      width: itemWidth + 2,
      height: artworkWidth
        ? (artworkHeight! / artworkWidth) * itemWidth + 12
        : 0,
    };
  }, [flowDirection, itemWidth, artworkWidth, artworkHeight]);

  const bookInfoContainerStyle = useMemo(
    () => ({
      ...styles.bookInfoContainer,
      width:
        flowDirection === 'row'
          ? artworkHeight
            ? (artworkWidth! / artworkHeight) * 150 - 10
            : 0
          : itemWidth,
    }),
    [flowDirection, itemWidth, artworkWidth, artworkHeight]
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
    <Pressable
      android_ripple={{
        color: '#cccccc28',
        foreground: false,
      }}
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
          {isActiveBook && playing ? (
            <View
              style={[
                styles.trackPlayingImageIcon,
                {
                  width:
                    flowDirection === 'row'
                      ? 20
                      : numColumns === 1
                        ? 32
                        : numColumns === 2
                          ? 24
                          : 18,
                  padding:
                    flowDirection === 'row'
                      ? 20
                      : numColumns === 1
                        ? 24
                        : numColumns === 2
                          ? 20
                          : 17,
                  borderRadius: 4,
                  backgroundColor: '#1c1c1c96',
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <LoaderKitView
                style={[
                  // styles.trackPlayingImageIcon,
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
                color={colors.primary}
              />
            </View>
          ) : (
            <Pressable
              onPress={handlePressPlay}
              style={{
                ...styles.trackPausedIcon,
                padding: 6,
                borderRadius: 4,
                backgroundColor: '#1c1c1c96',
              }}
              hitSlop={25}
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
            </Pressable>
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
    </Pressable>
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
    aspectRatio: 1,
  },
  trackPausedIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
});
