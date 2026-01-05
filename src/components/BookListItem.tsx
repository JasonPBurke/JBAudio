import { unknownBookImageUri } from '@/constants/images';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import React, { memo, useCallback } from 'react';
// import { Image } from 'expo-image';
import { FadeInImage } from '@/components/FadeInImage';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { useActiveTrack, useIsPlaying } from 'react-native-track-player';

import { Play, EllipsisVertical } from 'lucide-react-native';
import LoaderKitView from 'react-native-loader-kit';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { useBookById, useBookDisplayData } from '@/store/library';

export type BookListItemProps = {
  bookId: string;
};

export const BookListItem = memo(function BookListItem({
  bookId,
}: BookListItemProps) {
  const router = useRouter();
  const { playing } = useIsPlaying();

  // Fetch the specific data needed for display.
  // `useShallow` in this hook prevents re-renders if the data hasn't changed.
  const bookData = useBookDisplayData(bookId);
  // Fetch the full book object only when needed for actions like playback.
  const fullBook = useBookById(bookId);

  // If data isn't ready or the book was deleted, render nothing.
  if (!bookId || !bookData || !fullBook) {
    return null;
  }

  const { author, bookTitle, artwork } = bookData;

  const { setActiveBookId, activeBookId } = useQueueStore();
  const isActiveBook = useActiveTrack()?.bookId === bookId;

  const handlePress = useCallback(() => {
    router.navigate({
      pathname: '/titleDetails',
      params: { bookId, author, bookTitle },
    });
  }, [router, bookId, author, bookTitle]);

  const handlePressPlay = useCallback(() => {
    handleBookPlay(
      fullBook,
      playing,
      isActiveBook,
      activeBookId,
      setActiveBookId
    );
  }, [fullBook, playing, isActiveBook, activeBookId, setActiveBookId]);

  return (
    <Pressable
      android_ripple={{ color: '#cccccc28' }}
      onPress={handlePress}
    >
      <View style={styles.bookItemContainer}>
        <View style={styles.bookArtworkImage}>
          <FadeInImage
            source={{ uri: artwork ?? unknownBookImageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode='contain'
          />
        </View>
        <View style={styles.bookInfoContainer}>
          <View style={{ width: '100%' }}>
            <Text
              numberOfLines={1}
              style={{
                ...styles.bookTitleText,
                color: isActiveBook ? '#ffb406be' : colors.text,
              }}
            >
              {bookTitle}
            </Text>

            {author && (
              <Text numberOfLines={1} style={styles.bookAuthorText}>
                {author}
              </Text>
            )}
          </View>
          <View style={{ gap: 8 }}>
            <Pressable style={{ padding: 8 }} hitSlop={10}>
              <EllipsisVertical
                size={18}
                color={colors.icon}
                strokeWidth={1}
                absoluteStrokeWidth
              />
            </Pressable>
            {isActiveBook && playing ? (
              <View style={{ padding: 8 }}>
                <LoaderKitView
                  style={styles.trackPlayingImageIcon}
                  name={'LineScaleParty'}
                  animationSpeedMultiplier={0.5}
                  color={colors.primary}
                />
              </View>
            ) : (
              <Pressable
                onPress={handlePressPlay}
                style={{ padding: 8 }}
                hitSlop={10}
              >
                <Play
                  // onPress={() => handlePressPlay(book)}
                  size={18}
                  color={colors.textMuted}
                  strokeWidth={1}
                  absoluteStrokeWidth
                />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bookItemContainer: {
    flexDirection: 'row',
    columnGap: 14,
    alignItems: 'center',
    paddingRight: 36,
  },
  bookArtworkImage: {
    height: 80,
    aspectRatio: 0.75,
  },
  bookInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookTitleText: {
    ...defaultStyles.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    maxWidth: '90%',
  },
  bookAuthorText: {
    ...defaultStyles.text,
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  trackPlayingImageIcon: {
    padding: 8,
    width: 20,
    height: 20,
  },
});
