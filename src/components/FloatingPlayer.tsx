import React, { useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useActiveTrack } from 'react-native-track-player';
import { Image } from 'expo-image';

import { unknownBookImageUri } from '@/constants/images';
import {
  PlayPauseButton,
  SeekBackButton,
} from '@/components/PlayerControls';
import { useLastActiveTrack } from '@/hooks/useLastActiveTrack';
import { MovingText } from '@/components/MovingText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useQueueStore } from '@/store/queue';
import { useBookById } from '@/store/library';
import { BookTimeRemaining } from '@/components/BookTimeRemaining';

/**
 * Optimized FloatingPlayer component.
 *
 * Key optimizations:
 * 1. Wrapped in React.memo to prevent re-renders from parent
 * 2. Uses optimized BookTimeRemaining (event-based, updates every 5 seconds)
 * 3. Uses PlayPauseButton and SeekBackButton which use Reanimated for animations
 * 4. Memoized container style to avoid new object references
 * 5. Memoized handlePress callback
 */
export const FloatingPlayer = React.memo(() => {
  const { bottom } = useSafeAreaInsets();
  const isPlayerReady = useQueueStore((state) => state.isPlayerReady);
  const { colors: themeColors } = useTheme();

  const router = useRouter();
  const activeTrack = useActiveTrack();
  const lastActiveTrack = useLastActiveTrack();
  const displayedTrack = activeTrack ?? lastActiveTrack;

  const displayedBook = useBookById(displayedTrack?.bookId ?? '');

  // Memoize the container style to avoid new object reference on each render
  const containerStyle = useMemo(
    () => [
      styles.parentContainer,
      {
        marginBottom: bottom - 12,
        borderColor: themeColors.primary,
        borderWidth: StyleSheet.hairlineWidth,
        backgroundColor: themeColors.modalBackground,
      },
    ],
    [bottom, themeColors.primary, themeColors.modalBackground],
  );

  // Memoize the navigation callback
  const handlePress = useCallback(() => {
    router.navigate('/player');
  }, [router]);

  if (!isPlayerReady || !displayedTrack || !displayedBook) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      style={containerStyle}
    >
      <>
        <Image
          contentFit='contain'
          source={{
            uri: displayedBook.artwork ?? unknownBookImageUri,
          }}
          style={styles.bookArtworkImage}
        />

        <View style={styles.bookTitleContainer}>
          <MovingText
            style={[styles.bookTitle, { color: themeColors.text }]}
            text={displayedBook.bookTitle ?? ''}
            animationThreshold={25}
          />
          <BookTimeRemaining color={themeColors.textMuted} />
        </View>
        <View style={styles.bookControlsContainer}>
          <SeekBackButton
            iconSize={32}
            top={4}
            right={9}
            fontSize={12}
            color={themeColors.icon}
          />
          <PlayPauseButton iconSize={40} top={6} left={6} />
        </View>
      </>
    </TouchableOpacity>
  );
});

FloatingPlayer.displayName = 'FloatingPlayer';

const styles = StyleSheet.create({
  parentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor moved to containerStyle for theme support
    borderRadius: 6,
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 10,
  },
  bookArtworkImage: {
    height: 50,
    width: 50,
    borderRadius: 3,
    marginLeft: 4,
  },
  bookTitleContainer: {
    flex: 1,
    overflow: 'hidden',
    margin: 4,
  },
  bookTitle: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 18,
  },
  bookControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // columnGap: 14,
    paddingVertical: 4,
    // paddingHorizontal: 8,
  },
});
