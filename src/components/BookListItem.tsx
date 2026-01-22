import { unknownBookImageUri } from '@/constants/images';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import React, { memo, useCallback } from 'react';
import { FadeInImage } from '@/components/FadeInImage';
import { colors, fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import {
  useIsBookActive,
  useIsBookActiveAndPlaying,
} from '@/store/playerState';

import { Play, EllipsisVertical } from 'lucide-react-native';
import LoaderKitView from 'react-native-loader-kit';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { useBookById, useBookDisplayData } from '@/store/library';
import TrackPlayer, { State } from 'react-native-track-player';

export type BookListItemProps = {
  bookId: string;
};

export const BookListItem = memo(function BookListItem({
  bookId,
}: BookListItemProps) {
  const router = useRouter();
  const { colors: themeColors } = useTheme();

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
      setActiveBookId,
    );
  }, [fullBook, isActiveBook, activeBookId, setActiveBookId]);

  return (
    <Pressable
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
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
                color: isActiveBook
                  ? withOpacity(themeColors.primary, 0.75)
                  : themeColors.text,
              }}
            >
              {bookTitle}
            </Text>

            {author && (
              <Text
                numberOfLines={1}
                style={[
                  styles.bookAuthorText,
                  { color: themeColors.textMuted },
                ]}
              >
                {author}
              </Text>
            )}
          </View>
          <View style={{ gap: 8 }}>
            <Pressable style={{ padding: 8 }} hitSlop={10}>
              <EllipsisVertical
                size={18}
                color={themeColors.icon}
                strokeWidth={1}
                absoluteStrokeWidth
              />
            </Pressable>
            {isActiveAndPlaying ? (
              <View style={{ padding: 8 }}>
                <LoaderKitView
                  style={styles.trackPlayingImageIcon}
                  name={'LineScaleParty'}
                  animationSpeedMultiplier={0.5}
                  color={themeColors.primary}
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
                  color={themeColors.textMuted}
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
    fontFamily: 'Rubik-SemiBold',
    // fontWeight: '600',
    maxWidth: '90%',
  },
  bookAuthorText: {
    fontFamily: 'Rubik',
    fontSize: 14,
    marginTop: 4,
  },
  trackPlayingImageIcon: {
    padding: 8,
    width: 20,
    height: 20,
  },
});
