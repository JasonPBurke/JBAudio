import { unknownBookImageUri } from '@/constants/images';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import React, { memo, useCallback } from 'react';
import FastImage from '@d11/react-native-fast-image';
import { fontSize } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import { withOpacity } from '@/helpers/colorUtils';
import { useTheme } from '@/hooks/useTheme';
import {
  useIsBookActive,
  useIsBookActiveAndPlaying,
} from '@/store/playerState';

import { Play } from 'lucide-react-native';
import LoaderKitView from 'react-native-loader-kit';
import { useRouter } from 'expo-router';
import { useQueueStore } from '@/store/queue';
import { playBookFromRow } from '@/helpers/playBookFromRow';
import { BookDurationRow } from '@/components/BookDurationRow';
import { useBookById, useBookDisplayData } from '@/store/library';
import { setTitleDetailsNavIntent } from '@/store/titleDetailsNavIntent';

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

  const { setActiveBookId, activeBookId } = useQueueStore();
  const isActiveBook = useIsBookActive(bookId);
  const isActiveAndPlaying = useIsBookActiveAndPlaying(bookId);

  // Null-safe reads so all hooks can run before the not-ready guard below.
  const author = bookData?.author;
  const bookTitle = bookData?.bookTitle;
  const artwork = bookData?.artwork;

  const handlePress = useCallback(() => {
    setTitleDetailsNavIntent();
    router.navigate({
      pathname: '/titleDetails',
      params: { bookId, author, bookTitle },
    });
  }, [router, bookId, author, bookTitle]);

  const handlePressPlay = useCallback(
    () =>
      playBookFromRow({
        book: fullBook,
        // The ACTIVE Book (player state); the series surfaces pass the
        // Requested one here. See playBookFromRow's header.
        alreadyInPlay: isActiveBook,
        activeBookId,
        setActiveBookId,
        recordPlayFootprint: true,
      }),
    [fullBook, isActiveBook, activeBookId, setActiveBookId],
  );

  // If data isn't ready or the book was deleted, render nothing.
  // Must stay below every hook so the hook order is render-stable.
  if (!bookId || !bookData || !fullBook) {
    return null;
  }

  return (
    <Pressable
      android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
      onPress={handlePress}
    >
      <View style={styles.bookItemContainer}>
        <View style={styles.bookArtworkImage}>
          <FastImage
            source={{
              uri: artwork ?? unknownBookImageUri,
              priority: FastImage.priority.low,
              cache: FastImage.cacheControl.immutable,
            }}
            style={{ width: 60, height: 80 }}
            resizeMode={FastImage.resizeMode.contain}
            transition={FastImage.transition.fade}
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
            <BookDurationRow
              book={fullBook}
              fontSize={11}
              barHeight={3}
              style={{ marginTop: 4, maxWidth: '50%' }}
            />
          </View>
          <View style={{ gap: 8 }}>
            {isActiveAndPlaying ? (
              <View style={{ paddingVertical: 8 }}>
                <LoaderKitView
                  style={styles.trackPlayingImageIcon}
                  name={'LineScaleParty'}
                  animationSpeedMultiplier={0.55}
                  color={themeColors.primary}
                />
              </View>
            ) : (
              <Pressable
                onPress={handlePressPlay}
                style={{ paddingVertical: 8 }}
                hitSlop={10}
              >
                <Play
                  size={26}
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
    fontFamily: 'Rubik', fontWeight: '600',
    maxWidth: '90%',
  },
  bookAuthorText: {
    fontFamily: 'Rubik',
    fontSize: 14,
    marginTop: 4,
  },
  trackPlayingImageIcon: {
    padding: 8,
    width: 24,
    height: 24,
  },
});
